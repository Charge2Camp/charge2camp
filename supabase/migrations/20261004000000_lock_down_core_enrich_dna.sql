-- Sicherheits-Audit: der komplette core/enrich-Datensatz (Ladepunkte,
-- Anhaengertauglichkeit, Campingplaetze -- die "DNA" des Produkts) war ueber
-- die Supabase-REST-API mit dem OEFFENTLICHEN Anon-Key direkt abrufbar,
-- voellig unabhaengig von der Next.js-App (z. B.
-- "{SUPABASE_URL}/rest/v1/charge_point_geo?select=*" ohne jedes Login).
-- Ursache: 20260915000000_data_layer_api_exposure.sql vergibt pauschal
-- "grant select on all tables in schema core/enrich to anon, authenticated"
-- inkl. "alter default privileges" fuer alle kuenftigen Tabellen, plus eine
-- RLS-Policy "readable by everyone" (using (true)) auf jeder Tabelle.
--
-- Fix: denselben Blanket-Ansatz umgekehrt anwenden -- Grants entziehen UND
-- die Policies droppen (nicht nur den Grant entfernen), damit RLS wirklich
-- verweigert statt sich auf einen fehlenden Grant allein zu verlassen
-- (gleiches Muster wie zuvor bei enrich.app_user in
-- 20260927000000_security_hardening_admin_rpcs.sql). Alle lesenden
-- Zugriffe laufen ab jetzt ausschliesslich ueber den Service-Role-Client
-- (createAdminClient(), src/lib/supabase/admin.ts) serverseitig in der
-- Next.js-App -- bestaetigt per Code-Audit: KEIN Client Component fragt
-- core/enrich direkt ab, jeder Zugriff lief bereits serverseitig.
--
-- Bewusst NICHT angefasst: enrich.submit_trailer_report,
-- enrich.moderate_trailer_report, enrich.submit_campsite_charging,
-- core.research_queue, core.run_quality_checks -- alle nur an
-- "authenticated" granted (nie "anon"), mit interner
-- auth.uid()/is_admin-Pruefung. Das sind Einzel-Mutationen fuer
-- eingeloggte Nutzer (z. B. eine Meldung abschicken), kein
-- Bulk-Read-Risiko, und muessen auth.uid() der aufrufenden Person kennen
-- -- ein Service-Role-Aufruf wuerde das zerstoeren.

revoke select on all tables in schema core from anon, authenticated;
revoke select on all tables in schema enrich from anon, authenticated;

alter default privileges in schema core revoke select on tables from anon, authenticated;
alter default privileges in schema enrich revoke select on tables from anon, authenticated;

-- Bulk-Geo-RPC, umgeht sonst denselben Schutz ueber einen Funktionsaufruf
-- statt eines direkten Tabellen-SELECTs.
revoke execute on function core.charge_points_within_radius(double precision, double precision, double precision)
    from anon, authenticated;

-- enrich.missing_station_report hat eine EIGENE, bereits korrekte
-- Zugriffsregelung (20261003000000_missing_station_reports.sql: select+
-- insert nur fuer authenticated, RLS-Policy beschraenkt zusaetzlich auf
-- auth.uid() = user_id) -- der obige Blanket-Revoke traf auch diese
-- Tabelle (ist Teil von "all tables in schema enrich"), deshalb hier
-- gezielt wiederhergestellt.
grant select, insert on enrich.missing_station_report to authenticated;

-- Alle "<table> readable by everyone"-Policies droppen (Materialized Views
-- wie core.campsite_search koennen ohnehin keine RLS-Policy haben, sie
-- landen nicht in pg_tables -- fuer sie reicht der obige Grant-Entzug).
do $$
declare
    t record;
begin
    for t in
        select schemaname, tablename from pg_tables where schemaname in ('core', 'enrich')
    loop
        execute format('drop policy if exists "%s readable by everyone" on %I.%I', t.tablename, t.schemaname, t.tablename);
    end loop;
end $$;
