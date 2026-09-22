-- Nutzermeldung (2026-09-22): der taegliche OCM-Cron (src/app/api/cron/
-- ocm-import/route.ts) schlug mehrere Tage in Folge am 60s-Zeitlimit von
-- Vercels Hobby-Plan fehl (grosse Laender wie DE/FR brauchen laenger,
-- siehe Kommentar in der Route) -- unsichtbar im Admin-Dashboard, weil
-- core.log_import_run() bisher nur EINMAL GANZ AM ENDE bei vollem Erfolg
-- aufgerufen wurde. Bei einem harten Timeout killt Vercel den Prozess
-- sofort, ohne dass danach noch Code laufen kann -- ein fehlgeschlagener
-- Tag hinterliess dadurch GAR KEINEN Eintrag statt eines erkennbaren
-- Fehlschlags, "Letzter Import" zeigte einfach ein zunehmend veraltetes,
-- aber unauffaelliges Datum.
--
-- Fix: gleiches Start/Ende-Muster wie ingest/common.py import_run()
-- (Python-Importer) schon immer nutzt -- ein Lauf wird VOR der eigentlichen
-- Arbeit mit status='running' angelegt und erst am Ende auf 'ok'/'error'
-- aktualisiert. Bei einem harten Timeout bleibt die Zeile auf 'running'
-- haengen (finished_at bleibt null) -- core.last_import()/last_ocm_import()
-- (sortiert nach started_at, nicht nach Status) zeigt diese Zeile dann
-- trotzdem als "letzten Lauf", das Dashboard markiert status <> 'ok' rot.
-- Ein haengender 'running'-Lauf ist damit sofort sichtbar statt komplett
-- zu verschwinden.
create or replace function core.start_import_run(p_source text, p_scope text)
returns bigint
language plpgsql
security definer
set search_path = raw, public
as $$
declare
    v_id bigint;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    insert into raw.import_run (source, scope) values (p_source, p_scope) returning id into v_id;
    return v_id;
end;
$$;

comment on function core.start_import_run(text, text) is
  'Legt eine raw.import_run-Zeile mit status=''running'' (Tabellen-Default) an, VOR der eigentlichen Importarbeit -- Gegenstueck core.finish_import_run() schliesst sie ab. Siehe 20261024040000, verhindert dass ein harter Serverless-Timeout spurlos verschwindet.';

grant execute on function core.start_import_run(text, text) to service_role;

create or replace function core.finish_import_run(
    p_run_id bigint,
    p_status text,
    p_record_count int,
    p_notes text default null
) returns void
language plpgsql
security definer
set search_path = raw, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    update raw.import_run
    set status = p_status,
        record_count = p_record_count,
        notes = coalesce(p_notes, notes),
        finished_at = now()
    where id = p_run_id;
end;
$$;

comment on function core.finish_import_run(bigint, text, int, text) is
  'Schliesst einen mit core.start_import_run() begonnenen Lauf ab (status ''ok''/''error'', record_count, finished_at). Siehe 20261024040000.';

grant execute on function core.finish_import_run(bigint, text, int, text) to service_role;
