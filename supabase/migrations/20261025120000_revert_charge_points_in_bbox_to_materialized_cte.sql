-- Sofort-Rueckbau der beiden vorherigen Versuche (20261025100000 EXISTS,
-- 20261025110000 EXECUTE-basiert) -- BEIDE degradierten live gegen
-- Produktion gemessen den bis dahin schnellen Standardfall
-- ('yes'/'unhitch') auf 50-58s, ohne den urspruenglichen 'unknown'-Fall
-- zuverlaessig zu loesen. Live-Experimente an der Produktionsfunktion
-- werden hiermit gestoppt -- diese Migration stellt exakt die vorherige,
-- bekannt fuer den HAEUFIGEN Fall schnelle Version aus 20261024240000
-- wieder her (materialisierte CTE), bis eine in einer Staging-Umgebung
-- verifizierte Loesung fuer den 'unknown'-Fall vorliegt. Der seltene
-- 'unknown'-Filter bleibt bis dahin bekanntermassen langsam (~35s) --
-- unveraendert gegenueber dem Stand vor dem heutigen Debugging, nicht
-- neu eingefuehrt.
drop function if exists core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer, text[]);

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
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts). p_trailer_verdicts (20261024240000) grenzt ueber eine materialisierte CTE auf idx_ts_verdict VOR Limit/Connector-Anreicherung auf charge_point_key mit passendem enrich.trailer_suitability.verdict ein. BEKANNTE EINSCHRAENKUNG (Audit 2026-09-30): bei wenig selektiven Verdict-Werten wie "unknown" (~98% aller Ladepunkte) dauert das gemessen ~35s -- zwei Korrekturversuche (20261025100000 EXISTS, 20261025110000 EXECUTE) verschlechterten dabei jeweils den haeufigeren selektiven Fall auf 50-58s und wurden zurueckgerollt (20261025120000). Eine tragfaehige Loesung fuer BEIDE Faelle steht noch aus -- vor einem erneuten Versuch in einer Staging-Umgebung verifizieren, nicht direkt gegen Produktion. Rueckgabeform identisch zu core.charge_point_geo.';
