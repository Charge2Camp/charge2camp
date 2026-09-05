-- Testdaten: ca. 50 Ladesaeulen entlang der Route Muenchen -> Meran (Brennerroute),
-- mit unterschiedlichen Ladeleistungen, Anhaengertauglichkeits-Einstufungen und
-- Entfernungen zur Route (von <1 km bis ~90 km), um die Routenplanung
-- (Kandidatensuche, Umweg-Toleranz-Slider, Anhaengertauglichkeits-Priorisierung)
-- realistisch testen zu koennen. Siehe Regel "Keine Scheindaten" (CLAUDE.md):
-- eindeutig als [DEMO] gekennzeichnet, source = 'demo'.

insert into public.charging_stations (
  id, provider, name, address, latitude, longitude,
  power_kw, connector_type, connector_count, status, price, currency, opening_hours,
  trailer_suitable, trailer_suitable_score, trailer_notes, verified_by_community,
  source, verification_status, last_verified_at, last_updated
) values
  (
    'bbbbbbbb-0000-0000-0000-000000000001', '[DEMO] Allego', '[DEMO] Ladepark Muenchen Umgebung 1', 'Teststrecke Muenchen-Meran, Abschnitt Muenchen-Holzkirchen',
    48.16148, 11.49926, 175, 'CCS', 4, 'demo_status_unknown', 0.66, 'EUR', '24/7',
    'confirmed', 89, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000002', '[DEMO] EnBW', '[DEMO] Ladepark Muenchen 2', 'Teststrecke Muenchen-Meran, Abschnitt Muenchen-Holzkirchen',
    48.06769, 11.66040, 200, 'CCS', 6, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'confirmed', 86, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000003', '[DEMO] IONITY', '[DEMO] Ladepark Muenchen 3', 'Teststrecke Muenchen-Meran, Abschnitt Muenchen-Holzkirchen',
    48.03287, 11.69161, 11, 'Type2', 4, 'demo_status_unknown', 0.38, 'EUR', '24/7',
    'likely', 62, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000004', '[DEMO] Fastned', '[DEMO] Ladepark Holzkirchen Umgebung 4', 'Teststrecke Muenchen-Meran, Abschnitt Holzkirchen-Rosenheim',
    48.06930, 11.87953, 43, 'CCS', 8, 'demo_status_unknown', 0.51, 'EUR', '24/7',
    'unknown', 44, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000005', '[DEMO] Aral pulse', '[DEMO] Ladepark Holzkirchen 5', 'Teststrecke Muenchen-Meran, Abschnitt Holzkirchen-Rosenheim',
    47.91981, 11.94199, 150, 'CCS', 3, 'demo_status_unknown', 0.50, 'EUR', '24/7',
    'confirmed', 87, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000006', '[DEMO] IONITY', '[DEMO] Ladepark Holzkirchen Umgebung 6', 'Teststrecke Muenchen-Meran, Abschnitt Holzkirchen-Rosenheim',
    47.97895, 12.48989, 50, 'CCS', 7, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'confirmed', 87, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000007', '[DEMO] EnBW', '[DEMO] Ladepark Rosenheim Umgebung 7', 'Teststrecke Muenchen-Meran, Abschnitt Rosenheim-Oberaudorf',
    48.00842, 12.03902, 100, 'CCS', 2, 'demo_status_unknown', 0.36, 'EUR', '24/7',
    'unsuitable', 19, 'Enge Parkplaetze/Zufahrt, laut Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000008', '[DEMO] Plugsurfing', '[DEMO] Ladepark Rosenheim 8', 'Teststrecke Muenchen-Meran, Abschnitt Rosenheim-Oberaudorf',
    47.79585, 12.14009, 22, 'Type2', 4, 'demo_status_unknown', 0.70, 'EUR', '24/7',
    'unknown', 42, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000009', '[DEMO] Plugsurfing', '[DEMO] Ladepark Rosenheim 9', 'Teststrecke Muenchen-Meran, Abschnitt Rosenheim-Oberaudorf',
    47.76054, 12.20499, 350, 'CCS', 5, 'demo_status_unknown', 0.64, 'EUR', '24/7',
    'likely', 63, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000010', '[DEMO] EVBox', '[DEMO] Ladepark Oberaudorf Umgebung 10', 'Teststrecke Muenchen-Meran, Abschnitt Oberaudorf-Kufstein',
    47.65796, 12.05327, 50, 'CCS', 7, 'demo_status_unknown', 0.85, 'EUR', '24/7',
    'likely', 69, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000011', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Oberaudorf 11', 'Teststrecke Muenchen-Meran, Abschnitt Oberaudorf-Kufstein',
    47.63321, 12.20570, 22, 'Type2', 8, 'demo_status_unknown', 0.80, 'EUR', '24/7',
    'unknown', 41, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000012', '[DEMO] Aral pulse', '[DEMO] Ladepark Oberaudorf 12', 'Teststrecke Muenchen-Meran, Abschnitt Oberaudorf-Kufstein',
    47.62848, 12.20365, 350, 'CCS', 7, 'demo_status_unknown', 0.46, 'EUR', '24/7',
    'confirmed', 84, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000013', '[DEMO] Plugsurfing', '[DEMO] Ladepark Kufstein 13', 'Teststrecke Muenchen-Meran, Abschnitt Kufstein-Woergl',
    47.54190, 12.17046, 43, 'CCS', 4, 'demo_status_unknown', 0.75, 'EUR', '24/7',
    'likely', 64, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000014', '[DEMO] Aral pulse', '[DEMO] Ladepark Kufstein 14', 'Teststrecke Muenchen-Meran, Abschnitt Kufstein-Woergl',
    47.50919, 12.14911, 11, 'Type2', 9, 'demo_status_unknown', 0.80, 'EUR', '24/7',
    'unknown', 42, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000015', '[DEMO] Aral pulse', '[DEMO] Ladepark Kufstein Umgebung 15', 'Teststrecke Muenchen-Meran, Abschnitt Kufstein-Woergl',
    47.55165, 12.24104, 11, 'Type2', 4, 'demo_status_unknown', 0.49, 'EUR', '24/7',
    'unknown', 43, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000016', '[DEMO] EnBW', '[DEMO] Ladepark Woergl 16', 'Teststrecke Muenchen-Meran, Abschnitt Woergl-Schwaz',
    47.45043, 11.94607, 150, 'CCS', 3, 'demo_status_unknown', 0.63, 'EUR', '24/7',
    'unsuitable', 18, 'Enge Parkplaetze/Zufahrt, laut Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000017', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Woergl 17', 'Teststrecke Muenchen-Meran, Abschnitt Woergl-Schwaz',
    47.38801, 11.83905, 175, 'CCS', 9, 'demo_status_unknown', 0.51, 'EUR', '24/7',
    'likely', 65, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000018', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Woergl Umgebung 18', 'Teststrecke Muenchen-Meran, Abschnitt Woergl-Schwaz',
    47.26017, 11.61547, 50, 'CCS', 4, 'demo_status_unknown', 0.68, 'EUR', '24/7',
    'confirmed', 82, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000019', '[DEMO] IONITY', '[DEMO] Ladepark Schwaz 19', 'Teststrecke Muenchen-Meran, Abschnitt Schwaz-Innsbruck',
    47.29747, 11.57749, 22, 'Type2', 6, 'demo_status_unknown', 0.45, 'EUR', '24/7',
    'confirmed', 85, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000020', '[DEMO] EnBW', '[DEMO] Ladepark Schwaz 20', 'Teststrecke Muenchen-Meran, Abschnitt Schwaz-Innsbruck',
    47.31649, 11.47731, 250, 'CCS', 8, 'demo_status_unknown', 0.61, 'EUR', '24/7',
    'likely', 68, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000021', '[DEMO] EnBW', '[DEMO] Ladepark Schwaz Umgebung 21', 'Teststrecke Muenchen-Meran, Abschnitt Schwaz-Innsbruck',
    47.46449, 11.80485, 175, 'CCS', 5, 'demo_status_unknown', 0.62, 'EUR', '24/7',
    'unknown', 50, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000022', '[DEMO] IONITY', '[DEMO] Ladepark Innsbruck 22', 'Teststrecke Muenchen-Meran, Abschnitt Innsbruck-Schoenberg',
    47.26069, 11.38173, 200, 'CCS', 3, 'demo_status_unknown', 0.60, 'EUR', '24/7',
    'confirmed', 87, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000023', '[DEMO] EVBox', '[DEMO] Ladepark Innsbruck Umgebung 23', 'Teststrecke Muenchen-Meran, Abschnitt Innsbruck-Schoenberg',
    47.29006, 11.19415, 175, 'CCS', 6, 'demo_status_unknown', 0.53, 'EUR', '24/7',
    'unknown', 44, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000024', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Innsbruck Umgebung 24', 'Teststrecke Muenchen-Meran, Abschnitt Innsbruck-Schoenberg',
    46.97963, 11.88616, 350, 'CCS', 8, 'demo_status_unknown', 0.43, 'EUR', '24/7',
    'likely', 64, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000025', '[DEMO] Plugsurfing', '[DEMO] Ladepark Schoenberg 25', 'Teststrecke Muenchen-Meran, Abschnitt Schoenberg-Brennerpass',
    47.12373, 11.47295, 200, 'CCS', 5, 'demo_status_unknown', 0.70, 'EUR', '24/7',
    'unsuitable', 16, 'Enge Parkplaetze/Zufahrt, laut Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000026', '[DEMO] Allego', '[DEMO] Ladepark Schoenberg 26', 'Teststrecke Muenchen-Meran, Abschnitt Schoenberg-Brennerpass',
    47.08924, 11.48862, 50, 'CCS', 7, 'demo_status_unknown', 0.75, 'EUR', '24/7',
    'likely', 68, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000027', '[DEMO] Fastned', '[DEMO] Ladepark Schoenberg 27', 'Teststrecke Muenchen-Meran, Abschnitt Schoenberg-Brennerpass',
    47.01946, 11.49239, 100, 'CCS', 5, 'demo_status_unknown', 0.52, 'EUR', '24/7',
    'likely', 63, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000028', '[DEMO] Aral pulse', '[DEMO] Ladepark Brennerpass 28', 'Teststrecke Muenchen-Meran, Abschnitt Brennerpass-Sterzing',
    46.97322, 11.51442, 120, 'CCS', 5, 'demo_status_unknown', 0.42, 'EUR', '24/7',
    'likely', 60, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000029', '[DEMO] Allego', '[DEMO] Ladepark Brennerpass 29', 'Teststrecke Muenchen-Meran, Abschnitt Brennerpass-Sterzing',
    46.97902, 11.49065, 300, 'CCS', 2, 'demo_status_unknown', 0.76, 'EUR', '24/7',
    'likely', 61, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000030', '[DEMO] Plugsurfing', '[DEMO] Ladepark Brennerpass 30', 'Teststrecke Muenchen-Meran, Abschnitt Brennerpass-Sterzing',
    46.91878, 11.43979, 150, 'CCS', 8, 'demo_status_unknown', 0.68, 'EUR', '24/7',
    'confirmed', 88, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000031', '[DEMO] IONITY', '[DEMO] Ladepark Sterzing 31', 'Teststrecke Muenchen-Meran, Abschnitt Sterzing-Franzensfeste',
    46.84624, 11.46765, 43, 'CCS', 2, 'demo_status_unknown', 0.48, 'EUR', '24/7',
    'confirmed', 87, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000032', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Sterzing Umgebung 32', 'Teststrecke Muenchen-Meran, Abschnitt Sterzing-Franzensfeste',
    46.97501, 11.49071, 11, 'Type2', 4, 'demo_status_unknown', 0.77, 'EUR', '24/7',
    'likely', 65, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000033', '[DEMO] EVBox', '[DEMO] Ladepark Sterzing 33', 'Teststrecke Muenchen-Meran, Abschnitt Sterzing-Franzensfeste',
    46.86857, 11.54353, 50, 'CCS', 9, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'likely', 66, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000034', '[DEMO] Aral pulse', '[DEMO] Ladepark Franzensfeste Umgebung 34', 'Teststrecke Muenchen-Meran, Abschnitt Franzensfeste-Brixen',
    46.52739, 11.62699, 200, 'CCS', 6, 'demo_status_unknown', 0.62, 'EUR', '24/7',
    'likely', 70, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000035', '[DEMO] EVBox', '[DEMO] Ladepark Franzensfeste Umgebung 35', 'Teststrecke Muenchen-Meran, Abschnitt Franzensfeste-Brixen',
    46.50464, 12.61452, 175, 'CCS', 5, 'demo_status_unknown', 0.79, 'EUR', '24/7',
    'unknown', 43, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000036', '[DEMO] Allego', '[DEMO] Ladepark Franzensfeste Umgebung 36', 'Teststrecke Muenchen-Meran, Abschnitt Franzensfeste-Brixen',
    46.58586, 11.99761, 120, 'CCS', 8, 'demo_status_unknown', 0.70, 'EUR', '24/7',
    'unknown', 42, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000037', '[DEMO] EVBox', '[DEMO] Ladepark Brixen 37', 'Teststrecke Muenchen-Meran, Abschnitt Brixen-Klausen',
    46.66133, 11.63341, 50, 'CCS', 7, 'demo_status_unknown', 0.71, 'EUR', '24/7',
    'likely', 62, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000038', '[DEMO] Fastned', '[DEMO] Ladepark Brixen Umgebung 38', 'Teststrecke Muenchen-Meran, Abschnitt Brixen-Klausen',
    46.26753, 11.43689, 120, 'CCS', 9, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'confirmed', 84, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000039', '[DEMO] EnBW', '[DEMO] Ladepark Brixen 39', 'Teststrecke Muenchen-Meran, Abschnitt Brixen-Klausen',
    46.64962, 11.55587, 120, 'CCS', 2, 'demo_status_unknown', 0.41, 'EUR', '24/7',
    'confirmed', 84, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000040', '[DEMO] Tesla Supercharger', '[DEMO] Ladepark Klausen Umgebung 40', 'Teststrecke Muenchen-Meran, Abschnitt Klausen-Waidbruck',
    46.45130, 11.01336, 22, 'Type2', 7, 'demo_status_unknown', 0.48, 'EUR', '24/7',
    'confirmed', 89, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000041', '[DEMO] Aral pulse', '[DEMO] Ladepark Klausen Umgebung 41', 'Teststrecke Muenchen-Meran, Abschnitt Klausen-Waidbruck',
    46.72809, 11.38377, 75, 'CCS', 3, 'demo_status_unknown', 0.59, 'EUR', '24/7',
    'confirmed', 83, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000042', '[DEMO] IONITY', '[DEMO] Ladepark Klausen 42', 'Teststrecke Muenchen-Meran, Abschnitt Klausen-Waidbruck',
    46.55757, 11.52469, 120, 'CCS', 8, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'likely', 69, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000043', '[DEMO] EnBW', '[DEMO] Ladepark Waidbruck 43', 'Teststrecke Muenchen-Meran, Abschnitt Waidbruck-Bozen',
    46.55167, 11.47686, 75, 'CCS', 9, 'demo_status_unknown', 0.64, 'EUR', '24/7',
    'confirmed', 88, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000044', '[DEMO] Fastned', '[DEMO] Ladepark Waidbruck 44', 'Teststrecke Muenchen-Meran, Abschnitt Waidbruck-Bozen',
    46.55542, 11.44256, 200, 'CCS', 3, 'demo_status_unknown', 0.74, 'EUR', '24/7',
    'unknown', 45, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000045', '[DEMO] EVBox', '[DEMO] Ladepark Waidbruck 45', 'Teststrecke Muenchen-Meran, Abschnitt Waidbruck-Bozen',
    46.51582, 11.39100, 100, 'CCS', 5, 'demo_status_unknown', 0.83, 'EUR', '24/7',
    'unsuitable', 17, 'Enge Parkplaetze/Zufahrt, laut Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000046', '[DEMO] EnBW', '[DEMO] Ladepark Bozen 46', 'Teststrecke Muenchen-Meran, Abschnitt Bozen-Terlan',
    46.49797, 11.30287, 43, 'CCS', 3, 'demo_status_unknown', 0.68, 'EUR', '24/7',
    'unknown', 46, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000047', '[DEMO] IONITY', '[DEMO] Ladepark Bozen Umgebung 47', 'Teststrecke Muenchen-Meran, Abschnitt Bozen-Terlan',
    46.58003, 11.25263, 120, 'CCS', 9, 'demo_status_unknown', 0.64, 'EUR', '24/7',
    'unknown', 43, 'Noch keine Community-Rueckmeldung zur Anhaengertauglichkeit.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000048', '[DEMO] EVBox', '[DEMO] Ladepark Bozen 48', 'Teststrecke Muenchen-Meran, Abschnitt Bozen-Terlan',
    46.52177, 11.25960, 200, 'CCS', 5, 'demo_status_unknown', 0.44, 'EUR', '24/7',
    'confirmed', 86, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000049', '[DEMO] Plugsurfing', '[DEMO] Ladepark Terlan 49', 'Teststrecke Muenchen-Meran, Abschnitt Terlan-Meran',
    46.57195, 11.21935, 22, 'Type2', 3, 'demo_status_unknown', 0.59, 'EUR', '24/7',
    'confirmed', 85, 'Breite Stellplaetze, Gespann muss laut Community nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000050', '[DEMO] EVBox', '[DEMO] Ladepark Terlan Umgebung 50', 'Teststrecke Muenchen-Meran, Abschnitt Terlan-Meran',
    46.55182, 11.06151, 43, 'CCS', 4, 'demo_status_unknown', 0.45, 'EUR', '24/7',
    'unsuitable', 20, 'Enge Parkplaetze/Zufahrt, laut Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'bbbbbbbb-0000-0000-0000-000000000051', '[DEMO] IONITY', '[DEMO] Ladepark Terlan Umgebung 51', 'Teststrecke Muenchen-Meran, Abschnitt Terlan-Meran',
    46.53217, 11.19601, 50, 'CCS', 8, 'demo_status_unknown', 0.53, 'EUR', '24/7',
    'likely', 64, 'Ausreichend Platz laut ersten Meldungen, aber noch nicht offiziell bestaetigt.', false,
    'demo', 'unverified', now(), now()
  );
