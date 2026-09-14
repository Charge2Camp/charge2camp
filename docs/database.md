# Datenmodell

Quelle der Wahrheit: [supabase/migrations/20260904210000_init_schema.sql](../supabase/migrations/20260904210000_init_schema.sql).
TypeScript-Typen (handschriftlich, bis `supabase gen types` lokal laufen
kann): [src/types/database.ts](../src/types/database.ts).

## Tabellen

### profiles

1:1 mit `auth.users` (Supabase Auth). Wird automatisch per Trigger
(`handle_new_user`) bei Registrierung angelegt.

| Spalte | Typ | Hinweis |
|---|---|---|
| id | uuid | = auth.users.id |
| email | text | |
| is_admin | boolean | für Adminbereich (§37) |
| created_at | timestamptz | |

### vehicles (Elektroauto, §7)

id, user_id, manufacturer, model, battery_capacity_kwh,
consumption_kwh_per_100km (optional), charging_power_kw (optional),
range_km (optional), max_towing_weight_braked_kg (optional),
length_m (optional, Fahrzeuglaenge fuer Gespannlaenge-Berechnung),
model_reference_id (optional, verweist auf `vehicle_models`), created_at.
Kein Gewichtsfeld (siehe Hinweis unten bei `caravans`) — width_m/height_m
existieren als Spalten (aus der nie gebauten Strassenrestriktions-Pruefung,
§28ff), werden aber in keinem Formular abgefragt/angezeigt.

### caravans (Wohnwagen, §7)

id, user_id, manufacturer, model, length_m, width_m, height_m,
model_reference_id (optional, verweist auf `caravan_models`), created_at.
**Kein Gewichtsfeld** (Nutzerentscheidung, 2026-09-14): Gewicht hat keine
Bedeutung fuer Reichweite, Abmessungen oder die
Anhaengertauglichkeits-Kriterien einer Ladestation — `weight_kg`/
`gross_vehicle_weight_kg`/`actual_travel_weight_kg` wurden entfernt
(inkl. `vehicles.weight_kg`, das nur fuer eine nie implementierte
kombinierte Gespann-Gewichtspruefung existierte). `vehicles.
max_towing_weight_braked_kg` (Anhaengelast-Kapazitaet des Fahrzeugs) ist
davon unberuehrt, ein anderer Wert.

### vehicle_models / caravan_models (Referenzkataloge fuer Autofill, §7)

Oeffentlich lesbare Kataloge bekannter Fahrzeug-/Wohnwagenmodelle, aus denen
das Profilformular Hersteller/Modell/Abmessungen/Batteriedaten vorausfuellt
(`src/components/profile/vehicle-form.tsx`,
`src/components/profile/caravan-form.tsx`). `vehicle_models` enthaelt nur
Modelle mit werksseitig genehmigter Anhaengelast
(`max_towing_weight_braked_kg`). Beide Tabellen tragen `source` und
`verification_status` wie `campsites`/`charging_stations` (§38) — siehe
[data-sources.md](data-sources.md) fuer die Herkunft jedes Datensatzes.
Kein Anspruch auf vollstaendige Marktabdeckung; erweiterbar ueber den in §17
vorgesehenen Importmechanismus. Nutzer koennen die vorausgefuellten Werte
jederzeit manuell ueberschreiben, bevor sie gespeichert werden.

### campsites (§8)

Stammdaten (Name, Beschreibung, Adresse, Land, Region, Koordinaten,
Website, Telefon, Bild, Öffnungsstatus, Bewertungsschnitt),
Ausstattungs-Booleans (pool, sea, lake, river, mountain, family_friendly,
dogs_allowed, restaurant, supermarket, electricity, wifi), EV-Felder
(ev_charging_available, ev_charging_on_site, ev_charging_nearby,
max_charging_power_kw, number_of_charging_points) sowie Datenqualitäts-Felder
(`source`, `verification_status`, `last_verified_at`, siehe §38).

### charging_stations (§12, §16)

Betreiber, Standort, Ladeleistung, Steckertyp, Anzahl Anschlüsse, Status,
Preis, Währung, Öffnungszeiten, Quelle, letzte Aktualisierung, sowie die
Anhängertauglichkeits-Felder `trailer_suitable`
(`confirmed | likely | unsuitable | unknown`), `trailer_suitable_score`,
`trailer_notes`, `verified_by_community`.

### campsite_reviews / charging_reviews (§18, §19)

Community-Bewertungen. `charging_reviews` erfasst zusätzlich die
Gespannmaße der bewertenden Person (`trailer_length_m`, `trailer_width_m`,
`caravan_model`), damit spätere Auswertungen die Bewertung im Kontext der
Gespanngröße interpretieren können (§19, §20) statt als reine Ja/Nein-Quote.

`vehicle_id`/`caravan_id` (optional, verweisen auf die eigenen `vehicles`/
`caravans`-Datensätze des Bewertenden) dokumentieren, mit welcher
Fahrzeug/Wohnwagen-Kombination aus dem Profil bewertet wurde. Ist beides
bekannt, wird `trailer_length_m` automatisch als Fahrzeuglänge +
Wohnwagenlänge vorausgefüllt ("Gespannlänge gesamt") — Nutzer ohne
hinterlegtes Fahrzeug/Wohnwagen können die Werte weiterhin frei eingeben.
Diese Gespannlänge ist die Grundlage für die Verteilungsanzeige "Eignung
nach Gespannlänge" je Ladepunkt
([src/lib/scoring/trailer-compatibility.ts](../src/lib/scoring/trailer-compatibility.ts)).

`decoupled_parking_possible` (optional, nur relevant wenn
`suitable = 'limited'`): Zusatzfrage im Bewertungsformular, da man mit
Gespann meist nur abgekoppelt an die Ladesäule heranfahren kann — erfasst,
ob der Wohnwagen dabei bequem in unmittelbarer Nähe geparkt werden kann,
während das Zugfahrzeug lädt.

`enough_space_for_rig`, `unobstructed_access`, `no_barrier_or_garage`,
`side_mounted_charger` (alle optional, angelehnt an evcaravan.de):
strukturierte Einzelkriterien fuer "echten Drive-Through ohne Rangieren/
Abkoppeln" statt nur Freitext in `trailer_notes` -- machen
Community-Bewertungen konsistenter vergleichbar.

### saved_routes (§21–§27, Routenplaner)

Gespeicherte Routenplanungen: Start-/Ziel-Query + Koordinaten +
Anzeigename, Verweis auf `vehicles`/`caravans` (optional, `on delete set
null`), alle Ladeeinstellungen (Verbrauch, Mindest-Ladeleistung,
Anhängertauglichkeits-Präferenz, bevorzugter Anbieter, SOC-Werte,
Umweg-Toleranz), manuelle Zwischenstopps (`manual_stops`, jsonb-Array aus
{query, display_name, latitude, longitude} -- siehe
[architecture.md](architecture.md)) sowie die im Routenübersicht-Popup
getroffene Kuratierung (`excluded_station_ids`,
`forced_station_id_by_index`). Enthält bewusst KEINE fertige
Streckengeometrie/keinen fertigen Ladeplan — beim Öffnen wird mit
denselben Einstellungen frisch neu geplant (siehe
[architecture.md](architecture.md)).

### favorites

Composite Key (`user_id`, `entity_type`, `entity_id`) für Campingplätze und
Ladepunkte.

## Row Level Security

RLS ist auf allen Tabellen aktiv:

- `profiles`, `vehicles`, `caravans`, `favorites`, `saved_routes`: nur der
  Owner (`auth.uid() = user_id`) darf lesen/schreiben.
- `campsites`, `charging_stations`: öffentlich lesbar, Schreibzugriff aktuell
  nur über den `service_role`-Key (Admin-/Importskripte, §37). Policies für
  ein rollenbasiertes Admin-UI folgen mit dem Adminbereich.
- `campsite_reviews`, `charging_reviews`: öffentlich lesbar, Insert/Update/
  Delete nur durch den Autor.

## Datenqualität (§38)

Jeder importierte Datensatz trägt `source` und `verification_status`
(`unverified | verified | community_verified | official`) sowie
`last_verified_at`. Demo-Seed-Daten verwenden `source = 'demo'` und sind im
UI zusätzlich mit einem `[DEMO]`-Präfix im Namen gekennzeichnet.
