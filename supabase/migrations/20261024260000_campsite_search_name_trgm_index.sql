-- Effizienz-Audit (2026-09-24): fetchCampsites() (src/lib/campsites.ts)
-- filtert core.campsite_search.name per ilike('%...%') fuer die
-- Campingplatz-Textsuche -- anders als core.charge_point (idx_cp_name_trgm,
-- 20261022080000_trigram_index_for_text_search.sql) hatte core.
-- campsite_search dafuer keinen Trigram-Index, jede Namenssuche erzwingt
-- also einen Sequential Scan ueber die materialisierte View. Aktuell noch
-- unkritisch (wenige tausend Campingplaetze, siehe index_meilisearch.py),
-- aber inkonsistent mit dem bereits behobenen Ladepunkt-Pfad und wird mit
-- wachsendem Datensatz zum selben Problem.
create extension if not exists pg_trgm;

create index idx_cssearch_name_trgm on core.campsite_search using gin (name gin_trgm_ops);
