-- Sicherheits-Fix (OPTIMIERUNG.md, Befunde S-4 und S-5).
-- Test: ingest/test_function_privileges.py.
--
-- S-4: Postgres vergibt EXECUTE auf jede neue Funktion an PUBLIC. Die
-- Migrationen haben bisher nur an service_role/authenticated vergeben und
-- PUBLIC nie entzogen -- da core und enrich ueber PostgREST exponiert sind
-- (supabase/config.toml), war jede Funktion mit dem oeffentlichen Anon-Key
-- aufrufbar, darunter SECURITY-DEFINER-Funktionen ohne eigene Pruefung wie
-- enrich.set_trailer_suitability (p_origin='admin_override' -> manuelle
-- Caravan-Bewertungen ueberschreibbar, harte Regel 1), core.upsert_
-- charge_point(s_bulk), core.absorb_technical_fields, core.deactivate_
-- insufficient_charging_stations. Fix: alles fuer PUBLIC/anon/authenticated
-- entziehen, service_role behaelt alles, authenticated bekommt nur die
-- fuenf RPCs zurueck, die App/Admin mit der Nutzer-Session aufrufen (alle
-- anderen laufen ueber den Service-Role-Client, per Code-Grep geprueft):
-- submit_trailer_report, submit_campsite_charging, moderate_trailer_report,
-- research_queue, run_quality_checks -- alle pruefen die Berechtigung
-- selbst. Default-Privilegien ebenfalls angepasst, damit neue Funktionen
-- nicht wieder automatisch an PUBLIC gehen; jede kuenftige Funktion, die
-- authenticated braucht, muss das ausdruecklich granten.
--
-- S-5: enrich.moderate_trailer_report hatte die is_admin-Pruefung aus
-- 20260927000000 in der Neufassung 20261012000000 wieder verloren.
--
-- Funktionskoerper von moderate_trailer_report sonst unveraendert aus
-- 20261012000000, gleiche Signatur (kein Overload).

-- S-4 ---------------------------------------------------------------------
revoke execute on all functions in schema core from public, anon, authenticated;
revoke execute on all functions in schema enrich from public, anon, authenticated;
grant execute on all functions in schema core to service_role;
grant execute on all functions in schema enrich to service_role;

alter default privileges in schema core revoke execute on functions from public;
alter default privileges in schema enrich revoke execute on functions from public;

grant execute on function enrich.submit_trailer_report(text, uuid, text, text, boolean, text, text, numeric) to authenticated;
grant execute on function enrich.submit_campsite_charging(text, boolean, text, numeric, integer, boolean, boolean, boolean, text, text, text) to authenticated;
grant execute on function enrich.moderate_trailer_report(bigint, text, uuid) to authenticated;
grant execute on function core.research_queue() to authenticated;
grant execute on function core.run_quality_checks() to authenticated;

-- S-5 ---------------------------------------------------------------------
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
    v_existing enrich.trailer_suitability%rowtype;
begin
    -- S-5: in 20260927000000 eingefuehrt, in 20261012000000 verloren.
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

        select * into v_existing from enrich.trailer_suitability where charge_point_key = v_key;

        perform enrich.set_trailer_suitability(
            p_charge_point_key => v_key,
            p_verdict => v_verdict,
            p_origin => 'community',
            p_drive_through => v_existing.drive_through,
            p_pull_in_length_m => v_existing.pull_in_length_m,
            p_maneuvering_space => v_existing.maneuvering_space,
            p_notes => v_existing.notes,
            p_confirm_count => v_confirm_count,
            p_dispute_count => v_dispute_count,
            p_verified_by => p_moderator_id
        );
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;
