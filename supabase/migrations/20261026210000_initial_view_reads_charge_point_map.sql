-- Die Erstansicht der Ladepunkte-Seite (serverseitig gerendert) liest die schmale
-- Karten-Kopie core.charge_point_map statt der 431-MB-Haupttabelle.
--
-- Hintergrund: 20261026190000 hat core.charge_point_map eingefuehrt, weil core.charge_point
-- (431 MB Heap, 81 % einer Zeile = ungenutztes field_provenance) bei shared_buffers 224 MB
-- nicht in den Cache passt. Bisher las nur die Karten-Viewport-Abfrage die schmale Kopie;
-- die Erstansicht von /ladepunkte nutzte weiter die Haupttabelle. In Produktion gemessen
-- (erster Aufruf / warm): Standard-Erstansicht (search_charge_points_by_verdict, 150 kW,
-- yes+unhitch, Limit 300) 587 / 227 ms, 1.000 Namensvorschlaege 867 / 2 ms,
-- Betreiber-Optionen 483 / 66 ms -- die ersten Aufrufe nach Ruhephasen kosten zusammen
-- ueber eine Sekunde DB-Zeit, vor der Anreicherung.
--
-- Umgestellt (Signaturen/Rueckgabetypen unveraendert, create or replace, kein DROP):
--   * core.search_charge_points              -- "from core.charge_point_map" statt charge_point_geo
--   * core.search_charge_points_by_verdict   -- alle drei Zweige
--   * core.charge_point_operator_options     -- Zaehlung ueber die schmale Kopie
-- Rueckgabe von search_charge_points*: weiter "setof core.charge_point_geo" -- die Kopie hat
-- dieselben Spalten in derselben Reihenfolge (so schon in charge_points_in_bbox genutzt).
-- Zusaetzlich (Code, siehe fetchChargingStationNameOptions): die Namensliste liest die Kopie.
--
-- Neue Indizes auf core.charge_point_map fuer "order by name limit N" (die Erstansicht
-- sortiert nach Name; bisher idx_cp_active_name / idx_cp_active_fast_name der Haupttabelle):
--   * idx_cpm_name_op       (name) include (operator)  -- beliebige Leistung; Namensliste per
--                                                         Index-Only-Scan (name + operator)
--   * idx_cpm_fast_name     (name) where max_power_kw >= 150 -- Standard-Leistungsfilter
-- Grant: core.charge_point_map wurde bisher nur ueber security-definer-Funktionen gelesen;
-- die search_*-Funktionen laufen als security invoker (service_role), die Namensliste
-- liest direkt per PostgREST -- daher "grant select ... to service_role".
--
-- ACHTUNG, bewusste Abwaegung (wie in 20261026190000): die Erstansicht hinkt Aenderungen an
-- core.charge_point um bis zu 15 Minuten hinterher (Refresh per pg_cron); sie wird
-- ohnehin sofort durch den Karten-Viewport (gleiche Kopie) ersetzt, beide sind jetzt
-- konsistent. Favoriten, Detailseiten, Admin und die Campingplatz-Suche lesen weiter live.
-- Lokal gegen Hashes der bisherigen Ergebnisse getestet; NICHT in Produktion angewendet.

grant select on core.charge_point_map to service_role;

create index idx_cpm_name_op on core.charge_point_map (name) include (operator);
create index idx_cpm_fast_name on core.charge_point_map (name) where max_power_kw >= 150;
analyze core.charge_point_map;

create or replace function core.search_charge_points(
    p_q text default null,
    p_operators text[] default null,
    p_min_power_kw numeric default null,
    p_connector_standards text[] default null
)
returns setof core.charge_point_geo
language sql
stable
security invoker
as $$
    select cpg.*
    from core.charge_point_map cpg
    where (p_q is null or cpg.name ilike '%' || p_q || '%')
      and (p_operators is null or cpg.operator = any(p_operators))
      and (p_min_power_kw is null or cpg.max_power_kw >= p_min_power_kw)
      and (
        p_connector_standards is null or exists (
          select 1 from core.connector c
          where c.charge_point_id = cpg.id and c.standard = any(p_connector_standards)
        )
      )
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
        from core.charge_point_map cpg
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
        from core.charge_point_map cpg
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
        from core.charge_point_map cpg
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

create or replace function core.charge_point_operator_options(p_min_stations int default 5)
returns table (
    operator text,
    station_count bigint
)
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select cp.operator, count(*) as station_count
    from core.charge_point_map cp
    where cp.operator is not null
      and cp.is_active = true
      and cp.operator !~ '^\(.*\)$'
    group by cp.operator
    having count(*) >= p_min_stations
    order by cp.operator;
end;
$$;
