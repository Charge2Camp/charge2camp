-- Bug: 20260927000000_security_hardening_admin_rpcs.sql fuegte allen vier
-- Admin-RPCs eine "if not exists (... where id = auth.uid() and is_admin)"
-- Pruefung hinzu, um zu verhindern, dass ein eingeloggter Nicht-Admin die
-- Funktion per direktem PostgREST-RPC-Aufruf umgeht. Betroffen sind aber
-- auch enrich.moderate_trailer_report und core.research_queue/
-- run_quality_checks, die vom Admin-Backend (admin/) IMMER ueber den
-- Service-Role-Client aufgerufen werden (admin/lib/supabase/service.ts) --
-- dort gibt es keinen eingeloggten Supabase-Auth-User, auth.uid() liefert
-- NULL, die Pruefung schlaegt IMMER fehl ("Kein Admin-Zugriff."), obwohl
-- admin/lib/require-admin.ts bereits VOR jedem Aufruf profiles.is_admin
-- geprueft hat. Sichtbar als "This page couldn't load / A server error
-- occurred" beim Bestaetigen/Ablehnen einer Meldung, sowie (gleicher Bug)
-- auf dem Dashboard (run_quality_checks) und der Recherche-Seite
-- (research_queue).
--
-- Fix: Service-Role-Aufrufe (auth.role() = 'service_role', kein JWT "sub")
-- von der auth.uid()-Pruefung ausnehmen -- die eigentliche Admin-Pruefung
-- liegt fuer diese Aufrufer bereits zuverlaessig in requireAdmin() (Next.js
-- Server Component/Action, laeuft IMMER vor dem RPC-Aufruf). Der
-- urspruengliche Fix-Zweck (Bypass durch einen eingeloggten
-- Nicht-Admin-Endnutzer ueber authenticated-Rolle) bleibt bestehen: fuer
-- role='authenticated' wird weiterhin auth.uid() gegen profiles.is_admin
-- geprueft. enrich.submit_campsite_charging bleibt unveraendert -- die
-- wird ausschliesslich ueber die Haupt-App-Route mit echter Nutzer-Session
-- aufgerufen (src/app/api/enrich/campsites/[external_key]/charging/
-- route.ts), dort ist auth.uid() korrekt gesetzt.

create or replace function enrich.moderate_trailer_report(
    p_report_id bigint,
    p_decision text,
    p_moderator_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = enrich, core, public
as $$
declare
    v_report enrich.trailer_report;
    v_key text;
    v_new_status text;
    v_verdict text;
    v_confirm_count int;
    v_dispute_count int;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    if p_decision not in ('approve', 'reject') then
        raise exception 'Ungueltige decision: %, erwartet approve oder reject', p_decision;
    end if;

    select * into v_report from enrich.trailer_report where id = p_report_id for update;
    if not found then
        raise exception 'trailer_report % nicht gefunden', p_report_id;
    end if;
    if v_report.status <> 'pending' then
        raise exception 'trailer_report % bereits moderiert (status=%)', p_report_id, v_report.status;
    end if;

    v_new_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
    update enrich.trailer_report set status = v_new_status where id = p_report_id;
    v_key := v_report.charge_point_key;

    if p_decision = 'approve' then
        insert into enrich.app_user (id, display_name) values (p_moderator_id, null) on conflict (id) do nothing;

        with approved as (
            select tr.verdict, coalesce(au.trust_level, 1) as trust_level
            from enrich.trailer_report tr
            left join enrich.app_user au on au.id = tr.user_id
            where tr.charge_point_key = v_key and tr.status = 'approved'
        ),
        weighted as (
            select verdict, sum(trust_level) as weight
            from approved
            group by verdict
        ),
        ranked as (
            select verdict, weight,
                   case verdict when 'no' then 0 when 'unhitch' then 1 when 'yes' then 2 else 3 end as conservativeness
            from weighted
            order by weight desc, conservativeness asc
            limit 1
        )
        select r.verdict,
               (select count(*)::int from approved a where a.verdict = r.verdict),
               (select count(*)::int from approved a where a.verdict <> r.verdict)
        into v_verdict, v_confirm_count, v_dispute_count
        from ranked r;

        insert into enrich.trailer_suitability (
            charge_point_key, verdict, confirm_count, dispute_count,
            origin, verified_at, verified_by, updated_at
        ) values (
            v_key, v_verdict, v_confirm_count, v_dispute_count,
            'community', now(), p_moderator_id, now()
        )
        on conflict (charge_point_key) do update set
            verdict = excluded.verdict,
            confirm_count = excluded.confirm_count,
            dispute_count = excluded.dispute_count,
            origin = excluded.origin,
            verified_at = excluded.verified_at,
            verified_by = excluded.verified_by,
            updated_at = now();
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;

create or replace function core.research_queue()
returns table (
    external_key text,
    name text,
    website text,
    country_code text,
    city text,
    reason text,
    recheck_after date
)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select cs.external_key, cs.name, cs.website, cs.country_code, cs.city,
           'never_researched'::text as reason, null::date as recheck_after
    from core.campsite cs
    where cs.website is not null
      and not exists (
          select 1 from enrich.campsite_charging ecc where ecc.campsite_key = cs.external_key
      )
    union all
    select cs.external_key, cs.name, cs.website, cs.country_code, cs.city,
           'recheck_due'::text as reason, ecc.recheck_after
    from enrich.campsite_charging ecc
    join core.campsite cs on cs.external_key = ecc.campsite_key
    where ecc.recheck_after < current_date
    order by country_code, city;
end;
$$;

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

    ) combined;
end;
$$;
