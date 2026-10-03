-- RLS auf allen verbleibenden Tabellen in core/raw, Leserecht auf
-- core.campsite_search entzogen (OPTIMIERUNG.md, Befund S-3).
-- Test: ingest/test_table_privileges.py.
--
-- 1) RLS ohne Policies. Auf Prod hatten core.charge_point_duplicate_
--    auto_merge_log, field_change_log, rate_limit_bucket, source_registry
--    und raw.campsite/charge_point/import_run kein RLS (charge_point_
--    duplicate und quality_check_cache bereits ja). anon/authenticated haben
--    darauf heute keine Rechte -- RLS ist die zweite Sicherung, falls je ein
--    Grant dazukommt (core ist ueber PostgREST exponiert). Zugriff bleibt
--    unveraendert: service_role hat BYPASSRLS, die Python-Importer verbinden
--    als Tabelleneigentuemer postgres, SECURITY-DEFINER-Funktionen (z. B.
--    core.check_rate_limit) laufen als Eigentuemer. "enable" ist
--    idempotent, deshalb auch fuer die Tabellen, die auf Prod schon RLS
--    haben (lokal teils nicht).
--
-- 2) core.campsite_search ist eine Materialized View (kein RLS moeglich)
--    und wurde in 20260919000000/20261025080000/20261025090000 jeweils an
--    anon und authenticated gegrantet -- damit war der komplette
--    Campingplatz-Suchbestand ohne Login per PostgREST abrufbar, obwohl die
--    App seit 20261004000000 ("lock down core/enrich DNA") Login verlangt.
--    Alle Lesezugriffe in App/Admin laufen ueber den Service-Role-Client
--    (per Code-Grep geprueft), der Entzug aendert also nichts an der App.
--
-- Nicht hier geloest (OPTIMIERUNG.md, Befund S-6): public.spatial_ref_sys
-- (PostGIS, Eigentuemer supabase_admin) ist fuer anon/authenticated
-- beschreibbar. Die Migrationsrolle postgres darf die Rechte nicht
-- entziehen (REVOKE endet nur mit "no privileges could be revoked").

alter table core.charge_point_duplicate enable row level security;
alter table core.charge_point_duplicate_auto_merge_log enable row level security;
alter table core.field_change_log enable row level security;
alter table core.quality_check_cache enable row level security;
alter table core.rate_limit_bucket enable row level security;
alter table core.source_registry enable row level security;
alter table raw.campsite enable row level security;
alter table raw.charge_point enable row level security;
alter table raw.import_run enable row level security;

revoke all on core.campsite_search from anon, authenticated;
