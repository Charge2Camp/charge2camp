-- RIPREE (Registro de Puntos de Recarga, Spanien/MITECO) in der
-- Quellenregistry anmelden, siehe supabase/migrations/
-- 20261012000000_field_provenance_and_source_registry.sql und
-- ingest/import_ripree.py (dessen Moduldocstring die Datenstruktur im
-- Detail dokumentiert).
--
-- Wie bundesnetzagentur (DE) ist RIPREE eine offizielle staatliche Quelle
-- (Ministerio para la Transicion Ecologica y el Reto Demografico, MITECO)
-- -- Prioritaetsstufe OFFICIAL_NATIONAL, priority=90, identisch zu BNetzA.
--
-- license/commercial_use/attribution_required bewusst NULL statt geraten:
-- die MITECO-Exportseite (siehe api_information) nennt an der Stelle des
-- Downloads keine explizite Lizenz/Nutzungsbedingung, anders als z. B. OCM
-- (ODbL, im Footer verlinkt) oder BNetzA (Impressum-Verweis). Vor jeder
-- kommerziellen Nutzung dieser Daten muss das juristisch geprueft werden
-- (CLAUDE.md Prinzip 6 "Datenlizenzen respektieren") -- NULL macht diese
-- offene Frage sichtbar, statt sie mit einer geratenen Lizenz zu
-- verschleiern.
insert into core.source_registry (
    source_id, source_name, country, source_type, priority,
    license, commercial_use, attribution_required,
    update_frequency, api_information, last_successful_import
)
values (
    'ripree',
    'RIPREE (Registro de Puntos de Recarga, España, MITECO)',
    'ES',
    'OFFICIAL_NATIONAL',
    90,
    null,
    null,
    null,
    'laufend (operator-gemeldet, kein festes Intervall)',
    'https://energia.serviciosmin.gob.es/Ripree/ExportarInstalaciones/Export (oeffentlicher Export-Endpunkt, POST auf .../GenerarExcel mit {"model":null,"soloConsolidado":true}, liefert UTF-16LE-CSV)',
    null
);
