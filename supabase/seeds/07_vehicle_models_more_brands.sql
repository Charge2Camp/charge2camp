-- Nutzerwunsch 2026-09-25: "alle Marken in Europa" ergaenzen. Katalog deckte
-- bereits 38 Marken ab (siehe 03_vehicle_models.sql) -- Abgleich gegen
-- ev-database.org's Anhaengelast-Cheatsheet (https://ev-database.org/de/
-- cheatsheet/anhaengelast-elektroauto, alle aktuell in Europa erhaeltlichen
-- E-Autos mit zugelassener Anhaengerkupplung) ergibt 13 fehlende Marken.
-- Batteriegroesse nur uebernommen, wenn im Modellnamen der Quelle explizit
-- angegeben -- sonst bewusst NULL statt geschaetzt (keine Scheindaten,
-- gleiches Prinzip wie 03_vehicle_models.sql).
insert into public.vehicle_models
  (manufacturer, model, variant, battery_capacity_kwh, max_towing_weight_braked_kg, source, verification_status, last_verified_at)
values
  ('Land Rover', 'Range Rover', 'EV450', null, 2500, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Lotus', 'Eletre', '600', null, 2250, 'ev-database.org', 'unverified', '2026-09-25'),
  ('NIO', 'EL8', 'Long Range', null, 2000, 'ev-database.org', 'unverified', '2026-09-25'),
  ('VinFast', 'VF 8', 'Plus Vergrößerte Reichweite', null, 1800, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Smart', '#1', 'Brabus', null, 1600, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Lynk&Co', '02', 'Standard', null, 1600, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Mini', 'Countryman', 'SE ALL4', null, 1200, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Subaru', 'Solterra', 'AWD 73.1 kWh', 73.1, 1500, 'ev-database.org', 'unverified', '2026-09-25'),
  ('DS Automobiles', 'N°8', 'AWD Long Range', null, 1400, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Jeep', 'Compass', 'Elektro 74 kWh', 74.0, 1230, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Mitsubishi', 'Eclipse Cross', '87 kWh', 87.0, 1100, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Maserati', 'Grecale', 'Folgore', null, 1800, 'ev-database.org', 'unverified', '2026-09-25'),
  ('Alpine', 'A390', 'GT', null, 1350, 'ev-database.org', 'unverified', '2026-09-25')
on conflict (manufacturer, model, variant) do nothing;
