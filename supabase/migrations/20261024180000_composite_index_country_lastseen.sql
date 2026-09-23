-- Fortsetzung von 20261024160000: gleicher Korrelations-Effekt jetzt bei
-- country_code=DE (52,3% aller Zeilen) + sort=last_seen_desc -- naheliegend,
-- da core.charge_point.source='bundesnetzagentur' (Bundesnetzagentur,
-- Deutschland-exklusiv) den Grossteil der DE-Zeilen stellt und denselben
-- batchweisen last_seen_at-Import hat wie beim source-Fix. Gemessen: 10,2s
-- (reproduzierbar, isoliert getestet) statt der erwarteten <100ms. Anders
-- als beim ersten Versuch bei source/is_active (20261024160000) gleich mit
-- "desc nulls last" statt nur "desc" angelegt.
create index if not exists idx_cp_country_lastseen on core.charge_point (country_code, last_seen_at desc nulls last);
