-- Elektroautos mit werkseitig verfuegbarer Anhaengerkupplung (kuratierte
-- Auswahl, keine vollstaendige Marktabdeckung -- siehe docs/data-sources.md).
-- Quellen: ev-database.org, Herstellerangaben (siehe data-sources.md fuer
-- Details je Modell). Fahrzeuge ohne genehmigte Anhaengelast wurden bewusst
-- ausgeschlossen. length_m = Fahrzeuglaenge (fuer Gespannlaenge-Berechnung).
insert into public.vehicle_models
  (manufacturer, model, variant, battery_capacity_kwh, range_km, max_towing_weight_braked_kg, length_m, source, verification_status, last_verified_at)
values
  ('Tesla', 'Model Y', 'RWD (Juniper)', 60.0, 380, 1600, 4.79, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Tesla', 'Model 3', 'RWD (Highland)', 60.0, 450, 1000, 4.72, 'ev-database.org', 'unverified', '2026-09-04'),
  ('BMW', 'iX', 'xDrive40', 71.0, 360, 2500, 4.95, 'ev-database.org', 'unverified', '2026-09-04'),
  ('BMW', 'iX5', '60 xDrive', 141.0, 670, 2700, 4.99, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Kia', 'EV3', 'Long Range', 78.0, 455, 1000, 4.30, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Kia', 'EV9', 'GT-Line AWD', 99.8, 512, 2500, 5.02, 'Kia / evspecifications.com', 'unverified', '2026-09-04'),
  ('Volvo', 'EX60', 'P12 AWD', 112.0, 610, 2400, 4.80, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Mercedes-Benz', 'CLA', '250+', 85.0, 585, 1500, 4.72, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Hyundai', 'IONIQ 5', '84 kWh RWD', 84.0, 450, 1600, 4.66, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Zeekr', '7GT', 'Long Range RWD', 97.0, 555, 1600, 4.82, 'ev-database.org', 'unverified', '2026-09-04'),
  ('Volkswagen', 'ID.4', 'GTX 4MOTION', 84.0, 522, 1800, 4.58, 'evkx.net / VW', 'unverified', '2026-09-04'),
  ('Skoda', 'Enyaq', '85', 82.0, 581, 1800, 4.65, 'evkx.net / Skoda', 'unverified', '2026-09-04'),
  ('Audi', 'Q4 e-tron', '55 quattro', 82.0, 525, 1800, 4.59, 'evkx.net / Audi', 'unverified', '2026-09-04'),
  ('Audi', 'A6 Avant e-tron', 'quattro', null, null, 2100, 4.93, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-04'),
  ('Polestar', '3', 'Long Range Dual Motor', null, null, 2200, 4.90, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-04');
