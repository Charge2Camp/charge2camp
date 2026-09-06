-- Auftrag F -- Datenqualitaet (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt 11).
-- Buendelt die zehn Abfragen aus sql/90_quality_checks.sql als eine
-- Postgres-Funktion, damit GET /api/admin/quality-report sie in EINEM
-- PostgREST-Aufruf abrufen kann (statt zehn Einzelabfragen ueber die
-- Route Handler-Supabase-Clients). Bei Aenderungen an den Abfragen beide
-- Stellen synchron halten (siehe Kommentar in sql/90_quality_checks.sql).
create or replace function core.run_quality_checks()
returns table(check_name text, data jsonb)
language sql
stable
security definer
set search_path = core, enrich, public
as $$

-- 1. Abdeckung je Land
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
) t

union all

-- 2. Koordinaten-Plausibilitaet
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
) t

union all

-- 3. Dubletten Ladepunkte
select 'duplicate_charge_points', to_jsonb(t) from (
    select a.external_key as key_a, b.external_key as key_b, a.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m
    from core.charge_point a
    join core.charge_point b
      on a.external_key < b.external_key
     and a.operator is not distinct from b.operator
     and st_dwithin(a.geom, b.geom, 25)
) t

union all

-- 4. Dubletten Campingplaetze
select 'duplicate_campsites', to_jsonb(t) from (
    select a.external_key as key_a, b.external_key as key_b, a.name,
           round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m,
           round(similarity(a.name, b.name)::numeric, 2) as name_similarity
    from core.campsite a
    join core.campsite b
      on a.external_key < b.external_key
     and st_dwithin(a.geom, b.geom, 300)
     and similarity(a.name, b.name) > 0.4
) t

union all

-- 5. Verwaiste Anreicherung
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
) t

union all

-- 6. Veraltete Datensaetze
select 'stale_records', to_jsonb(t) from (
    select 'charge_point' as entity_type, external_key, last_seen_at
    from core.charge_point where last_seen_at < now() - interval '14 days'
    union all
    select 'campsite', external_key, last_seen_at
    from core.campsite where last_seen_at < now() - interval '14 days'
) t

union all

-- 7. Widersprueche
select 'disputed_verdicts', to_jsonb(t) from (
    select charge_point_key, verdict, confirm_count, dispute_count
    from enrich.trailer_suitability
    where dispute_count >= 2 and dispute_count >= confirm_count
) t

union all

-- 8. Verknuepfungs-Sanity
select 'link_sanity', to_jsonb(t) from (
    select campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m,
           round((walk_distance_m::numeric / nullif(air_distance_m, 0)), 2) as detour_factor
    from core.campsite_charge_link
    where walk_distance_m is not null
      and (walk_distance_m < air_distance_m - 20
           or walk_distance_m::numeric / nullif(air_distance_m, 0) > 4)
) t

union all

-- 9. Fuellgrad je Merkmal (< 30%)
select 'amenity_fill_rate', to_jsonb(t) from (
    select a.key as amenity_key,
           count(ca.campsite_id) as filled_count,
           (select count(*) from core.campsite) as total_campsites,
           round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) as fill_percent
    from core.amenity a
    left join core.campsite_amenity ca on ca.amenity_key = a.key and ca.value_bool is true
    group by a.key
    having round(100.0 * count(ca.campsite_id) / nullif((select count(*) from core.campsite), 0), 1) < 30
) t

union all

-- 10. Recherche-Fortschritt
select 'research_progress', to_jsonb(t) from (
    select cs.country_code,
           count(*) filter (where rt.status = 'done') as done,
           count(*) filter (where rt.status <> 'done') as open,
           count(*) as total
    from enrich.research_task rt
    join core.campsite cs on cs.external_key = rt.campsite_key
    group by cs.country_code
    order by cs.country_code
) t

$$;

-- Nur eingeloggte Nutzer duerfen den Bericht abrufen -- die eigentliche
-- Admin-Pruefung (profiles.is_admin) macht der Route Handler, hier nur
-- der PostgREST-Grundzugriff.
grant execute on function core.run_quality_checks() to authenticated;
