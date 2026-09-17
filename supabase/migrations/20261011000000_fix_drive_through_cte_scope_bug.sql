-- Bugfix fuer 20261010000000_trailer_report_drive_through_aggregation.sql:
-- in beiden Funktionen wurde die Drive-Through-Zaehlung
-- ("select count(*) filter (...) into v_dt_true_count, v_dt_false_count
-- from approved;") als EIGENE Anweisung NACH der ersten "with approved as
-- (...) select ... into ... from ranked r;" geschrieben. Eine CTE
-- (definiert per WITH) ist aber nur innerhalb der EINEN Anweisung
-- gueltig, zu der sie gehoert -- die zweite, separate Anweisung kennt
-- "approved" nicht mehr und wirft zur Laufzeit
-- "FEHLER: Relation »approved« existiert nicht". Da beide Funktionen
-- SECURITY DEFINER/plpgsql sind, rollt diese Exception die GESAMTE
-- Funktion zurueck -- inklusive des bereits erfolgten
-- enrich.trailer_report-Inserts. Sichtbar wurde das dadurch, dass eine
-- Admin-Bewertung mit "Drive-Through: Ja" in der App zwar
-- public.charging_reviews erreichte, aber nie enrich.trailer_report/
-- enrich.trailer_suitability -- addChargingReview() faengt den RPC-Fehler
-- bewusst nicht-fatal ab (nur console.error), dadurch blieb der Fehler in
-- der App unsichtbar (siehe src/app/ladepunkte/[id]/actions.ts).
--
-- Fix: die Drive-Through-Zaehlung als zusaetzliche Scalar-Subqueries in
-- dieselbe WITH/SELECT-Anweisung wie verdict/confirm_count/dispute_count
-- aufnehmen (genau wie es dort fuer confirm_count/dispute_count bereits
-- gemacht wird) statt in einer zweiten Anweisung erneut auf "approved"
-- zuzugreifen.

create or replace function enrich.submit_trailer_report(
    p_charge_point_key text,
    p_user_id uuid,
    p_display_name text,
    p_verdict text,
    p_drive_through boolean,
    p_notes text,
    p_photo_url text,
    p_rig_length_m numeric
) returns enrich.trailer_report
language plpgsql
security definer
set search_path = enrich, core, public
as $$
declare
    v_row enrich.trailer_report;
    v_is_admin boolean;
    v_verdict text;
    v_confirm_count int;
    v_dispute_count int;
    v_dt_true_count int;
    v_dt_false_count int;
    v_drive_through boolean;
begin
    if p_verdict not in ('yes', 'unhitch', 'no') then
        raise exception 'Ungueltiger verdict: %, erwartet yes/unhitch/no', p_verdict;
    end if;
    if not exists (select 1 from core.charge_point where external_key = p_charge_point_key) then
        raise exception 'Ladepunkt % nicht gefunden', p_charge_point_key;
    end if;

    insert into enrich.app_user (id, display_name)
    values (p_user_id, p_display_name)
    on conflict (id) do nothing;

    select coalesce((select is_admin from public.profiles where id = p_user_id), false) into v_is_admin;

    insert into enrich.trailer_report (
        charge_point_key, user_id, verdict, drive_through, notes, photo_url, rig_length_m, status
    ) values (
        p_charge_point_key, p_user_id, p_verdict, p_drive_through, p_notes, p_photo_url, p_rig_length_m,
        case when v_is_admin then 'approved' else 'pending' end
    )
    returning * into v_row;

    if v_is_admin then
        with approved as (
            select tr.verdict, tr.drive_through, coalesce(au.trust_level, 1) as trust_level
            from enrich.trailer_report tr
            left join enrich.app_user au on au.id = tr.user_id
            where tr.charge_point_key = p_charge_point_key and tr.status = 'approved'
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
               (select count(*)::int from approved a where a.verdict <> r.verdict),
               (select count(*)::int from approved a where a.drive_through = true),
               (select count(*)::int from approved a where a.drive_through = false)
        into v_verdict, v_confirm_count, v_dispute_count, v_dt_true_count, v_dt_false_count
        from ranked r;

        -- Admin-Antwort zaehlt sofort; ohne eigene Angabe greift die
        -- 2-Bestaetigungs-Mehrheit, sonst bleibt der bisherige Wert stehen.
        v_drive_through := case
            when p_drive_through is not null then p_drive_through
            when v_dt_true_count >= 2 and v_dt_true_count > v_dt_false_count then true
            when v_dt_false_count >= 2 and v_dt_false_count > v_dt_true_count then false
            else (select drive_through from enrich.trailer_suitability where charge_point_key = p_charge_point_key)
        end;

        insert into enrich.trailer_suitability (
            charge_point_key, verdict, drive_through, confirm_count, dispute_count,
            origin, verified_at, verified_by, updated_at
        ) values (
            p_charge_point_key, v_verdict, v_drive_through, v_confirm_count, v_dispute_count,
            'staff', now(), p_user_id, now()
        )
        on conflict (charge_point_key) do update set
            verdict = excluded.verdict,
            drive_through = excluded.drive_through,
            confirm_count = excluded.confirm_count,
            dispute_count = excluded.dispute_count,
            origin = excluded.origin,
            verified_at = excluded.verified_at,
            verified_by = excluded.verified_by,
            updated_at = now();
    end if;

    return v_row;
end;
$$;

grant execute on function enrich.submit_trailer_report(text, uuid, text, text, boolean, text, text, numeric) to authenticated;

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
    v_dt_true_count int;
    v_dt_false_count int;
    v_drive_through boolean;
begin
    if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
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
            select tr.verdict, tr.drive_through, coalesce(au.trust_level, 1) as trust_level
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
               (select count(*)::int from approved a where a.verdict <> r.verdict),
               (select count(*)::int from approved a where a.drive_through = true),
               (select count(*)::int from approved a where a.drive_through = false)
        into v_verdict, v_confirm_count, v_dispute_count, v_dt_true_count, v_dt_false_count
        from ranked r;

        -- Zwei gleichlautende Bestaetigungen setzen/aendern den Drive-
        -- Through-Flag, sonst bleibt der bisherige Wert unveraendert (siehe
        -- Kommentar in 20261010000000_trailer_report_drive_through_
        -- aggregation.sql).
        v_drive_through := case
            when v_dt_true_count >= 2 and v_dt_true_count > v_dt_false_count then true
            when v_dt_false_count >= 2 and v_dt_false_count > v_dt_true_count then false
            else (select drive_through from enrich.trailer_suitability where charge_point_key = v_key)
        end;

        insert into enrich.trailer_suitability (
            charge_point_key, verdict, drive_through, confirm_count, dispute_count,
            origin, verified_at, verified_by, updated_at
        ) values (
            v_key, v_verdict, v_drive_through, v_confirm_count, v_dispute_count,
            'community', now(), p_moderator_id, now()
        )
        on conflict (charge_point_key) do update set
            verdict = excluded.verdict,
            drive_through = excluded.drive_through,
            confirm_count = excluded.confirm_count,
            dispute_count = excluded.dispute_count,
            origin = excluded.origin,
            verified_at = excluded.verified_at,
            verified_by = excluded.verified_by,
            updated_at = now()
        where trailer_suitability.origin is distinct from 'admin_override';
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;

grant execute on function enrich.moderate_trailer_report(bigint, text, uuid) to authenticated;
