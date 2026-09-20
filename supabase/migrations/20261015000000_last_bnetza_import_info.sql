-- Analog zu core.last_ocm_import() (20260930050000): kleiner Hinweis im
-- Admin-Dashboard, wann der letzte BNetzA-Import lief. Da ingest/
-- import_bnetza.py denselben raw.import_run-Contextmanager nutzt (siehe
-- ingest/common.py import_run()) wie import_ocm.py, unterscheidet sich die
-- Abfrage nur im source-Filter -- statt die Funktion zu duplizieren, wird
-- hier auf einen generalisierten core.last_import(p_source) umgestellt.
-- core.last_ocm_import() bleibt als duenner Wrapper bestehen (kein
-- Breaking Change fuer admin/app/(dashboard)/page.tsx, das ihn bereits per
-- .rpc("last_ocm_import") aufruft).
create or replace function core.last_import(p_source text)
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
    where ir.source = p_source
    order by ir.started_at desc
    limit 1;
end;
$$;

comment on function core.last_import(text) is
  'Letzter raw.import_run-Lauf einer Quelle (z. B. ''ocm'', ''bundesnetzagentur''), fuer den Admin-Dashboard-Hinweis. Gleicher Admin-Zugriffsschutz wie das bisherige core.last_ocm_import(), siehe 20260930050000.';

grant execute on function core.last_import(text) to service_role, authenticated;

-- Duenner Wrapper statt Duplikat -- bisherige Aufrufer (admin/app/(dashboard)/
-- page.tsx: supabase.schema("core").rpc("last_ocm_import")) funktionieren
-- unveraendert weiter.
create or replace function core.last_ocm_import()
returns table (scope text, status text, record_count int, finished_at timestamptz, started_at timestamptz)
language sql
security definer
set search_path = core, public
as $$
    select * from core.last_import('ocm');
$$;

comment on function core.last_ocm_import() is
  'Wrapper um core.last_import(''ocm'') -- siehe 20261015000000_last_bnetza_import_info.sql. Bleibt bestehen, damit admin/app/(dashboard)/page.tsx unveraendert per .rpc("last_ocm_import") aufrufen kann.';

grant execute on function core.last_ocm_import() to service_role, authenticated;
