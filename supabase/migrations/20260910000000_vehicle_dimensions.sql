-- Phase 7 (Gespannlogik): Fahrzeug-Breite/-Hoehe/-Gewicht ergaenzen (Wohnwagen
-- hat diese Felder bereits seit der initialen Migration). Zusammen mit den
-- Wohnwagen-Massen ergibt sich daraus die kombinierte Gespann-Breite/-Hoehe/
-- -Gewicht fuer den Strassenrestriktions-Check gegen OSM-Daten, siehe
-- src/lib/gespann-dimensions.ts und src/lib/providers/road-restrictions/.
alter table public.vehicles
  add column width_m numeric,
  add column height_m numeric,
  add column weight_kg numeric;
