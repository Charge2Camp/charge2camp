-- Verhindert generic-plan-Regressionen in core.charge_points_in_bbox() durch
-- "set plan_cache_mode = force_custom_plan" am Funktionskopf.
--
-- Hintergrund: Die Funktion ist PL/pgSQL mit statischem SQL. Postgres plant eine
-- mehrfach ausgefuehrte Anweisung nach den ersten 5 Aufrufen in derselben Session
-- ggf. als "generic plan", der die tatsaechlichen Parameterwerte (hier v. a. die
-- bbox p_west/p_south/p_east/p_north, aber auch p_min_power_kw/p_q/p_limit) nicht
-- mehr kennt. Die bbox-Groesse schwankt von wenigen Metern bis EU-weit -- ein fuer
-- eine Groesse kalibrierter Plan ist fuer die andere unpassend. 20261025130000 hat
-- nur die Verdict-Selektivitaet per IF/ELSE getrennt, nicht die bbox-Schwankung.
--
-- Gemessen (Reproduktion: 10 Aufrufe in EINER Session, abwechselnd winzige und
-- weite bbox, Verdict-Pfad 'unknown', 150 kW):
--   lokal (124.000 synthetische Ladepunkte, warmer Cache):
--     Standard-Plan-Cache 1.178 ms  ->  force_custom_plan 50 ms
--     ohne Verdict-Filter   202 ms  ->  12 ms;  ohne jeden Filter 252 ms -> 14 ms
--     selektiver Pfad       243 ms  ->  175 ms
--   Produktion (123.745 aktive Ladepunkte): dieselbe Abfolge im 'unknown'-Pfad
--     lief ueber 2 Minuten (abgebrochen) -- dieselbe Abfolge nur mit weiter bbox
--     53-330 ms fuer 8 Aufrufe. Das ist das bekannte "manchmal 35-58 s"-Muster.
-- Der Nachteil von force_custom_plan (jeder Aufruf wird neu geplant, einige ms
-- Planungszeit) ist bei Abfragen von 40-2.000 ms vernachlaessigbar.
--
-- Signatur unveraendert: kein DROP noetig, kein doppelter Overload. Funktionskoerper,
-- security definer und search_path sind identisch zu 20261025130000.
-- NICHT in Produktion angewendet/gemessen -- vor "db push" lokal geprueft; nach dem
-- Push dieselbe Abfolge read-only per EXPLAIN ANALYZE nachmessen (kleine Zahl Aufrufe,
-- Statement-Timeout beachten, nicht ungebremst wiederholen).
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
        order by cp.name
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
          and exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cp.external_key and ts.verdict = any(p_trailer_verdicts)
          )
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
