-- enrich.moderate_trailer_report() (20260918000000_enrichment_endpoints.sql)
-- schrieb bei "approve" die gewichtete Community-Mehrheit bedingungslos in
-- enrich.trailer_suitability, inkl. origin = 'community' -- das ueberschrieb
-- eine bereits per Admin-Formular gesetzte manuelle Korrektur
-- (origin = 'admin_override', siehe admin/.../ladestationen/[id]/actions.ts
-- overrideTrailerSuitability) beim Freigeben einer ALTEN, laengst
-- ueberholten Meldung wieder kommentarlos. Nutzerfeedback: Admin-Korrekturen
-- duerfen generell nie automatisch/ohne Ruecksprache verloren gehen --
-- gleiches Prinzip wie core.charge_point.manual_override beim OCM-Reimport
-- (siehe 20261001000000_charge_point_manual_override.sql).
--
-- Ein per admin_override fixierter Ladepunkt bleibt jetzt fixiert, bis ein
-- Admin ihn ueber das Formular explizit wieder aendert (was automatisch
-- erneut origin = 'admin_override' setzt) -- die Moderationswarteschlange
-- kann ihn nicht mehr stillschweigend zuruecksetzen.
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
            updated_at = now()
        where trailer_suitability.origin is distinct from 'admin_override';
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;
