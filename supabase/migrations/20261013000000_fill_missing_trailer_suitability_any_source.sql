-- core.fill_missing_trailer_suitability() war bislang hart auf
-- cp.source = 'ocm' gefiltert (siehe 20260930040000). Mit dem neuen
-- BNetzA-Importer (ingest/import_bnetza.py, siehe supabase/migrations/
-- 20261012000000_field_provenance_and_source_registry.sql) bekaemen
-- BNetzA-Ladepunkte sonst nie eine 'unknown'-Platzhalterzeile in
-- enrich.trailer_suitability -- inkonsistent zu OCM-Ladepunkten und im
-- Widerspruch zu Auftragsdokument Test F ("no reliable automatic
-- assessment -> caravan = UNKNOWN"), das quellenunabhaengig gilt. Der
-- Filter wird auf ALLE automatischen Quellen verallgemeinert (weiterhin
-- NICHT fuer manuell angelegte Stationen -- deren Fehlen einer
-- Anhaenger-Bewertung ist ein bewusster, noch offener redaktioneller
-- Zustand, keine automatisch zu befuellende Luecke).
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
        where cp.source in (select source_id from core.source_registry where source_type <> 'MANUAL_CHARGE2CAMP')
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
