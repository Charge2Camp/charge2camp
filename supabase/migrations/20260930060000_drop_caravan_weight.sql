-- Nutzerwunsch: Gewicht spielt fuer Reichweite, Abmessungen oder die
-- Anhaengertauglichkeits-Kriterien einer Ladestation keine Rolle -- alle
-- Gewichtsfelder bei Wohnwagen (nicht bei Fahrzeugen -- vehicles.
-- max_towing_weight_braked_kg bleibt unberuehrt, ist eine Fahrzeug-
-- Eigenschaft und Teil eines anderen Datenmodells) werden entfernt statt
-- nur in der UI versteckt: weder abfragen noch darstellen. Es gibt (siehe
-- Recherche vor dieser Migration) keine Berechnung/keinen Vergleich
-- gegen vehicles.max_towing_weight_braked_kg im Code -- das Entfernen
-- bricht keine bestehende Logik.
alter table public.caravans
  drop column weight_kg,
  drop column gross_vehicle_weight_kg,
  drop column actual_travel_weight_kg;

alter table public.caravan_models
  drop column weight_kg,
  drop column gross_vehicle_weight_kg;

-- vehicles.weight_kg (20260910000000_vehicle_dimensions.sql) wurde nur
-- angelegt, um spaeter mit dem Wohnwagen-Gewicht zu einem
-- Gespann-Gesamtgewicht fuer den (nie implementierten) Strassenrestriktions-
-- Check kombiniert zu werden -- ohne Wohnwagen-Gewicht zwecklos. War in
-- keinem Formular exponiert (src/components/*, src/app/profil/actions.ts
-- lesen/schreiben es nirgends). vehicles.max_towing_weight_braked_kg
-- (Anhaengelast-Kapazitaet des Fahrzeugs, ein anderer Wert) bleibt
-- unberuehrt.
alter table public.vehicles
  drop column weight_kg;
