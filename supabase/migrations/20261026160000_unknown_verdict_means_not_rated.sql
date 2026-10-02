-- "unknown" (Noch nicht bewertet) im Trailer-Filter = "ohne echte Bewertung", und
-- dadurch schnell: der unknown-Zweig prueft nur noch den winzigen Teilindex
-- idx_ts_meaningful (~2.500 Eintraege) statt je Kandidat die grosse Tabelle
-- enrich.trailer_suitability (137.287 Zeilen).
--
-- Bisher (EXISTS-Variante): ein Ladepunkt galt nur dann als 'unknown', wenn eine
-- Platzhalter-Zeile (verdict 'unknown') existiert. Das kostete je Kandidat einen
-- PK-Lookup in der grossen Tabelle (Produktion, padded Europa-Ausschnitt, 150 kW,
-- id-Stichprobe: 1,4 s / 1,4 s / 0,64 s -- vorher mit Namenssortierung ~77 ms), und
-- 23.650 aktive Ladepunkte (19 %) OHNE jede trailer_suitability-Zeile konnten durch
-- keinen Verdict-Filter erreicht werden, obwohl die Oberflaeche sie als "Noch nicht
-- bewertet" kennzeichnet (getReviewState(null) = getReviewState('auto')).
--
-- Jetzt: ein Ladepunkt passt zur Auswahl, wenn er KEINE echte Bewertung hat ODER
-- seine echte Bewertung ein Verdict aus der Liste traegt -- umgesetzt als
-- "not exists (echte Bewertung mit Verdict ausserhalb der Liste)". Echte Bewertung =
-- Nicht-Platzhalter (nicht: verdict 'unknown' und origin 'auto' ohne Notiz/
-- drive_through; 134.801 Platzhalter, 0 mit weiteren Daten -- geprueft). Das
-- Praedikat steht woertlich wie in idx_ts_meaningful (20261026150000), damit der
-- Planer den Teilindex nutzt.
--
-- Geaendert wird NUR der unknown-Zweig (Auswahl enthaelt 'unknown') in zwei
-- Funktionen -- beide, damit Karte (bbox) und Erstansicht (ohne Ausschnitt)
-- dieselbe Bedeutung haben:
--   * core.charge_points_in_bbox          (Kartenausschnitt, order by id)
--   * core.search_charge_points_by_verdict (Erstansicht ohne Ausschnitt)
-- Der selektive Zweig (nur yes/unhitch/no), der Zweig ohne Verdict-Filter, Signaturen,
-- SET-Klauseln (search_path, plan_cache_mode) und Grants bleiben unveraendert (create or
-- replace behaelt Kommentar und Rechte): kein DROP noetig, kein doppelter Overload.
-- Die Treffermenge von "Noch nicht bewertet" waechst um die Ladepunkte ohne Zeile.
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
        order by cp.id
        limit p_limit;
    end if;
end;
$$;

create or replace function core.search_charge_points_by_verdict(
    p_trailer_verdicts text[],
    p_q text default null,
    p_operators text[] default null,
    p_min_power_kw numeric default null,
    p_connector_standards text[] default null,
    p_limit integer default 5000
)
returns setof core.charge_point_geo
language plpgsql
stable
security invoker
as $$
begin
    if p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0
       and not ('unknown' = any(p_trailer_verdicts)) then
        -- Selektiver Fall (nur yes/unhitch/no, ~1,6 %): materialisierte CTE
        -- grenzt zuerst ueber idx_ts_verdict ein, bevor gejoint wird.
        return query
        with matching_keys as materialized (
            select charge_point_key
            from enrich.trailer_suitability
            where verdict = any(p_trailer_verdicts)
        )
        select cpg.*
        from core.charge_point_geo cpg
        join matching_keys mk on mk.charge_point_key = cpg.external_key
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
        order by cpg.name
        limit p_limit;
    elsif p_trailer_verdicts is not null and array_length(p_trailer_verdicts, 1) > 0 then
        -- Nicht-selektiver Fall ('unknown' enthalten, ~98,4 %+): einfaches
        -- EXISTS auf dem PK (charge_point_key), keine Materialisierung.
        return query
        select cpg.*
        from core.charge_point_geo cpg
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
          -- 'unknown' = noch nicht bewertet: ausgeschlossen werden nur Ladepunkte mit einer
          -- ECHTEN Bewertung (keine Platzhalter-Zeile), deren Verdict nicht in der Liste
          -- steht. Ladepunkte ohne echte Bewertung (inkl. solcher ganz ohne
          -- trailer_suitability-Zeile) zaehlen als 'unknown'. Das Praedikat der echten
          -- Bewertung muss WOERTLICH zu idx_ts_meaningful passen (Teilindex).
          and not exists (
            select 1 from enrich.trailer_suitability ts
            where ts.charge_point_key = cpg.external_key
              and not (ts.verdict = 'unknown' and ts.origin = 'auto' and ts.notes is null and ts.drive_through is null)
              and not (ts.verdict = any(p_trailer_verdicts))
          )
        order by cpg.name
        limit p_limit;
    else
        -- Kein Verdict-Filter: Verhalten wie core.search_charge_points().
        return query
        select cpg.*
        from core.charge_point_geo cpg
        where (p_q is null or cpg.name ilike '%' || p_q || '%')
          and (p_operators is null or cpg.operator = any(p_operators))
          and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
          and (
            p_connector_standards is null or exists (
              select 1 from core.connector c
              where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
            )
          )
        order by cpg.name
        limit p_limit;
    end if;
end;
$$;
