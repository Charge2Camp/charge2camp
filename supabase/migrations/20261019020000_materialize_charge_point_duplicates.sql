-- Fortsetzung von 20261019010000: der duplicate_charge_points-Check bleibt
-- selbst nach Index + CTE-Vorberechnung + Cross-Source-Filter + KNN-LATERAL-
-- Limit zu langsam fuer eine synchrone Anfrage -- gemessen (service_role,
-- direkt gegen Prod): 200 OCM-Stationen (von 63.239 insgesamt) brauchen
-- 906ms, hochgerechnet auf alle OCM-Stationen also ca. 4-5 Minuten. Das
-- Service-Role/PostgREST-Statement-Timeout liegt bei ca. 8-9s (durchgaengig
-- reproduziert, auch ueber den Session-Pooler und den Studio-SQL-Editor --
-- SET statement_timeout wirkt dort nachweislich nicht). Eine echte
-- Direktverbindung (die das umgehen wuerde) ist von der Entwicklungsumgebung
-- aus nicht erreichbar (IPv6-only, kein Route). Deshalb: der Check wird
-- nicht mehr live pro Seitenaufruf berechnet, sondern in einer Tabelle
-- vorberechnet (core.charge_point_duplicate) und per pg_cron regelmaessig
-- aktualisiert -- pg_cron laeuft als Hintergrund-Worker direkt im
-- Datenbankprozess, ausserhalb jeder Client-Verbindung, und ist deshalb von
-- obigem Timeout nicht betroffen.
--
-- Scope-Einschraenkung ggue. der bisherigen Implementierung (alle Paare
-- ueber alle 234k Ladepunkte): nur noch OCM (niedrige Prioritaet, 63.239
-- Stationen) als aeussere Seite gegen alle anderen Quellen -- das deckt
-- exakt den in 20261019000000/20261014000000 beschriebenen Anwendungsfall
-- ab (OCM-Stationen, die in eine hoeher priorisierte nationale Quelle
-- absorbiert/gemerged werden koennen). BNetzA/IRVE/RIPREE koennen sich
-- geografisch (DE/FR/ES) ohnehin praktisch nicht ueberschneiden. Pro
-- OCM-Station werden nur die 15 naechstgelegenen quellenfremden Kandidaten
-- betrachtet (KNU-Index-Order + LIMIT) statt aller Nachbarn im Umkreis --
-- bei sehr dichten Hubs (durchschnittlich 151 Nachbarn/Station im 100m-
-- Radius, vermutlich einzeln erfasste Anschluesse derselben Ladestation)
-- explodierte die reine Umkreissuche sonst auf ueber 20 Mio. Kandidatenpaare.

create table core.charge_point_duplicate (
    key_a text not null,
    key_b text not null,
    operator_a text,
    operator_b text,
    distance_m numeric not null,
    computed_at timestamptz not null default now(),
    primary key (key_a, key_b)
);

comment on table core.charge_point_duplicate is
  'Vorberechnetes Ergebnis des OCM-vs-nationale-Quelle Dubletten-Checks, siehe core.refresh_charge_point_duplicates() (20261019020000). Wird von core.run_quality_checks() nur noch gelesen, nicht mehr live berechnet -- die Live-Variante timet bei 234k Ladepunkten reproduzierbar aus.';

grant select on core.charge_point_duplicate to service_role;

create or replace function core.refresh_charge_point_duplicates()
returns void
language plpgsql
security definer
set search_path = core, public
as $$
begin
    truncate table core.charge_point_duplicate;

    insert into core.charge_point_duplicate (key_a, key_b, operator_a, operator_b, distance_m)
    select a.external_key, b.external_key, a.operator, b.operator,
           round(st_distance(a.geom, b.geom)::numeric, 1)
    from (select * from core.charge_point where source = 'ocm') a
    cross join lateral (
        select b.external_key, b.geom, b.operator,
               coalesce(
                 (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = b.id),
                 b.max_power_kw >= 43
               ) as b_is_fast
        from core.charge_point b
        where b.source <> a.source
          and st_dwithin(a.geom, b.geom, 100)
        order by a.geom <-> b.geom
        limit 15
    ) b
    where st_dwithin(
        a.geom, b.geom,
        case when coalesce(
                    (select bool_or(c.current_type = 'DC') from core.connector c where c.charge_point_id = a.id),
                    a.max_power_kw >= 43
                  ) or b.b_is_fast
             then 100 else 25 end
    );
end;
$$;

comment on function core.refresh_charge_point_duplicates() is
  'Befuellt core.charge_point_duplicate neu (TRUNCATE + INSERT). Braucht bei ca. 63k OCM-Stationen mehrere Minuten -- nur ueber pg_cron aufrufen (siehe unten), nie synchron aus der App/Admin heraus (PostgREST/service_role-Statement-Timeout liegt bei ca. 8-9s).';

grant execute on function core.refresh_charge_point_duplicates() to service_role;

-- Hintergrund-Job: laeuft als Datenbank-interner Worker, nicht ueber
-- PostgREST/den Pooler, deshalb vom Statement-Timeout obiger Verbindungen
-- unbetroffen. Taeglich um 03:00 UTC (auserhalb der ueblichen Import-
-- Fensterzeiten, siehe ingest/README.md) -- fuer eine sofortige Aktualisierung
-- nach einem manuellen Import kann core.refresh_charge_point_duplicates()
-- weiterhin jederzeit direkt aufgerufen werden, nur eben nicht synchron aus
-- der Admin-UI heraus erwartet.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
    'refresh-charge-point-duplicates',
    '0 3 * * *',
    $$select core.refresh_charge_point_duplicates()$$
);

-- ---------------------------------------------------------------------------
-- core.run_quality_checks(): duplicate_charge_points liest ab jetzt nur noch
-- die vorberechnete Tabelle (Millisekunden) statt live zu joinen. Alle
-- anderen neun Checks unveraendert aus 20261019010000 uebernommen.
-- ---------------------------------------------------------------------------
create or replace function core.run_quality_checks()
returns table(check_name text, data jsonb)
language plpgsql
stable
security definer
set search_path = core, enrich, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select * from (

    -- 1. Abdeckung je Land
    select 'coverage_by_country' as check_name, to_jsonb(t) as data from (
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

    -- 3. Dubletten Ladepunkte -- vorberechnet, siehe
    -- core.refresh_charge_point_duplicates() (20261019020000).
    select 'duplicate_charge_points', to_jsonb(t) from (
        select key_a, key_b, operator_a, operator_b, distance_m
        from core.charge_point_duplicate
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

    ) combined;
end;
$$;

-- Aufraeumen der Debug-Funktion aus der Diagnose-Sitzung (20261019010000/
-- 20261019020000 -- core.debug_dup_count() wurde nur interaktiv ueber den
-- SQL-Editor genutzt, um die Laufzeit-Hypothesen zu pruefen).
drop function if exists core.debug_dup_count();
