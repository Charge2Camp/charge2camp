-- Nutzerwunsch: Bewertet ein Admin-Nutzer (public.profiles.is_admin) in der
-- Haupt-App einen Ladepunkt (Anhaengertauglichkeits-Meldung ueber
-- enrich.submit_trailer_report(), aufgerufen aus addChargingReview in
-- src/app/ladepunkte/[id]/actions.ts sowie POST .../trailer/route.ts),
-- soll die Einstufung SOFORT als "geprueft" gelten -- ohne den ueblichen
-- Umweg ueber die Melde-/Moderationswarteschlange (enrich.trailer_report
-- status='pending', Freigabe unter /ladestationen/meldungen).
--
-- Fix: enrich.submit_trailer_report() prueft jetzt beim Einfuegen, ob
-- p_user_id ein Admin ist. Falls ja, wird die Meldung direkt mit
-- status='approved' gespeichert UND dieselbe gewichtete
-- Mehrheitsaggregation wie in enrich.moderate_trailer_report() bei
-- Freigabe sofort ausgefuehrt (Konsistenz: ein Admin, der spaeter eine
-- andere Meldung fuer denselben Ladepunkt freigibt, soll zum selben
-- Ergebnis kommen). origin='staff' macht den Ursprung erkennbar (siehe
-- origin-Konvention in enrich.trailer_suitability:
-- sascha_list|community|operator|staff|auto|admin_override|admin_bulk_upload).
-- Nicht-Admin-Nutzer durchlaufen weiterhin unveraendert die
-- Moderationswarteschlange.

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
            select tr.verdict, coalesce(au.trust_level, 1) as trust_level
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

        insert into enrich.trailer_suitability (
            charge_point_key, verdict, confirm_count, dispute_count,
            origin, verified_at, verified_by, updated_at
        ) values (
            p_charge_point_key, v_verdict, v_confirm_count, v_dispute_count,
            'staff', now(), p_user_id, now()
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

    return v_row;
end;
$$;
