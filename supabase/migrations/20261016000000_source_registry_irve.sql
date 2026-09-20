-- Registriert die franzoesische IRVE-Quelle (Base Nationale des IRVE,
-- transport.data.gouv.fr) in core.source_registry, siehe
-- supabase/migrations/20261012000000_field_provenance_and_source_registry.sql
-- ("core.upsert_charge_point() lehnt unbekannte Quellen hart ab -- vorher
-- MUSS ein Registry-Eintrag existieren"). Analog zum Eintrag fuer
-- 'bundesnetzagentur': eine offizielle nationale Quelle (Prioritaetsstufe 2
-- des Auftragsdokuments), noch kein abgeschlossener Importlauf ->
-- last_successful_import bleibt NULL, wird von common.py import_run() beim
-- ersten erfolgreichen Lauf automatisch nachgezogen.
insert into core.source_registry (
    source_id, source_name, country, source_type, priority, license,
    commercial_use, attribution_required, update_frequency, api_information,
    last_successful_import
)
values (
    'irve',
    'Base Nationale des IRVE (France, transport.data.gouv.fr)',
    'FR',
    'OFFICIAL_NATIONAL',
    90,
    'Licence Ouverte v1.0 (Etalab)',
    true,
    true,
    'taeglich',
    'https://www.data.gouv.fr/api/1/datasets/r/eb76d20a-8501-400e-b336-d85724de5435 (direktes CSV, Schema: https://schema.data.gouv.fr/etalab/schema-irve-statique/2.3.1/)',
    null
);
