-- Nutzerwunsch: Im Bewertungsformular ("Ladesäule bewerten", addChargingReview
-- in src/app/ladepunkte/[id]/actions.ts) fehlte die Abfrage, ob man mit dem
-- Gespann durchfahren kann (Drive-Through), obwohl enrich.trailer_report/
-- enrich.trailer_suitability.drive_through dafuer bereits seit
-- 20260909011000_data_layer_schema.sql existieren und
-- enrich.submit_trailer_report() den Parameter p_drive_through schon
-- entgegennahm -- die App schickte bisher aber immer NUR null, und selbst
-- wenn ein Wert ankaeme, haben weder enrich.submit_trailer_report()
-- (Admin-Sofortpfad) noch enrich.moderate_trailer_report()
-- (Community-Freigabepfad) drive_through jemals in
-- enrich.trailer_suitability geschrieben -- nur verdict/confirm_count/
-- dispute_count. Das Formular fragt Drive-Through jetzt ab (nur wenn
-- suitable='yes', siehe review-form.tsx) und beide Funktionen aggregieren
-- den Wert jetzt mit:
--   - Community (moderate_trailer_report bei Freigabe einer Meldung, sowie
--     der Nicht-Admin-Teil von submit_trailer_report indirekt ueber die
--     Warteschlange): einfache Mehrheit ALLER freigegebenen Meldungen mit
--     gesetztem drive_through fuer diesen Ladepunkt, aber erst ab
--     mindestens 2 gleichlautenden Bestaetigungen -- sonst bleibt der
--     bisherige Wert unveraendert stehen (kein Zuruecksetzen auf
--     "ungeklaert" durch eine einzelne abweichende Meldung).
--   - Admin (submit_trailer_report, Bewertung direkt in der Haupt-App):
--     die eigene Antwort gilt sofort, analog zur bereits bestehenden
--     Sofort-Freigabe des verdict in 20260930010000_admin_trailer_report_
--     auto_approve.sql ("wenn ein Admin, dann sofort"). Antwortet der Admin
--     nicht auf die Drive-Through-Frage (p_drive_through ist null), greift
--     dieselbe 2-Bestaetigungs-Mehrheit wie im Community-Pfad, damit ein
--     Admin, der nur den verdict bestaetigt, keine vorhandene
--     Community-Mehrheit ueberschreibt.
--
-- Zusaetzlich: enrich.moderate_trailer_report() hat seit
-- 20261001010000_protect_admin_override_from_moderation.sql keine
-- Admin-Pruefung (public.profiles.is_admin) mehr im Funktionskoerper --
-- beim Kopieren des Funktionsrumpfs fuer den admin_override-Schutz ist die
-- in 20260927000000_security_hardening_admin_rpcs.sql eingefuehrte
-- Defense-in-Depth-Pruefung versehentlich unter den Tisch gefallen. Da
-- diese Migration die Funktion ohnehin neu definiert, wird die Pruefung
-- hier wiederhergestellt.

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
               (select count(*)::int from approved a where a.verdict <> r.verdict)
        into v_verdict, v_confirm_count, v_dispute_count
        from ranked r;

        select count(*) filter (where drive_through), count(*) filter (where drive_through = false)
        into v_dt_true_count, v_dt_false_count
        from approved;

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
               (select count(*)::int from approved a where a.verdict <> r.verdict)
        into v_verdict, v_confirm_count, v_dispute_count
        from ranked r;

        select count(*) filter (where drive_through), count(*) filter (where drive_through = false)
        into v_dt_true_count, v_dt_false_count
        from approved;

        -- Zwei gleichlautende Bestaetigungen setzen/aendern den Drive-
        -- Through-Flag, sonst bleibt der bisherige Wert unveraendert (siehe
        -- Migrationskommentar oben).
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
