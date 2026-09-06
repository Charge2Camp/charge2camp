-- Auftrag D -- Anreicherungs-Endpunkte (siehe CLAUDE_CODE_AUFTRAG.md
-- Abschnitt 9, "Anreicherungs-Endpunkte" + "Aggregationsregel
-- Anhaengertauglichkeit"). Schreibende Funktionen als SECURITY DEFINER,
-- da es fuer enrich.* bewusst keine INSERT/UPDATE-RLS-Policies gibt (nur
-- die "readable by everyone"-SELECT-Policies aus
-- 20260915000000_data_layer_api_exposure.sql) -- die eigentliche
-- Berechtigungspruefung (eingeloggt vs. Admin) macht der jeweilige Route
-- Handler VOR dem RPC-Aufruf, siehe docs/api.md.

-- ============================================================
-- POST /api/enrich/charge-points/{key}/trailer
-- Community-Meldung zur Anhaengertauglichkeit, Status 'pending' bis ein
-- Admin sie ueber moderate_trailer_report() freigibt/ablehnt.
-- ============================================================
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

    insert into enrich.trailer_report (
        charge_point_key, user_id, verdict, drive_through, notes, photo_url, rig_length_m, status
    ) values (
        p_charge_point_key, p_user_id, p_verdict, p_drive_through, p_notes, p_photo_url, p_rig_length_m, 'pending'
    )
    returning * into v_row;

    return v_row;
end;
$$;

grant execute on function enrich.submit_trailer_report(text, uuid, text, text, boolean, text, text, numeric) to authenticated;

-- ============================================================
-- POST /api/enrich/charge-points/{key}/trailer/moderate
-- Freigabe/Ablehnung einer Meldung. Bei Freigabe: Neuberechnung von
-- enrich.trailer_suitability aus ALLEN freigegebenen Meldungen fuer
-- diesen Ladepunkt -- gewichtete Mehrheit nach app_user.trust_level, bei
-- Gleichstand gewinnt die konservativere Aussage (no > unhitch > yes),
-- siehe Auftragsdokument Abschnitt 9 "Aggregationsregel".
-- ============================================================
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
            updated_at = now();
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;

grant execute on function enrich.moderate_trailer_report(bigint, text, uuid) to authenticated;

-- ============================================================
-- POST /api/enrich/campsites/{key}/charging
-- Website-Recherche zur Lademoeglichkeit auf dem Campingplatz.
-- ============================================================
create or replace function enrich.submit_campsite_charging(
    p_campsite_key text,
    p_has_charging boolean,
    p_charging_type text,
    p_max_power_kw numeric,
    p_point_count int,
    p_pitch_charging boolean,
    p_guests_only boolean,
    p_booking_required boolean,
    p_price_note text,
    p_evidence_url text,
    p_evidence_quote text
) returns enrich.campsite_charging
language plpgsql
security definer
set search_path = enrich, core, public
as $$
declare
    v_row enrich.campsite_charging;
begin
    if p_charging_type is not null and p_charging_type not in ('wallbox', 'schuko_only', 'dc_fast', 'cee', 'mixed') then
        raise exception 'Ungueltiger charging_type: %', p_charging_type;
    end if;
    if not exists (select 1 from core.campsite where external_key = p_campsite_key) then
        raise exception 'Campingplatz % nicht gefunden', p_campsite_key;
    end if;

    insert into enrich.campsite_charging (
        campsite_key, has_charging, charging_type, max_power_kw, point_count,
        guests_only, pitch_charging, booking_required, price_note,
        origin, evidence_url, evidence_quote, checked_at, recheck_after, verified_at, updated_at
    ) values (
        p_campsite_key, p_has_charging, p_charging_type, p_max_power_kw, p_point_count,
        p_guests_only, p_pitch_charging, p_booking_required, p_price_note,
        'website_research', p_evidence_url, p_evidence_quote, now(), (now() + interval '9 months')::date, now(), now()
    )
    on conflict (campsite_key) do update set
        has_charging = excluded.has_charging,
        charging_type = excluded.charging_type,
        max_power_kw = excluded.max_power_kw,
        point_count = excluded.point_count,
        guests_only = excluded.guests_only,
        pitch_charging = excluded.pitch_charging,
        booking_required = excluded.booking_required,
        price_note = excluded.price_note,
        origin = excluded.origin,
        evidence_url = excluded.evidence_url,
        evidence_quote = excluded.evidence_quote,
        checked_at = excluded.checked_at,
        recheck_after = excluded.recheck_after,
        verified_at = excluded.verified_at,
        updated_at = now()
    returning * into v_row;

    return v_row;
end;
$$;

grant execute on function enrich.submit_campsite_charging(text, boolean, text, numeric, int, boolean, boolean, boolean, text, text, text) to authenticated;

-- ============================================================
-- GET /api/enrich/research-queue
-- Offene Recherche-Aufgaben: Plaetze mit Website ohne bisherige
-- Ladeinfrastruktur-Recherche, plus faellige Rechecks. Sortiert nach
-- Land/Ort. Keine SECURITY DEFINER noetig -- core.campsite/enrich.
-- campsite_charging sind fuer authenticated bereits per SELECT-Policy
-- lesbar (siehe 20260915000000_data_layer_api_exposure.sql).
-- ============================================================
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
language sql
stable
as $$
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
    order by country_code, city
$$;

grant execute on function core.research_queue() to authenticated;
