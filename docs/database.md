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
range_km (optional), created_at.

### caravans (Wohnwagen, §7)

id, user_id, manufacturer, model, length_m, width_m, height_m, weight_kg,
gross_vehicle_weight_kg (optional), actual_travel_weight_kg (optional),
created_at.

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

### favorites

Composite Key (`user_id`, `entity_type`, `entity_id`) für Campingplätze und
Ladepunkte.

## Row Level Security

RLS ist auf allen Tabellen aktiv:

- `profiles`, `vehicles`, `caravans`, `favorites`: nur der Owner
  (`auth.uid() = user_id`) darf lesen/schreiben.
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
