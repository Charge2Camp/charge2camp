-- Korrigiert eine Regression aus der VORHERIGEN Migration
-- (20261025100000_fix_charge_points_in_bbox_unknown_verdict_timeout.sql),
-- die noch am selben Tag entdeckt wurde: das dort eingefuehrte einfache
-- EXISTS ersetzte zwar erfolgreich die 35,5s-Falle bei verdict='unknown',
-- machte aber den bis dahin schnellen SELEKTIVEN Standardfall
-- ('yes'/'unhitch', ~1,6% aller Ladepunkte) dramatisch langsamer: 57,8s
-- statt vorher ~700ms (EXPLAIN ANALYZE direkt gegen Produktion verifiziert).
--
-- Ursache: core.charge_points_in_bbox() ist eine PL/pgSQL-Funktion mit
-- statischem SQL im Funktionskoerper -- PostgreSQL plant solche Anweisungen
-- nach den ersten Aufrufen NICHT mehr pro Aufruf frisch ("custom plan"),
-- sondern verwendet einen "generic plan", der die tatsaechlichen Werte der
-- Parameter (insbesondere p_trailer_verdicts) nicht mehr kennt und einen
-- fuer den DURCHSCHNITTLICHEN Fall kalkulierten Plan waehlt -- bei einem
-- Merkmal mit stark schwankender Selektivitaet (1,6% vs. 98%) ist das fuer
-- BEIDE Extreme schlecht. Isolierte EXPLAIN-ANALYZE-Tests derselben Abfrage
-- (nicht in einer Funktion, also immer frisch geplant) zeigten dagegen fuer
-- beide Faelle 18-300ms -- der generic-plan-Effekt der Funktion war die
-- Ursache, nicht die Abfrage selbst.
--
-- Fix: `execute` mit dynamischem SQL -- PL/pgSQL plant eine per `execute`
-- ausgefuehrte Anweisung bei JEDEM Aufruf frisch (kein generic-plan-Caching),
-- der Planer sieht die tatsaechlichen Parameterwerte wie bei einer direkten
-- Abfrage. `using` uebergibt alle Parameter weiterhin sicher parametrisiert
-- (kein String-Concatenation-Risiko). Live gegen Produktion verifiziert:
-- 'yes'/'unhitch' ~250ms, 'unknown' ~200ms -- beide Faelle jetzt durchgehend
-- schnell, kein Kompromiss mehr zwischen ihnen noetig.
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
    return query execute
        'select
            cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
            cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
            cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
            cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
            cp.is_active,
            st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
         from core.charge_point cp
         where cp.is_active
           and cp.geom && ST_MakeEnvelope($1, $2, $3, $4, 4326)::geography
           and ($5::numeric is null or cp.max_power_kw >= $5)
           and ($6::text is null or cp.name ilike ''%'' || $6 || ''%'')
           and (
             $8::text[] is null or array_length($8, 1) is null
             or exists (
               select 1 from enrich.trailer_suitability ts
               where ts.charge_point_key = cp.external_key and ts.verdict = any($8)
             )
           )
         order by cp.name
         limit $7'
    using p_west, p_south, p_east, p_north, p_min_power_kw, p_q, p_limit, p_trailer_verdicts;
end;
$$;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). p_trailer_verdicts filtert ueber ein EXISTS auf enrich.trailer_suitability, als `execute`-Anweisung (dynamisches SQL) statt statischem SQL im Funktionskoerper -- verhindert PL/pgSQLs generic-plan-Caching, das bei p_trailer_verdicts-Werten mit stark schwankender Selektivitaet (''yes''/''unhitch'' ~1,6% vs. ''unknown'' ~98% aller Ladepunkte) sonst einen fuer den jeweils anderen Fall katastrophal schlechten Plan waehlte (siehe Migrationskommentare 20261025100000/20261025110000). Rueckgabeform weiterhin identisch zu core.charge_point_geo.';
