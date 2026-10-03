-- Lizenzangaben in core.source_registry korrigieren (OPTIMIERUNG.md, Befund
-- D-1; harte Regel 3 in CLAUDE.md). Recherche 2026-10-03:
--
-- * bundesnetzagentur: CC BY 4.0 laut Impressum Ladesaeulenregister
--   (https://www.bundesnetzagentur.de/impressum-lsr), Namensnennung
--   erforderlich. Bisher license='siehe ...Impressum', commercial_use NULL.
-- * ripree: CC BY 4.0 laut Katalogeintrag des Herausgebers MITECO auf
--   datos.gob.es (e05068001-puntos-de-recarga-de-vehiculos-electricos),
--   dieselbe Export-URL wie ingest/import_ripree.py. Bisher alles NULL
--   (20261017000000 hatte die Frage bewusst offen gelassen).
-- * ocm: nicht ODbL. OCM-Community-Beitraege stehen unter CC BY 4.0,
--   importierte Datensaetze unter der Lizenz ihres Datenanbieters -- seit
--   20261027000000 werden nur kommerziell nutzbare Anbieter importiert.
--
-- Prioritaeten bleiben hier unveraendert (eigener Befund D-2).

update core.source_registry
set license = 'CC BY 4.0 (https://www.bundesnetzagentur.de/impressum-lsr)',
    commercial_use = true,
    attribution_required = true
where source_id = 'bundesnetzagentur';

update core.source_registry
set license = 'CC BY 4.0 (MITECO, datos.gob.es e05068001)',
    commercial_use = true,
    attribution_required = true
where source_id = 'ripree';

update core.source_registry
set license = 'CC BY 4.0 (OCM-Beitraege); importierte Datensaetze je Datenanbieter, nur kommerziell nutzbare Lizenzen (src/lib/ocm-license.ts)',
    commercial_use = true,
    attribution_required = true
where source_id = 'ocm';
