-- Nutzermeldung (2026-09-24): seit dem BNetzA-Import haeufig "Laden
-- fehlgeschlagen" auf der Ladepunkte-Karte. Root Cause: core.
-- charge_points_in_bbox() (20261023020000) filtert den Kartenausschnitt zwar
-- bereits ueber den raeumlichen Index (idx_cp_geom, 53ms statt 14,9s), gibt
-- aber weiterhin bis zu p_limit (5000) Treffer zurueck, die src/lib/
-- charging-stations.ts (enrichStations) anschliessend PRO ANFRAGE in Batches
-- von 150 anreichert (Connectoren + enrich.trailer_suitability) -- bei einem
-- weit herausgezoomten Ausschnitt (z. B. die Deutschland-Erstansicht) sind
-- das bis zu 34 Batches x 2 parallele Requests. Mit dem neuen Anhaenger-
-- tauglichkeits-Default (nur noch 'yes'/'unhitch' statt aller vier Zustaende,
-- siehe DEFAULT_TRAILER_VERDICTS in charging-stations.ts) wird diese Menge
-- bisher ERST NACH der teuren Anreicherung in JS weggefiltert -- die
-- Anreicherung selbst bleibt also weiterhin teuer, obwohl am Ende oft nur ein
-- Bruchteil der Treffer tatsaechlich angezeigt wird: von allen core.
-- charge_point-Zeilen mit trailer_suitability-Eintrag hat laut
-- 20261024120000_fix_checked_verdict_filter_timeout.sql nur ~1,6 % ueberhaupt
-- einen geprueften Verdict (2.245 von 137.776) -- der Rest stammt aus dem
-- automatischen Import mit Platzhalter-Verdict 'unknown'.
--
-- Fix: optionaler vierter Filterparameter p_trailer_verdicts -- wenn gesetzt,
-- grenzt die Funktion SELBST (vor Limit/Anreicherung) auf charge_point_key
-- mit passendem trailer_suitability.verdict ein. Gleiches Muster wie
-- core.charge_point_admin_list()'s p_verdict='checked'-Zweig (materialisierte
-- CTE auf idx_ts_verdict, verhindert dass der Planer pro Kandidatenzeile im
-- Kartenausschnitt einzeln in trailer_suitability nachschlagen muss).
--
-- "create or replace function" mit einer GEAENDERTEN Parameterliste legt in
-- Postgres eine ZUSAETZLICHE Ueberladung an statt die alte 7-Parameter-
-- Funktion zu ersetzen (Funktionen werden ueber Name+Parametertypen
-- identifiziert, siehe 20261024150000_drop_old_admin_list_overload.sql --
-- gleiche Falle, hier vorab vermieden) -- jeder Aufruf ohne ALLE Parameter
-- per Name (z. B. eigene Testaufrufe/psql) waere sonst mehrdeutig geworden
-- ("function core.charge_points_in_bbox(...) is not unique"). Alte
-- Ueberladung deshalb zuerst explizit entfernen.
drop function if exists core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer);

create or replace function core.charge_points_in_bbox(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null
)
returns setof core.charge_point_geo
language plpgsql
stable
security definer
set search_path = core, enrich, public
as $$
begin
    if p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0 then
        return query
        with matching_keys as materialized (
            select charge_point_key
            from enrich.trailer_suitability
            where verdict = any(p_trailer_verdicts)
        )
        select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
        from core.charge_point cp
        join matching_keys mk on mk.charge_point_key = cp.external_key
        where cp.is_active
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
        order by cp.name
        limit p_limit;
    else
        return query
        select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
        from core.charge_point cp
        where cp.is_active
          and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
          and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
          and (p_q is null or cp.name ilike '%' || p_q || '%')
        order by cp.name
        limit p_limit;
    end if;
end;
$$;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). p_trailer_verdicts (20261024240000) grenzt ueber eine materialisierte CTE auf idx_ts_verdict VOR Limit/Connector-Anreicherung auf charge_point_key mit passendem enrich.trailer_suitability.verdict ein -- ohne diesen Parameter reicherte der Client bis zu p_limit (5000) Treffer an, obwohl nach dem 2026-09-24 eingefuehrten Anhaengertauglichkeits-Default (nur "yes"/"unhitch") am Ende nur ~1,6 % davon ueberhaupt angezeigt wurden (Grossteil der BNetzA-importierten Ladepunkte hat Platzhalter-Verdict "unknown"), was bei weit herausgezoomten Kartenausschnitten das PostgREST-Statement-Timeout riss ("Laden fehlgeschlagen"). Rueckgabeform weiterhin identisch zu core.charge_point_geo.';

grant execute on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) to service_role;
