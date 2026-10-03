-- Quellenprioritaet nach harter Regel 2 (CLAUDE.md, OPTIMIERUNG.md Befund
-- D-2): manuell kuratiert (100) > Bundesnetzagentur (90) > weitere frei
-- kommerziell nutzbare nationale Quellen > OSM.
--
-- IRVE (20261016000000) und RIPREE (20261017000000) wurden mit priority=90
-- angelegt, gleichauf mit BNetzA. Bei einem Treffer im Grenzgebiet (DE/FR)
-- entschied dann kein Vorrang, sondern der Gleichstand: absorb_technical_
-- fields() uebernimmt nur bei echt hoeherer Prioritaet (<=-Vergleich), die
-- Dubletten-Merges waehlen bei Gleichstand den kleineren external_key.
-- Mit 80 gewinnt BNetzA beides. OCM (40) und OSM (10) bleiben darunter.
--
-- Alle Verwender vergleichen nur relativ (absorb_technical_fields,
-- auto_merge_charge_point_duplicates_batch, merge_exact_address_
-- duplicates, known_operator_brand_merge_tier) -- keine fest kodierte
-- Schwelle auf 90. Die bewusste Ausnahme "BNetzA gewinnt eindeutige
-- Dubletten gegen manual_override" (20261024020000) ist davon unberuehrt.

update core.source_registry set priority = 80 where source_id in ('irve', 'ripree');
