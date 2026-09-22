-- Nutzeranalyse (2026-09-22): von 8.855 offenen "Moegliche Dubletten
-- (Ladepunkte)"-Paaren haben 6.812 (77 %) zwei bekannte, eindeutig
-- unterschiedliche Betreiber (normalisierte Betreiber-Aehnlichkeit < 0.35)
-- -- das ist ueberwiegend KEIN unbearbeiteter Dubletten-Stau, sondern
-- echte, unabhaengige Ladepunkte verschiedener Betreiber am selben
-- Standort (z. B. mehrere CPOs an derselben Raststaette/demselben
-- Einkaufszentrum) -- per Stichprobe verifiziert (z. B. "IZIVIA FAST -
-- McDonald's" vs. "STATIONS-E" am selben McDonald's, "EWE Go GmbH" vs.
-- "Q1 Energie AG" 92m auseinander). Genau dieses Kriterium ("op_a <> op_b
-- UND similarity < 0.35 UND beide bekannt") verhindert schon seit
-- 20261021000000 ausdruecklich jeden Automerge fuer solche Paare
-- ("nutzerseitig explizit gefordert") -- sie sind vom System selbst
-- bereits als "kein Merge-Kandidat" erkannt, tauchten aber trotzdem als
-- "Auffaelligkeit" im Dashboard und im manuellen Dubletten-Dashboard auf.
--
-- Fix: core.refresh_quality_checks() wendet dasselbe, bereits etablierte
-- Kriterium jetzt auch auf den duplicate_charge_points-Check selbst an --
-- Paare mit eindeutigem Betreiberkonflikt zaehlen nicht mehr als offene
-- Auffaelligkeit und erscheinen nicht mehr in admin/app/(dashboard)/
-- ladestationen/dubletten (liest core.run_quality_checks(), das wiederum
-- nur noch core.quality_check_cache liest -- keine Aenderung an der
-- Admin-Seite selbst noetig). core.charge_point_duplicate (die Kandidaten-
-- Tabelle fuer den Automerge) bleibt UNVERAENDERT -- nur die Anzeige/
-- Zaehlung wird gefiltert, nicht die Kandidatengenerierung selbst.
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

    -- Betreiberkonflikt-Filter (siehe Migrationskommentar): dasselbe
    -- Kriterium wie core.auto_merge_charge_point_duplicates_batch()
    -- "operator_conflict" (20261021000000).
    insert into core.quality_check_cache (check_name, data)
    select 'duplicate_charge_points', to_jsonb(t) from (
        select d.key_a, d.key_b, d.operator_a, d.operator_b, d.distance_m
        from core.charge_point_duplicate d
        where not (
            core.normalize_operator_for_dedup(d.operator_a) is not null
            and core.normalize_operator_for_dedup(d.operator_b) is not null
            and core.normalize_operator_for_dedup(d.operator_a) <> core.normalize_operator_for_dedup(d.operator_b)
            and similarity(
                core.normalize_operator_for_dedup(d.operator_a),
                core.normalize_operator_for_dedup(d.operator_b)
            ) < 0.35
        )
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
  'Befuellt core.quality_check_cache neu (TRUNCATE + INSERT, eine Zeile je Treffer). duplicate_charge_points schliesst seit 20261024050000 Paare mit eindeutigem Betreiberkonflikt aus (77% der vorherigen Zahl, siehe Migrationskommentar -- ueberwiegend echte unabhaengige Ladepunkte verschiedener Betreiber, keine unbearbeitete Dubletten). Braucht bei aktueller Groesse mehrere Sekunden bis niedrige Minuten -- nur ueber pg_cron aufrufen (core.refresh_all_quality_data()), nie synchron aus der Admin-UI.';

-- Einmaliger Nachlauf, damit Dashboard/Dubletten-Seite sofort die korrigierte
-- Zahl zeigen, statt bis zum naechsten naechtlichen Cron-Lauf zu warten.
select core.refresh_quality_checks();
