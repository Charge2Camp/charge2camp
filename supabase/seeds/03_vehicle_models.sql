-- Elektroautos mit werkseitig verfuegbarer Anhaengerkupplung (kuratierte
-- Auswahl, keine vollstaendige Marktabdeckung -- siehe docs/data-sources.md).
-- Quellen: ev-database.org, Herstellerangaben (siehe data-sources.md fuer
-- Details je Modell). Fahrzeuge ohne genehmigte Anhaengelast wurden bewusst
-- ausgeschlossen. length_m = Fahrzeuglaenge (fuer Gespannlaenge-Berechnung).
--
-- Erweiterung 2026-09-11 (Nutzerwunsch: moeglichst vollstaendige Abdeckung
-- der in Europa erhaeltlichen E-Autos mit Anhaengekupplung): Anhaengelast-
-- Werte stammen aus dem go-e.com Towing Guide 2026 (per WebFetch abgerufen),
-- Batterie/Reichweite nur dort ergaenzt, wo exakt derselbe Modell-Trim in
-- einem live abgerufenen ev-database.org-Datensatz vorlag -- sonst bewusst
-- NULL statt geschaetzt (keine Scheindaten). Laengenangaben (length_m)
-- stammen aus allgemein bekannten, oeffentlich dokumentierten Fahrzeug-
-- Aussenmassen der jeweiligen Modellreihe (variiert kaum zwischen
-- Batterie-/Antriebsvarianten desselben Modells). Immer noch keine
-- vollstaendige Marktabdeckung -- u. a. Seat/Opel/Jaguar/Land Rover/Honda/
-- Mazda/Subaru fehlen mangels belastbarer Anhaengelast-Quelle in dieser
-- Recherche.
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
  ('Polestar', '3', 'Long Range Dual Motor', null, null, 2200, 4.90, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-04'),
  -- --- Erweiterung 2026-09-11 ---
  ('Audi', 'Q4 e-tron', '45 e-tron', null, null, 1000, 4.59, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Audi', 'Q4 e-tron Sportback', '45 e-tron advanced', null, null, 1000, 4.63, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Audi', 'Q6 e-tron', 'performance quattro', null, null, 2400, 4.77, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Audi', 'Q8 e-tron', '50 S line quattro', null, null, 1800, 4.92, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Audi', 'SQ8 e-tron', 'quattro', null, null, 1800, 4.92, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Audi', 'Q8 e-tron', '55 edition Dakar quattro', null, null, 1800, 4.92, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('CUPRA', 'Tavascan', 'Endurance', null, null, 1000, 4.64, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i4', 'xDrive40', null, null, 1600, 4.78, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i5', 'eDrive40', null, null, 1500, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i5 Touring', 'eDrive40 M Sport', null, null, 1500, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i5', 'xDrive40', null, null, 2000, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i5', 'M60 xDrive', null, null, 2000, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i5 Touring', 'M60 xDrive', null, null, 2000, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'i7', 'xDrive60', null, null, 2000, 5.39, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('BMW', 'iX3', '50 xDrive (Neue Klasse)', 108.7, 635, 2000, 4.85, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQA', '250 Progressive', null, null, 1500, 4.46, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQA', '300 4MATIC', null, null, 1800, 4.46, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQB', '300 4MATIC', null, null, 1700, 4.68, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQE', '350 4MATIC', null, null, 1700, 4.95, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQE SUV', '500 4MATIC', null, null, 1800, 4.86, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Mercedes-Benz', 'EQS', '450 4MATIC', null, null, 1700, 5.22, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Tesla', 'Model Y', 'Long Range AWD', 75.0, 445, 1600, 4.75, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Tesla', 'Model S', 'Plaid', 95.0, 560, 1600, 4.97, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Tesla', 'Model X', 'AWD', null, null, 2250, 5.04, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Volkswagen', 'ID. Buzz', 'Pro', null, null, 1000, 4.96, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Volkswagen', 'ID. Buzz', 'GTX', null, null, 1800, 4.96, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Volkswagen', 'ID.5', 'Pro', null, null, 1000, 4.60, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Volkswagen', 'ID.4', 'Pro', 77.0, 445, 1200, 4.58, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Volkswagen', 'ID.7', 'Pro S', null, null, 1200, 4.96, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Polestar', '2', 'Long Range Dual Motor', null, null, 1500, 4.61, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('XPeng', 'G6', 'RWD Long Range', 80.0, 450, 1500, 4.75, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('XPeng', 'G9', 'AWD', null, null, 1500, null, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Hyundai', 'IONIQ 6', '77.4 kWh RWD', null, null, 1500, 4.86, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Hyundai', 'IONIQ 5', '77.4 kWh', null, null, 1600, 4.66, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Hyundai', 'IONIQ 9', 'AWD', null, null, 2500, 5.06, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Kia', 'EV6', 'Long Range AWD', 80.0, 440, 1600, 4.68, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Genesis', 'GV60', 'Sport AWD', null, null, 1600, 4.52, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Genesis', 'GV70', 'Electrified AWD', null, null, 1800, 4.72, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Ford', 'Capri', 'Extended Range', null, null, 1000, 4.63, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Ford', 'Explorer', 'Extended Range', null, null, 1000, 4.47, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Ford', 'Mustang Mach-E', 'Extended Range Premium', null, null, 1500, 4.74, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Porsche', 'Macan', '4 (Electric)', null, null, 2000, 4.78, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Cadillac', 'Lyriq', '600 E4 Luxury AWD', null, null, 1587, 4.99, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Lucid', 'Gravity', 'AWD', null, null, 2500, null, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Volvo', 'EX60', 'P10 AWD', 91.0, 500, 2400, 4.80, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('BYD', 'Tang', 'Flagship AWD', 108.8, 460, 1500, 4.87, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('BYD', 'Seal U', 'Design', 87.0, 425, 1300, 4.79, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11'),
  ('Citroën', 'ë-Spacetourer', 'XL', null, null, 1000, 5.30, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Maxus', 'Mifa 9', 'Luxury', null, null, 1000, 5.26, 'go-e.com Towing Guide 2026', 'unverified', '2026-09-11'),
  ('Renault', 'Megane E-Tech', 'EV60 220hp', 60.0, 380, 900, 4.21, 'ev-database.org / cararac.com', 'unverified', '2026-09-11'),
  ('Renault', 'Scenic E-Tech', 'EV87 220hp', 87.0, 480, 1100, 4.47, 'ev-database.org / cararac.com', 'unverified', '2026-09-11'),
  ('Toyota', 'bZ4X', 'Touring AWD 74.7 kWh', 71.0, 385, 1500, 4.69, 'ev-database.org / recharged.com', 'unverified', '2026-09-11'),
  ('Nissan', 'Ariya', '63 kWh', 63.0, null, 750, 4.60, 'carvago.com', 'unverified', '2026-09-11'),
  ('Skoda', 'Elroq', '85', 77.0, 450, 1800, 4.49, 'go-e.com Towing Guide 2026 / ev-database.org', 'unverified', '2026-09-11')
on conflict (manufacturer, model, variant) do nothing;
