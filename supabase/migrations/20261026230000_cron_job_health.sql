-- Gesundheitspruefung fuer pg_cron-Jobs: core.cron_job_health(job, max. Alter in Minuten).
--
-- Hintergrund: Mehrere Pfade haengen von Cron-Jobs ab -- vor allem
-- refresh-charge-point-map (alle 15 Minuten; Karten-Kopie, Erstansicht und Betreiber-
-- Optionen, 20261026190000/210000/220000) und refresh-all-quality-data (nachts;
-- Datenqualitaet im Admin-Dashboard). Faellt ein Job aus, bleiben diese Daten OHNE sichtbaren
-- Fehler veraltet. pg_cron protokolliert zwar jeden Lauf in cron.job_run_details, aber
-- niemand schaut dort hinein -- tatsaechlich lief refresh-all-quality-data zehn Naechte in
-- Folge (2026-09-23 bis 2026-10-02) in "canceling statement due to statement timeout" beim
-- Insert in core.charge_point_duplicate, zuletzt erfolgreich am 2026-09-22.
--
-- Die Funktion liefert EINE Zeile je Job: existiert/aktiv, Zeitplan, letzter abgeschlossener
-- Lauf (Status, Ende, Dauer), letzter Erfolg und dessen Alter in Minuten, Fehlschlaege in den
-- letzten 10 abgeschlossenen Laeufen, sowie ein Gesamturteil "healthy" mit Klartext-Grund.
--   healthy = Job aktiv UND mindestens ein erfolgreicher Lauf UND der letzte abgeschlossene
--             Lauf erfolgreich UND letzter Erfolg nicht aelter als p_max_age_minutes.
-- Nur ABGESCHLOSSENE Laeufe (succeeded/failed) zaehlen: ein gerade laufender Lauf ("running")
-- ist kein Fehler; haengt er aber, altert der letzte Erfolg und das Limit schlaegt an.
--
-- Konsumenten: .github/workflows/cron-health.yml (geplanter Check, schlaegt bei ungesund fehl ->
-- GitHub benachrichtigt) und die Statuskarte im Admin-Dashboard.
--
-- security definer (cron.* ist fuer normale Rollen nicht lesbar); execute NUR fuer service_role,
-- nicht fuer PUBLIC/anon/authenticated (Jobbefehle/Fehlermeldungen sind interne Informationen,
-- die Fehlermeldung wird zudem auf 200 Zeichen gekuerzt). Reine Lesefunktion.
-- Neue Funktion: kein Overload, kein DROP noetig. Lokal mit simulierten Laeufen getestet;
-- NICHT in Produktion angewendet.

create or replace function core.cron_job_health(p_jobname text, p_max_age_minutes integer)
returns table (
    jobname text,
    job_exists boolean,
    job_active boolean,
    schedule text,
    last_finished_status text,
    last_finished_at timestamptz,
    last_duration_seconds numeric,
    last_success_at timestamptz,
    minutes_since_last_success numeric,
    failed_in_last_10 integer,
    healthy boolean,
    reason text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_jobid bigint;
    v_active boolean;
    v_schedule text;
    v_status text;
    v_finished_at timestamptz;
    v_duration numeric;
    v_message text;
    v_success_at timestamptz;
    v_minutes numeric;
    v_failed integer;
    v_healthy boolean;
    v_reason text;
begin
    select j.jobid, j.active, j.schedule
      into v_jobid, v_active, v_schedule
      from cron.job j
     where j.jobname = p_jobname;

    if v_jobid is null then
        return query select p_jobname, false, false, null::text, null::text, null::timestamptz,
                            null::numeric, null::timestamptz, null::numeric, 0, false,
                            'Job nicht gefunden'::text;
        return;
    end if;

    -- letzter ABGESCHLOSSENER Lauf
    select d.status, d.end_time, extract(epoch from (d.end_time - d.start_time))::numeric,
           left(coalesce(d.return_message, ''), 200)
      into v_status, v_finished_at, v_duration, v_message
      from cron.job_run_details d
     where d.jobid = v_jobid and d.status in ('succeeded', 'failed')
     order by d.start_time desc
     limit 1;

    select max(d.end_time) into v_success_at
      from cron.job_run_details d
     where d.jobid = v_jobid and d.status = 'succeeded';

    select count(*) filter (where r.status = 'failed')::integer into v_failed
      from (select d.status
              from cron.job_run_details d
             where d.jobid = v_jobid and d.status in ('succeeded', 'failed')
             order by d.start_time desc
             limit 10) r;

    if v_success_at is not null then
        v_minutes := round(extract(epoch from (now() - v_success_at)) / 60.0, 1);
    end if;

    if not v_active then
        v_healthy := false;  v_reason := 'Job ist deaktiviert';
    elsif v_success_at is null then
        v_healthy := false;  v_reason := 'Noch kein erfolgreicher Lauf';
    elsif v_status = 'failed' then
        v_healthy := false;  v_reason := 'Letzter Lauf fehlgeschlagen: ' || v_message;
    elsif v_minutes > p_max_age_minutes then
        v_healthy := false;
        v_reason := format('Letzter Erfolg vor %s Minuten (Limit %s)', v_minutes, p_max_age_minutes);
    else
        v_healthy := true;   v_reason := 'ok';
    end if;

    return query select p_jobname, true, v_active, v_schedule, v_status, v_finished_at, round(v_duration, 1),
                        v_success_at, v_minutes, coalesce(v_failed, 0), v_healthy, v_reason;
end;
$$;

revoke all on function core.cron_job_health(text, integer) from public;
grant execute on function core.cron_job_health(text, integer) to service_role;

comment on function core.cron_job_health(text, integer) is
  'Gesundheit eines pg_cron-Jobs (eine Zeile): aktiv, letzter abgeschlossener Lauf, letzter Erfolg und dessen Alter, Fehlschlaege in den letzten 10 Laeufen, healthy + Klartext-Grund (healthy = aktiv, mind. ein Erfolg, letzter Lauf erfolgreich, letzter Erfolg juenger als p_max_age_minutes). Nur fuer service_role; Konsumenten: GitHub-Workflow cron-health und Admin-Dashboard. Siehe Migration 20261026230000.';
