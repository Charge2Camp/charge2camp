-- Demo/Testdaten fuer die lokale Entwicklung.
-- Diese Daten sind AUSDRUECKLICH Demo-Daten (siehe docs/data-sources.md, Regel "Keine Scheindaten").
-- source = 'demo' markiert sie eindeutig als nicht-echte Daten.

insert into public.campsites (
  id, name, description, address, country, region, latitude, longitude,
  website, phone, is_open, rating_avg,
  pool, sea, lake, river, mountain, family_friendly, dogs_allowed, restaurant, supermarket, electricity, wifi,
  ev_charging_available, ev_charging_on_site, ev_charging_nearby, max_charging_power_kw, number_of_charging_points,
  source, verification_status, last_verified_at
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '[DEMO] Camping Seeblick',
    'Demo-Campingplatz am Chiemsee mit Elektroauto-Ladeinfrastruktur (Testdaten).',
    'Seestrasse 1, 83209 Prien am Chiemsee', 'Deutschland', 'Bayern', 47.8608, 12.3453,
    'https://example.com/camping-seeblick', '+49 8051 000000', true, 4.5,
    true, false, true, false, true, true, true, true, true, true, true,
    true, true, true, 11, 4,
    'demo', 'unverified', now()
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '[DEMO] Camping Adria Sole',
    'Demo-Campingplatz an der kroatischen Adria (Testdaten).',
    'Obala 5, 52440 Porec', 'Kroatien', 'Istrien', 45.2269, 13.5947,
    'https://example.com/camping-adria-sole', '+385 52 000000', true, 4.2,
    true, true, false, false, false, true, false, true, true, true, true,
    true, false, true, 150, 6,
    'demo', 'unverified', now()
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '[DEMO] Camping Dolomiti Verde',
    'Demo-Campingplatz in den italienischen Dolomiten (Testdaten).',
    'Via Roma 10, 32043 Cortina d''Ampezzo', 'Italien', 'Venetien', 46.5405, 12.1357,
    'https://example.com/camping-dolomiti-verde', '+39 0436 000000', true, 4.7,
    false, false, true, true, true, true, true, true, true, true, true,
    false, false, false, null, null,
    'demo', 'unverified', now()
  );

insert into public.charging_stations (
  id, provider, name, address, latitude, longitude,
  power_kw, connector_type, connector_count, status, price, currency, opening_hours,
  trailer_suitable, trailer_suitable_score, trailer_notes, verified_by_community,
  source, verification_status, last_verified_at, last_updated
) values
  (
    'aaaaaaaa-1111-1111-1111-111111111111',
    '[DEMO] IONITY',
    '[DEMO] Schnelllader A8 Rastplatz',
    'A8 Raststaette Nord, 83233 Bernau', 47.7784, 12.3823,
    350, 'CCS', 6, 'demo_status_unknown', 0.69, 'EUR', '24/7',
    'confirmed', 92, 'Drive-Through, breite Zufahrt, Gespann muss nicht abgekoppelt werden.', true,
    'demo', 'unverified', now(), now()
  ),
  (
    'aaaaaaaa-2222-2222-2222-222222222222',
    '[DEMO] EnBW',
    '[DEMO] Ladepark Chiemsee',
    'Seestrasse 20, 83209 Prien am Chiemsee', 47.8590, 12.3410,
    150, 'CCS', 4, 'demo_status_unknown', 0.55, 'EUR', '06:00-22:00',
    'likely', 70, 'Ausreichend Platz laut Community, aber keine offizielle Bestaetigung.', false,
    'demo', 'unverified', now(), now()
  ),
  (
    'aaaaaaaa-3333-3333-3333-333333333333',
    '[DEMO] Tesla Supercharger',
    '[DEMO] Supercharger Porec',
    'Obala 1, 52440 Porec', 45.2280, 13.5920,
    250, 'CCS', 8, 'demo_status_unknown', 0.45, 'EUR', '24/7',
    'unsuitable', 20, 'Enge Parkplaetze, laut mehreren Meldungen nicht gespanntauglich.', true,
    'demo', 'unverified', now(), now()
  );
