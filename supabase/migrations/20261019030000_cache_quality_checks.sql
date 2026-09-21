-- Fortsetzung von 20261019020000: nach der Materialisierung von
-- duplicate_charge_points blieben die restlichen neun Checks in
-- core.run_quality_checks() weiterhin zu langsam -- gemessen (SQL-Editor,
-- EXPLAIN ANALYZE): ein blosser Sequential Scan ueber core.charge_point
-- (234.587 Zeilen, 382 MB) braucht bereits 9,37s Ausfuehrungszeit, VOR
-- jeder weiteren Verarbeitung (0 tote Zeilen, keine blockierenden Queries --
-- das ist echter I/O-Durchsatz der Instanz, kein Bloat/Lock-Problem).
-- Jeder Check, der core.charge_point vollstaendig lesen muss
-- (coverage_by_country, coordinate_plausibility, stale_records), liegt
-- damit strukturell ueber dem PostgREST/service_role-Statement-Timeout
-- (~8-9s) -- unabhaengig davon, wie die einzelne Query optimiert ist.
--
-- Fix: dasselbe Muster wie bei core.charge_point_duplicate (20261019020000)
-- auf die GESAMTE run_quality_checks()-Ausgabe angewendet -- Ergebnis wird
-- per pg_cron im Hintergrund vorberechnet und gecacht, die App liest nur
-- noch die fertige Cache-Tabelle (Millisekunden statt >9s), unabhaengig von
-- der Tabellengroesse. Die Cache-Tabelle spiegelt bewusst EXAKT die
-- bisherige Zeilenform von run_quality_checks() (eine Zeile je Treffer,
-- nicht aggregiert) -- admin/app/(dashboard)/ladestationen/dubletten/
-- page.tsx liest z.B. jede duplicate_charge_points-Zeile einzeln als
-- DuplicateRow (.map((r) => r.data as DuplicateRow)), damit bleibt die
-- Admin-Seite unveraendert.

create table core.quality_check_cache (
    id bigint generated always as identity primary key,
    check_name text not null,
    data jsonb not null,
    computed_at timestamptz not null default now()
);

create index idx_qcc_check_name on core.quality_check_cache (check_name);

comment on table core.quality_check_cache is
  'Vorberechnetes Ergebnis von core.refresh_quality_checks() (20261019030000), eine Zeile je Treffer -- exakt die bisherige Zeilenform von core.run_quality_checks(). Grund: ein blosser Sequential Scan ueber core.charge_point dauert bei aktueller Groesse (234k Zeilen) bereits >9s (I/O-Durchsatz der Instanz), also laenger als das PostgREST-Statement-Timeout -- live berechnen ist bei dieser Datenmenge synchron nicht mehr moeglich.';

grant select on core.quality_check_cache to service_role;

-- Fuehrt exakt die zehn Checks aus der bisherigen core.run_quality_checks()
-- (20261019010000/20261014000000/20260917000000) aus und schreibt jeden
-- Treffer als eigene Zeile in core.quality_check_cache. Braucht bei
-- aktueller Groesse mehrere Sekunden bis niedrige Minuten -- nur ueber
-- pg_cron aufrufen, siehe core.refresh_all_quality_data() unten.
create or replace function core.refresh_quality_checks()
returns void
language plpgsql
security definer
set search_path = core, enrich, public
as $$
begin
    truncate table core.quality_check_cache;

    insert into core.quality_check_cache (check_name, data)
    select 'coverage_by_country', to_jsonb(t) from (
        select
            cp.country_code,
            count(*) as total,
            count(*) filter (where ts.verdict = 'yes')     as verdict_yes,
            count(*) filter (where ts.verdict = 'unhitch') as verdict_unhitch,
            count(*) filter (where ts.verdict = 'no')       as verdict_no,
            count(*) filter (where ts.verdict is null or ts.verdict = 'unknown') as verdict_unknown,
            round(100.0 * count(*) filter (where ts.verdict is not null and ts.verdict <> 'unknown')
                  / nullif(count(*), 0), 1) as coverage_percent
        from core.charge_point cp
        left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
        group by cp.country_code
        order by cp.country_code
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'coordinate_plausibility', to_jsonb(t) from (
        select 'charge_point' as entity_type, external_key, country_code,
               st_y(geom::geometry) as lat, st_x(geom::geometry) as lon
        from core.charge_point
        where (st_y(geom::geometry) = 0 and st_x(geom::geometry) = 0)
           or (country_code is not null
               and (st_y(geom::geometry) not between 34 and 72
                    or st_x(geom::geometry) not between -25 and 45))
        union all
        select 'campsite', external_key, country_code,
               st_y(geom::geometry), st_x(geom::geometry)
        from core.campsite
        where (st_y(geom::geometry) = 0 and st_x(geom::geometry) = 0)
           or (country_code is not null
               and (st_y(geom::geometry) not between 34 and 72
                    or st_x(geom::geometry) not between -25 and 45))
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'duplicate_charge_points', to_jsonb(t) from (
        select key_a, key_b, operator_a, operator_b, distance_m
        from core.charge_point_duplicate
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'duplicate_campsites', to_jsonb(t) from (
        select a.external_key as key_a, b.external_key as key_b, a.name,
               round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m,
               round(similarity(a.name, b.name)::numeric, 2) as name_similarity
        from core.campsite a
        join core.campsite b
          on a.external_key < b.external_key
         and st_dwithin(a.geom, b.geom, 300)
         and similarity(a.name, b.name) > 0.4
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'orphaned_enrichment', to_jsonb(t) from (
        select 'trailer_suitability' as source_table, charge_point_key as external_key
        from enrich.trailer_suitability ts
        where not exists (select 1 from core.charge_point cp where cp.external_key = ts.charge_point_key)
        union all
        select 'campsite_charging', campsite_key
        from enrich.campsite_charging ecc
        where not exists (select 1 from core.campsite cs where cs.external_key = ecc.campsite_key)
        union all
        select 'research_task', campsite_key
        from enrich.research_task rt
        where not exists (select 1 from core.campsite cs where cs.external_key = rt.campsite_key)
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'stale_records', to_jsonb(t) from (
        select 'charge_point' as entity_type, external_key, last_seen_at
        from core.charge_point where last_seen_at < now() - interval '14 days'
        union all
        select 'campsite', external_key, last_seen_at
        from core.campsite where last_seen_at < now() - interval '14 days'
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'disputed_verdicts', to_jsonb(t) from (
        select charge_point_key, verdict, confirm_count, dispute_count
        from enrich.trailer_suitability
        where dispute_count >= 2 and dispute_count >= confirm_count
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'link_sanity', to_jsonb(t) from (
        select campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m,
               round((walk_distance_m::numeric / nullif(air_distance_m, 0)), 2) as detour_factor
        from core.campsite_charge_link
        where walk_distance_m is not null
          and (walk_distance_m < air_distance_m - 20
               or walk_distance_m::numeric / nullif(air_distance_m, 0) > 4)
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'amenity_fill_rate', to_jsonb(t) from (
        select a.key as amenity_key,
               count(ca.campsite_id) as filled_count,
               (select count(*) from core.campsite) as total_campsites,
               round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) as fill_percent
        from core.amenity a
        left join core.campsite_amenity ca on ca.amenity_key = a.key and ca.value_bool is true
        group by a.key
        having round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) < 30
    ) t;

    insert into core.quality_check_cache (check_name, data)
    select 'research_progress', to_jsonb(t) from (
        select cs.country_code,
               count(*) filter (where rt.status = 'done') as done,
               count(*) filter (where rt.status <> 'done') as open,
               count(*) as total
        from enrich.research_task rt
        join core.campsite cs on cs.external_key = rt.campsite_key
        group by cs.country_code
        order by cs.country_code
    ) t;
end;
$$;

comment on function core.refresh_quality_checks() is
  'Befuellt core.quality_check_cache neu (TRUNCATE + INSERT, eine Zeile je Treffer). Braucht bei aktueller Groesse mehrere Sekunden bis niedrige Minuten -- nur ueber pg_cron aufrufen (core.refresh_all_quality_data()), nie synchron aus der Admin-UI.';

grant execute on function core.refresh_quality_checks() to service_role;

-- Ein Cron-Einstiegspunkt fuer beide Refreshes (Dubletten + restliche
-- Checks), ersetzt den einzelnen refresh-charge-point-duplicates-Job aus
-- 20261019020000.
create or replace function core.refresh_all_quality_data()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    perform core.refresh_charge_point_duplicates();
    perform core.refresh_quality_checks();
end;
$$;

grant execute on function core.refresh_all_quality_data() to service_role;

select cron.unschedule('refresh-charge-point-duplicates');
select cron.schedule(
    'refresh-all-quality-data',
    '0 3 * * *',
    $$select core.refresh_all_quality_data()$$
);

-- ---------------------------------------------------------------------------
-- core.run_quality_checks(): liest jetzt nur noch core.quality_check_cache
-- (Millisekunden) statt irgendetwas live zu berechnen. Gleiche Rueckgabeform
-- wie bisher (check_name, data mit data = einem Treffer je Zeile).
-- ---------------------------------------------------------------------------
create or replace function core.run_quality_checks()
returns table(check_name text, data jsonb)
language plpgsql
stable
security definer
set search_path = core, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query select qcc.check_name, qcc.data from core.quality_check_cache qcc;
end;
$$;
