-- Stabile, nach Betreibernamen UNVERZERRTE Auswahl, wenn ein Kartenausschnitt mehr
-- Ladepunkte enthaelt als p_limit: "order by cp.id" statt "order by cp.name".
--
-- Problem (gemessen in Produktion, gepolsterter Europa-Ausschnitt, >= 150 kW):
-- 16.023 passende Ladepunkte, aber "order by name limit 1500" lieferte nur die
-- ersten 1.500 NAMEN (" AdS IP Grassobbio..." bis "Aral Pulse") -- also fast nur
-- Betreiber mit A-Namen: 84 von 1.033 Betreibern, angefuehrt von Aral Pulse (409),
-- Allego (309 + 153), ALDI SUED (161); die groessten Betreiber fehlten
-- (EnBW 1.265 Ladepunkte im Ausschnitt, IZIVIA 816, EWE Go 662, Tesla 596). Raeumlich
-- war die Abdeckung dagegen weniger schlecht als vermutet (56 von 64 2x2-Grad-Zellen).
--
-- Fix: die UUID-Primaerschluessel sind zufaellig verteilt, "order by id limit N" ist
-- damit eine gleichmaessige Stichprobe ueber Betreiber UND Region. Gemessen: 297
-- Betreiber in der Stichprobe, proportional (EnBW 120 ~ 9,5 % von 1.265; IZIVIA 80 ~
-- 9,8 % von 816). Die Auswahl ist stabil (gleicher Ausschnitt -> gleiche Ladepunkte),
-- kein Flackern beim Schwenken. Kosten: gleiche Groessenordnung wie der Namens-Sort
-- (warm 7 ms bei beliebiger Leistung, 120 ms bei >= 150 kW; kalt 0,4-1,8 s).
--
-- Bewusst KEIN Grid-Sampling ("staerkster Lader je Zelle"): in Produktion gemessen
-- 9-16 s (alle Zeilen des Ausschnitts lesen und sortieren) bzw. > 20 s (ein
-- Index-Zugriff je Zelle) -- nicht tragfaehig. Die Auswahl bleibt eine Stichprobe
-- (~9 % bei sehr weitem Zoom); der Client weist darauf hin (Antwortfeld "truncated")
-- und laedt beim Hineinzoomen nach.
--
-- Signatur und alle SET-Klauseln (search_path, plan_cache_mode) unveraendert, nur die
-- drei ORDER-BY-Stellen: kein DROP noetig, kein doppelter Overload.
-- Lokal getestet; NICHT in Produktion angewendet/gemessen.
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
          and exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cp.external_key and ts.verdict = any(p_trailer_verdicts)
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
        order by cp.id
        limit p_limit;
    end if;
end;
$$;
