-- Kritischer Bug nach dem IRVE/RIPREE-Import (20261016000000/20261017000000,
-- a1bb38d): core.charge_point ist von ca. 18.000 auf 179.870 Zeilen
-- gewachsen (Frankreich allein: 54.736 Stationen). Zwei dadurch ausgeloeste
-- Statement-Timeouts (57014):
--
-- 1. Ladepunkte-Seite (/ladepunkte, fetchChargingStations() in
--    src/lib/charging-stations.ts) sortiert core.charge_point_geo per
--    ".order('name').limit(...)" -- ohne Index auf charge_point.name
--    erzwingt das einen vollstaendigen Sort ueber alle aktiven Zeilen bei
--    JEDEM Aufruf. Gemessen (service_role, direkt gegen Prod): 5+ Sekunden
--    nur fuer "select id order by name limit 5" auf core.charge_point,
--    gegenueber 231ms fuer "order by id" (Primary-Key-Index). Betrifft auch
--    fetchChargingStationNameOptions()/fetchChargingStationOperatorOptions()
--    im selben Modul, die ebenfalls nach name sortieren.
--
-- 2. Admin-Dubletten-Dashboard (/ladestationen/dubletten) ruft
--    core.run_quality_checks() auf; der darin enthaltene
--    duplicate_charge_points-Check (20261014000000) ruft
--    core.charge_point_is_fast_charger(a.id) UND (b.id) fuer JEDES
--    Kandidatenpaar aus dem Self-Join einzeln auf -- jeder Aufruf ist eine
--    eigene korrelierte Subquery gegen core.connector bzw. core.charge_point.
--    Bei 10x mehr Zeilen als zuvor timet das RPC jetzt reproduzierbar aus
--    (gemessen: 9s bis 57014). Fix: die Schnelllader-Eigenschaft wird einmal
--    pro Station in einer CTE vorberechnet statt pro Kandidatenpaar neu
--    ausgewertet, UND der Self-Join nutzt zuerst den festen (indexnutzbaren)
--    Maximalradius von 100m ueber den GIST-Index auf geom, bevor der
--    tatsaechliche, von is_fast abhaengige Radius per WHERE nachgefiltert
--    wird -- der bisherige Code hatte den variablen Radius direkt in der
--    ST_DWITHIN-Join-Bedingung, was dem Planer die Indexnutzung erschwerte.

-- ---------------------------------------------------------------------------
-- Fix 1: Index fuer die name-Sortierung. Partiell auf is_active, weil
-- core.charge_point_geo (und damit jede App-Abfrage) ausschliesslich aktive
-- Stationen sieht -- siehe 20260909020000_campsite_charge_point_active_flag.sql.
--
-- Der Indexaufbau ueber 179.870 Zeilen dauert laenger als das
-- statement_timeout der Migrationsverbindung (erster Deploy-Versuch schlug
-- deshalb selbst mit 57014 fehl). Weder "set local" (zweiter Versuch) noch
-- session-weites "set" (dritter Versuch) griffen -- die Verbindung laeuft
-- vermutlich ueber Supabases Pooler im Transaction-Mode, der Session-State
-- NICHT ueber Anweisungsgrenzen hinweg garantiert (jede Anweisung kann an
-- ein anderes Backend gehen). Ein DO-Block ist dagegen aus Sicht des
-- Migrationsrunners EINE einzelne Anweisung/Transaktion -- SET LOCAL darin
-- gilt garantiert fuer den CREATE INDEX-Aufruf im selben Block.
-- ---------------------------------------------------------------------------
do $$
begin
    if not exists (select 1 from pg_indexes where schemaname = 'core' and indexname = 'idx_cp_active_name') then
        set local statement_timeout = '10min';
        create index idx_cp_active_name on core.charge_point (name) where is_active;
    end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Fix 2: duplicate_charge_points-Check in core.run_quality_checks()
-- optimiert, alle anderen neun Checks unveraendert uebernommen.
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

    -- 3. Dubletten Ladepunkte (quellenuebergreifend, kein Betreiber-Zwang --
    -- siehe 20261014000000). is_fast je Station einmal vorberechnet (CTE)
    -- statt per Kandidatenpaar ueber core.charge_point_is_fast_charger()
    -- neu ausgewertet -- das allein war bei 179k Zeilen der Grund fuer das
    -- Timeout. Self-Join zuerst ueber den festen, indexnutzbaren
    -- Maximalradius (100m, GIST-Index idx_cp_geom), tatsaechlicher Radius
    -- danach per WHERE.
    select 'duplicate_charge_points', to_jsonb(t) from (
        with fast_flag as (
            select cp.id,
                   coalesce(bool_or(c.current_type = 'DC'), cp.max_power_kw >= 43) as is_fast
            from core.charge_point cp
            left join core.connector c on c.charge_point_id = cp.id
            group by cp.id, cp.max_power_kw
        )
        select a.external_key as key_a, b.external_key as key_b,
               a.operator as operator_a, b.operator as operator_b,
               round(st_distance(a.geom, b.geom)::numeric, 1) as distance_m
        from core.charge_point a
        join fast_flag fa on fa.id = a.id
        join core.charge_point b
          on a.external_key < b.external_key
         and st_dwithin(a.geom, b.geom, 100)
        join fast_flag fb on fb.id = b.id
        where st_dwithin(
                a.geom, b.geom,
                case when fa.is_fast or fb.is_fast then 100 else 25 end
              )
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
