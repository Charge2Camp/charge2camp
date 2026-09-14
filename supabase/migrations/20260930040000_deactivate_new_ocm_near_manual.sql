-- Gegenstueck zur Dublettenpruefung in ingest/import_ocm.py (Python,
-- Zeile-fuer-Zeile-Insert) fuer den neuen Vercel-Cron-Reimport
-- (src/app/api/cron/ocm-import/route.ts), der aus Performancegruenden in
-- Bulk-Upserts arbeitet und deshalb nicht pro Datensatz VOR dem Insert
-- prüfen kann, ob eine nahegelegene Nicht-OCM-Station existiert. Stattdessen:
-- NACH dem Bulk-Upsert werden alle in den letzten p_since neu anglegten
-- OCM-Punkte (per created_at erkennbar -- ein Upsert eines bereits
-- bestehenden OCM-Punkts aendert created_at nicht) deaktiviert, wenn sie
-- innerhalb von p_radius_m einer bestehenden Nicht-OCM-Station liegen.
-- Gleiche Grundidee wie NEARBY_MANUAL_RADIUS_M/FIND_NEARBY_NON_OCM_SQL im
-- Python-Skript, nur als Nachbearbeitung statt Vorabpruefung.
create or replace function core.deactivate_new_ocm_near_manual(
    p_radius_m numeric default 40,
    p_since interval default interval '10 minutes'
) returns int
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_count int;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    with updated as (
        update core.charge_point cp
        set is_active = false
        where cp.source = 'ocm'
          and cp.created_at > now() - p_since
          and exists (
              select 1 from core.charge_point other
              where other.source <> 'ocm'
                and ST_DWithin(other.geom, cp.geom, p_radius_m)
          )
        returning cp.id
    )
    select count(*)::int into v_count from updated;

    return v_count;
end;
$$;

-- Aequivalent zu FILL_MISSING_TRAILER_SUITABILITY_SQL in
-- ingest/import_ocm.py, als RPC fuer den TS-Cron-Reimport (raw/core sind
-- nicht ueber PostgREST erreichbar, siehe supabase/config.toml [api]
-- schemas -- der Cron-Job kann also nur ueber core.*-RPCs schreiben).
create or replace function core.fill_missing_trailer_suitability()
returns int
language plpgsql
security definer
set search_path = core, enrich, public
as $$
declare
    v_count int;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    with inserted as (
        insert into enrich.trailer_suitability (charge_point_key, verdict, origin)
        select cp.external_key, 'unknown', 'auto'
        from core.charge_point cp
        where cp.source = 'ocm'
          and not exists (
              select 1 from enrich.trailer_suitability ts
              where ts.charge_point_key = cp.external_key
          )
        on conflict (charge_point_key) do nothing
        returning charge_point_key
    )
    select count(*)::int into v_count from inserted;

    return v_count;
end;
$$;

-- Audit-Trail-Aequivalent zu common.py's import_run() Contextmanager, als
-- einzelner RPC-Aufruf (der TS-Cron-Job kennt Start/Ende in einem Zug,
-- braucht kein Start-dann-Update-Muster wie das lang laufende Python-Skript).
create or replace function core.log_import_run(
    p_source text,
    p_scope text,
    p_record_count int,
    p_status text default 'ok',
    p_notes text default null
) returns bigint
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

    insert into raw.import_run (source, scope, status, record_count, notes, finished_at)
    values (p_source, p_scope, p_status, p_record_count, p_notes, now())
    returning id into v_id;

    return v_id;
end;
$$;
