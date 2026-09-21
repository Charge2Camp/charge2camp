-- Fortsetzung von 20261022070000: Nutzermeldung "kommt immer noch" fuer
-- /ladestationen?q=ladenetz.de -- anderer Filtertyp als bisher behoben.
-- "cp.name ilike '%' || $1 || '%' or cp.operator ilike '%' || $1 || '%'"
-- hat ein FUEHRENDES Wildcard -- ein gewoehnlicher btree-Index (wie
-- idx_cp_name) kann das strukturell nicht unterstuetzen (nur Praefix-Suchen
-- wie 'foo%' waeren btree-indexierbar). Gemessen: 22,4s Laufzeit, muss die
-- komplette Tabelle scannen.
--
-- pg_trgm ist bereits installiert (wird fuer core.normalize_operator_for_dedup
-- similarity()-Vergleiche genutzt, siehe 20261021000000) -- GIN-Trigram-
-- Indizes auf core.charge_point.name/operator unterstuetzen ILIKE mit
-- beliebigem Wildcard-Muster effizient.
create index if not exists idx_cp_name_trgm on core.charge_point using gin (name gin_trgm_ops);
create index if not exists idx_cp_operator_trgm on core.charge_point using gin (operator gin_trgm_ops);
