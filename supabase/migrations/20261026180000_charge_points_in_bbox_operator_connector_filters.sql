-- Betreiber- und Steckertyp-Filter im Kartenausschnitt VOR der Stichprobe (SQL) statt
-- danach in JS.
--
-- Problem: core.charge_points_in_bbox kannte nur Leistung, Namenssuche und Verdict. Die
-- Filter "Betreiber" und "Steckertyp" liefen in fetchChargingStations erst NACH der
-- Anreicherung in JS -- also auf der id-Stichprobe von hoechstens 1.500 Ladepunkten
-- (20261026140000). Bei weitem Zoom zeigte ein Betreiberfilter deshalb nur ~9 % (der
-- Stichprobenanteil) der Ladepunkte dieses Betreibers, ein Steckertypfilter ebenso;
-- gemessen: EnBW 1.265 Ladepunkte im Europa-Ausschnitt, in der Stichprobe 120-139.
--
-- Jetzt zwei neue Parameter am ENDE der Signatur (mit Default null, aufrufkompatibel):
--   p_operators            text[]  exakte core.charge_point.operator-Werte
--   p_connector_standards  text[]  exakte core.connector.standard-Werte (= Ergebnis von
--                                  standardsForCategories, gleiche Semantik wie im
--                                  nicht-bbox-Pfad core.search_charge_points)
-- In allen drei Zweigen (selektiv / unknown / ohne Verdict-Filter) wirken sie vor
-- "order by id limit p_limit": die Stichprobe zieht dann nur noch aus passenden
-- Ladepunkten. Der Steckertyp-Filter nutzt per EXISTS den covering index
-- idx_conn_cp_covering (20261026150000), der Betreiberfilter idx_cp_active_operator.
-- core.charge_points_in_bbox_enriched reicht beide Parameter durch.
--
-- Signaturaenderung => ZUERST die alten Signaturen droppen (sonst entsteht ein zweiter
-- Overload mit Default-Parametern: "function ... is not unique"). Reihenfolge: erst die
-- angereicherte Funktion droppen, dann die Basisfunktion, dann beide neu anlegen
-- (Basisfunktion zuerst, der SQL-Rumpf der angereicherten Funktion wird beim Anlegen
-- geprueft). Der laufende Code ruft beide Funktionen mit benannten Parametern ohne die
-- neuen -- das loest nach dem Anlegen eindeutig auf die neue Signatur auf (Defaults),
-- die Migration kann also VOR dem Code-Deploy angewendet werden.
-- Funktionskoerper sonst unveraendert (SET-Klauseln, security definer, id-Stichprobe,
-- unknown-Semantik aus 20261026160000). Grants/Kommentare gehen beim DROP verloren und
-- werden unten neu gesetzt. Lokal getestet; NICHT in Produktion angewendet/gemessen.

drop function if exists core.charge_points_in_bbox_enriched(double precision, double precision, double precision, double precision, numeric, text, integer, text[]);
drop function if exists core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]);

create or replace function core.charge_points_in_bbox(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null,
    p_operators text[] default null,
    p_connector_standards text[] default null
)
returns setof core.charge_point_geo
language plpgsql
stable
security definer
set search_path = core, enrich, public
set plan_cache_mode = force_custom_plan
as $$
begin
    if p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0
       and not ('unknown' = any(p_trailer_verdicts)) then
        -- Selektiver Fall (nur yes/unhitch/no, ~1,6% aller Ladepunkte):
        -- materialisierte CTE grenzt zuerst auf die kleine Treffermenge
        -- ueber idx_ts_verdict ein, bevor gegen core.charge_point gejoint
        -- wird.
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
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
        order by cp.id
        limit p_limit;
    elsif p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0 then
        -- Nicht-selektiver Fall (p_trailer_verdicts enthaelt 'unknown',
        -- dominiert die Treffermenge mit ~98,4%+): keine Materialisierung,
        -- einfaches EXISTS auf dem PK (charge_point_key) -- da fast jede
        -- Zeile matcht, ist der Filter praktisch kostenlos und braucht
        -- keine Vorab-Eingrenzung.
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
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
          -- 'unknown' = noch nicht bewertet: ausgeschlossen werden nur Ladepunkte mit einer
          -- ECHTEN Bewertung (keine Platzhalter-Zeile), deren Verdict nicht in der Liste
          -- steht. Ladepunkte ohne echte Bewertung (inkl. solcher ganz ohne
          -- trailer_suitability-Zeile) zaehlen als 'unknown'. Das Praedikat der echten
          -- Bewertung muss WOERTLICH zu idx_ts_meaningful passen (Teilindex).
          and not exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cp.external_key
              and not (ts.verdict = 'unknown' and ts.origin = 'auto' and ts.notes is null and ts.drive_through is null)
              and not (ts.verdict = any(p_trailer_verdicts))
          )
        order by cp.id
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
          and (p_operators is null or cp.operator = any(p_operators))
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cp.id and c.standard = any(p_connector_standards)
            )
          )
        order by cp.id
        limit p_limit;
    end if;
end;
$$;

create or replace function core.charge_points_in_bbox_enriched(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000,
    p_trailer_verdicts text[] default null,
    p_operators text[] default null,
    p_connector_standards text[] default null
)
returns setof jsonb
language sql
stable
security invoker
as $$
    select
        (to_jsonb(s) - 'geom')
        || jsonb_build_object(
            'connectors', coalesce((
                select jsonb_agg(
                    jsonb_build_object(
                        'id', c.id,
                        'charge_point_id', c.charge_point_id,
                        'standard', c.standard,
                        'power_kw', c.power_kw,
                        'current_type', c.current_type,
                        'quantity', c.quantity
                    )
                    order by c.id
                )
                from core.connector c
                where c.charge_point_id = s.id
            ), '[]'::jsonb),
            'trailer', (
                select jsonb_build_object(
                    'charge_point_key', ts.charge_point_key,
                    'verdict', ts.verdict,
                    'drive_through', ts.drive_through,
                    'pull_in_length_m', ts.pull_in_length_m,
                    'maneuvering_space', ts.maneuvering_space,
                    'notes', ts.notes,
                    'origin', ts.origin,
                    'confirm_count', ts.confirm_count,
                    'dispute_count', ts.dispute_count,
                    'verified_at', ts.verified_at
                )
                from enrich.trailer_suitability ts
                where ts.charge_point_key = s.external_key
                  and not (ts.verdict = 'unknown' and ts.origin = 'auto' and ts.notes is null and ts.drive_through is null)
            )
        )
    from core.charge_points_in_bbox(
        p_west, p_south, p_east, p_north, p_min_power_kw, p_q, p_limit, p_trailer_verdicts,
        p_operators, p_connector_standards
    ) s
$$;

grant execute on function core.charge_points_in_bbox_enriched(double precision, double precision, double precision, double precision, numeric, text, integer, text[], text[], text[]) to service_role;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[], text[], text[]) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). Filter: Leistung, Namenssuche, Trailer-Verdict (zwei Zweige nach Selektivitaet: ohne ''unknown'' materialisierte CTE auf idx_ts_verdict; mit ''unknown'' = ohne echte Bewertung per not exists auf idx_ts_meaningful), Betreiber (p_operators, exakt) und Steckertyp (p_connector_standards, exakt, per EXISTS auf idx_conn_cp_covering) -- alle VOR der Stichprobe order by id limit p_limit (stabile, betreiberneutrale Stichprobe, siehe 20261026140000). set plan_cache_mode = force_custom_plan gegen generic-plan-Regressionen (20261026130000). Rueckgabeform identisch zu core.charge_point_geo.';

comment on function core.charge_points_in_bbox_enriched(double precision, double precision, double precision, double precision, numeric, text, integer, text[], text[], text[]) is
  'Viewport-Abfrage mit Anreicherung in einem Roundtrip (fetchChargingStations bbox-Zweig): ruft core.charge_points_in_bbox (inkl. p_operators/p_connector_standards) und haengt je Station "connectors" (Array) und "trailer" (Objekt oder null) an, nur mit den vom Client genutzten Feldern (ohne geom, verified_by u. a.). Reine Platzhalter-Zeilen von enrich.trailer_suitability liefern trailer = null. Siehe Migrationskommentare 20261026150000 und 20261026180000.';
