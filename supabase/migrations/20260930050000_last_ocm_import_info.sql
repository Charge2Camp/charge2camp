-- Nutzerwunsch: kleiner Hinweis im Admin-Dashboard, wann der letzte
-- OCM-Import lief. raw.import_run (dort protokolliert core.log_import_run/
-- ingest/import_ocm.py's import_run()-Contextmanager jeden Lauf, siehe
-- Migration 20260930040000) ist nicht ueber PostgREST erreichbar (raw ist
-- nicht in supabase/config.toml [api] schemas gelistet) -- dieser RPC legt
-- nur den letzten Lauf offen, kein voller Tabellenzugriff.
create or replace function core.last_ocm_import()
returns table (scope text, status text, record_count int, finished_at timestamptz, started_at timestamptz)
language plpgsql
security definer
set search_path = raw, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select ir.scope, ir.status, ir.record_count, ir.finished_at, ir.started_at
    from raw.import_run ir
    where ir.source = 'ocm'
    order by ir.started_at desc
    limit 1;
end;
$$;
