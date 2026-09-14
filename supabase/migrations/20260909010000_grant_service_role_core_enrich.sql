-- Der Postgres-Rolle "service_role" fehlten bisher explizite Rechte auf
-- den custom Schemas core/enrich -- Supabase gewaehrt service_role RLS-
-- Bypass, aber KEINE automatischen GRANTs auf selbst angelegte Schemas
-- (anders als bei "public", wo service_role von Haus aus vollen Zugriff
-- hat). Die Haupt-App kam bisher ohne diese Grants aus, weil sie core/
-- enrich ausschliesslich ueber SECURITY DEFINER-Funktionen (run_quality_
-- checks, moderate_trailer_report, ...) und dedizierte Views mit eigenem
-- GRANT (campsite_search, charge_point_geo) anfasst -- nie direkt per
-- PostgREST mit dem Service-Role-Key. Das neue Admin-Backend (admin/)
-- braucht dagegen direkten Lese-/Schreibzugriff auf die core/enrich-
-- Basistabellen (Stammdaten- und Anhaengertauglichkeits-Pflege).
create schema if not exists core;
create schema if not exists enrich;

grant usage on schema core, enrich to service_role;
grant all on all tables in schema core, enrich to service_role;
grant all on all sequences in schema core, enrich to service_role;
grant execute on all functions in schema core, enrich to service_role;

-- Damit kuenftig neu angelegte Tabellen/Sequenzen/Funktionen in core/enrich
-- automatisch dieselben Rechte bekommen, ohne dass diese Migration bei
-- jeder neuen Tabelle wiederholt werden muss.
alter default privileges in schema core grant all on tables to service_role;
alter default privileges in schema core grant all on sequences to service_role;
alter default privileges in schema core grant execute on functions to service_role;
alter default privileges in schema enrich grant all on tables to service_role;
alter default privileges in schema enrich grant all on sequences to service_role;
alter default privileges in schema enrich grant execute on functions to service_role;
