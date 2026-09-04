-- Dethleffs (c'joy, c'go & c'go up, SUMMER EDITION, MJ2027) und Tabbert (CAZADORA,
-- MJ2026-1) -- offizielle Herstellerdaten. Siehe docs/data-sources.md.
insert into public.caravan_models
  (manufacturer, model, series, length_m, width_m, height_m, weight_kg, gross_vehicle_weight_kg, source, verification_status, last_verified_at)
values
  ('Dethleffs', '420 QSH', 'c''joy', 6.25, 2.13, 2.63, 927, 1100, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '460 LE', 'c''joy', 6.75, 2.13, 2.63, 953, 1200, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '480 QLK', 'c''joy', 7.14, 2.13, 2.63, 1068, 1300, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '475 EL', 'c''go & c''go up', 6.76, 2.33, 2.59, 1124, 1300, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '495 FR', 'c''go & c''go up', 7.25, 2.33, 2.59, 1122, 1360, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '495 QSK up', 'c''go & c''go up', 7.14, 2.33, 2.59, 1154, 1360, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '525 KR', 'c''go & c''go up', 7.55, 2.33, 2.69, 1330, 1600, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '510 LE', 'SUMMER EDITION', 7.65, 2.3, 2.82, 1335, 1800, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '530 DR', 'SUMMER EDITION', 7.84, 2.3, 2.82, 1380, 2000, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '530 FSK', 'SUMMER EDITION', 7.92, 2.3, 2.82, 1400, 2000, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '540 QMK', 'SUMMER EDITION', 7.73, 2.5, 2.82, 1490, 2000, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '560 FMK', 'SUMMER EDITION', 8.22, 2.5, 2.82, 1580, 2000, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '650 RQT', 'SUMMER EDITION', 8.75, 2.5, 2.82, 1830, 2500, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Dethleffs', '730 FKR', 'SUMMER EDITION', 9.45, 2.5, 2.82, 1825, 2500, 'dethleffs.de (Preisliste Wohnwagen MJ2027)', 'verified', '2027-02-01'),
  ('Tabbert', '420 QD', 'CAZADORA', 6.49, 2.32, 2.6, 1136, 1300, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '460 E', 'CAZADORA', 6.97, 2.32, 2.6, 1236, 1400, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '490 TD', 'CAZADORA', 7.33, 2.32, 2.6, 1296, 1500, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '495 HE', 'CAZADORA', 7.33, 2.32, 2.6, 1336, 1500, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '550 E', 'CAZADORA', 7.93, 2.32, 2.6, 1368, 1600, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '550 DMK', 'CAZADORA', 7.92, 2.5, 2.6, 1438, 1600, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '560 HTD', 'CAZADORA', 8.11, 2.5, 2.6, 1513, 1700, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '620 DMK', 'CAZADORA', 8.35, 2.5, 2.6, 1611, 2000, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '655 MEB', 'CAZADORA', 8.65, 2.5, 2.6, 1676, 2000, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01'),
  ('Tabbert', '700 KD', 'CAZADORA', 9.49, 2.5, 2.6, 1886, 2200, 'tabbert.com (Preisliste Wohnwagen MJ2026-1)', 'verified', '2025-08-01');
