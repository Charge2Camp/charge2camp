# Datenquellen

Jede externe Datenquelle wird hier dokumentiert, bevor sie produktiv
verwendet wird: Anbieter, URL, API, Lizenz, Kosten, Datenumfang,
Aktualisierungsintervall, kommerzielle Nutzung, Einschränkungen (§49).

Noch nicht final entschiedene Anbieter sind als **Research Required**
markiert.

## Karten

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| OpenStreetMap | https://www.openstreetmap.org | ODbL | kostenlos (Attribution nötig) | aktiv geplant (Phase 3/4) |
| MapLibre GL JS | https://maplibre.org | BSD-3-Clause | kostenlos | aktiv geplant |

## Ladeinfrastruktur

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| Open Charge Map | https://openchargemap.org | ODbL / CC0 (je nach Datensatz) | kostenlos, API-Key nötig | Research Required |
| Eco-Movement | https://ecomovement.com | kommerziell | kostenpflichtig | Research Required — Adapter/Mock zunächst |
| Eigene Startdaten (300+ anhängertaugliche Ladepunkte) | privat | eigene Daten | kostenlos | rechtliche Prüfung vor Import ausstehen (§17) |

## Routing

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| GraphHopper | https://www.graphhopper.com | Apache-2.0 (Open Source) / kommerzielle API | Free Tier + kostenpflichtig | Research Required |
| Valhalla | https://valhalla.github.io | MIT | kostenlos (Self-Hosting) | Research Required |
| OSRM | http://project-osrm.org | BSD-2-Clause | kostenlos (Self-Hosting) | Research Required |

## Verkehr

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| HERE Traffic API | https://developer.here.com | kommerziell | Free Tier + kostenpflichtig | Research Required |
| TomTom Traffic API | https://developer.tomtom.com | kommerziell | Free Tier + kostenpflichtig | Research Required |

## Ausdrücklich NICHT als Quelle verwendet (§34)

Google Maps, PiNCAMP, camping.info sowie andere kommerzielle
Campingportale werden nicht gescrapt oder ungeprüft übernommen.

## Demo-/Testdaten

Die Seed-Daten in [supabase/seed.sql](../supabase/seed.sql) sind
frei erfundene Testdaten (`source = 'demo'`, `[DEMO]`-Präfix im Namen) für
Deutschland, Kroatien und Italien — ausschließlich zur lokalen Entwicklung
und Demonstration der Funktionen, nicht produktiv nutzbar.
