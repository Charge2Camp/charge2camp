-- Macht die core/enrich-Schemas (echte Campingplatz-/Ladepunktdaten) ueber
-- die Supabase-API erreichbar, damit die App sie lesen kann (siehe
-- supabase/config.toml [api] schemas). Ohne GRANT + RLS-Policy sehen
-- anon/authenticated hier nichts, selbst wenn das Schema in der API-Config
-- gelistet ist.
--
-- Nur LESEND fuer die App -- Schreibzugriffe laufen ausschliesslich ueber
-- die Ingest-Skripte (verbinden als Postgres-Superuser, umgehen RLS
-- ohnehin) bzw. spaeter ueber dedizierte Server-Actions mit eigener Policy
-- (Auftrag D, Anreicherungs-Endpunkte).

grant usage on schema core to anon, authenticated;
grant usage on schema enrich to anon, authenticated;

grant select on all tables in schema core to anon, authenticated;
grant select on all tables in schema enrich to anon, authenticated;

-- Kuenftig neu angelegte Tabellen in core/enrich automatisch mit demselben
-- Leserecht versehen, damit das nicht bei jeder neuen Migration vergessen
-- werden kann.
alter default privileges in schema core grant select on tables to anon, authenticated;
alter default privileges in schema enrich grant select on tables to anon, authenticated;

do $$
declare
    t record;
begin
    for t in
        select schemaname, tablename from pg_tables where schemaname in ('core', 'enrich')
    loop
        execute format('alter table %I.%I enable row level security', t.schemaname, t.tablename);
        execute format(
            'create policy "%s readable by everyone" on %I.%I for select using (true)',
            t.tablename, t.schemaname, t.tablename
        );
    end loop;
end $$;

-- core.campsite_search ist eine MATERIALIZED VIEW, keine Tabelle (obiges
-- GRANT select on all tables deckt sie trotzdem ab, da Postgres materialized
-- views fuer GRANT-Zwecke wie Relationen behandelt -- keine RLS moeglich/
-- noetig fuer materialized views, sie sind ohnehin nur ein Snapshot).
