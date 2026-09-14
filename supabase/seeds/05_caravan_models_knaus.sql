-- Knaus SUEDWIND und SPORT -- technische Daten von promobil.de (Herstellerangaben
-- aufbereitet). Kein zulaessiges Gesamtgewicht (zGG) verfuegbar -- Feld bleibt null,
-- Nutzer muessen es beim Speichern manuell ergaenzen. Siehe docs/data-sources.md.
insert into public.caravan_models
  (manufacturer, model, series, length_m, width_m, height_m, source, verification_status, last_verified_at)
values
  ('Knaus', '400 FD', 'SÜDWIND', 6.09, 2.29, 2.54, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 TS', 'SÜDWIND', 6.08, 2.29, 2.54, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '420 QD', 'SÜDWIND', 6.4, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '450 EL', 'SÜDWIND', 6.74, 2.29, 2.54, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '500 EU', 'SÜDWIND', 7.32, 2.29, 2.54, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '580 FSK', 'SÜDWIND', 7.82, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '650 PEB', 'SÜDWIND', 8.61, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '750 UDF', 'SÜDWIND', 9.47, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 LB', 'SPORT', 5.96, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 LK', 'SPORT', 5.96, 2.2, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 LK E.Power', 'SPORT', 6.05, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 LK Silver', 'SPORT', 5.99, 2.16, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '400 QD', 'SPORT', 5.96, 2.2, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '420 QB', 'SPORT', 6.4, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '420 QD', 'SPORT', 6.4, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '450 FU', 'SPORT', 6.66, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '460 EU', 'SPORT', 6.86, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '500 EU', 'SPORT', 7.28, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '500 KD', 'SPORT', 7.28, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '540 FDK', 'SPORT', 7.53, 2.32, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '580 QS', 'SPORT', 7.81, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '650 FDK', 'SPORT', 8.65, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05'),
  ('Knaus', '700 UFK', 'SPORT', 8.88, 2.5, 2.57, 'promobil.de (technische Daten)', 'unverified', '2026-09-05');
