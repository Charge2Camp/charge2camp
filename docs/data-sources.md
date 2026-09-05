# Datenquellen

Jede externe Datenquelle wird hier dokumentiert, bevor sie produktiv
verwendet wird: Anbieter, URL, API, Lizenz, Kosten, Datenumfang,
Aktualisierungsintervall, kommerzielle Nutzung, Einschränkungen (§49).

Noch nicht final entschiedene Anbieter sind als **Research Required**
markiert.

## Karten

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| OpenStreetMap | https://www.openstreetmap.org | ODbL | kostenlos (Attribution nötig) | aktiv seit Phase 3 |
| MapLibre GL JS | https://maplibre.org | BSD-3-Clause | kostenlos | aktiv seit Phase 3 |

**Hinweis Kachel-Server (Phase 3):** Die Karte nutzt aktuell die öffentlichen
`tile.openstreetmap.org`-Rasterkacheln direkt (kein API-Key nötig, siehe
[src/components/map/osm-style.ts](../src/components/map/osm-style.ts)).
Das ist für lokale Entwicklung und MVP-Traffic in Ordnung, verstößt aber bei
höherem Produktions-Traffic gegen die
[OSM Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/).
Vor dem produktiven Rollout muss auf einen eigenen Tile-Cache oder einen
Anbieter mit OSM-Lizenz (z. B. MapTiler, Stadia Maps, Geofabrik) umgestellt
werden.

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
| OSRM (Demo-Server) | https://router.project-osrm.org | BSD-2-Clause, Demo-Server nur zur Evaluierung | kostenlos, kein API-Key | aktiv seit Phase 6 |

**Hinweis OSRM-Demo-Server (Phase 6):** Genutzt über
[src/lib/providers/routing/osrm.ts](../src/lib/providers/routing/osrm.ts).
Laut OSRM-Projekt ist der öffentliche Demo-Server ausdrücklich nur für
Tests/geringen Traffic gedacht, nicht für Produktivbetrieb. Vor dem
produktiven Rollout muss auf einen selbst gehosteten OSRM/Valhalla/
GraphHopper-Server umgestellt werden — dafür genügt ein neuer Adapter
gegen dasselbe `RoutingProvider`-Interface (siehe [api.md](api.md)).

## Geocoding

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| Nominatim (OpenStreetMap) | https://nominatim.openstreetmap.org | ODbL, [Nutzungsrichtlinie](https://operations.osmfoundation.org/policies/nominatim/) | kostenlos, kein API-Key | aktiv seit Phase 6 |

**Hinweis Nominatim (Phase 6):** Genutzt über
[src/lib/providers/geocoding/nominatim.ts](../src/lib/providers/geocoding/nominatim.ts)
zur Umwandlung von Start-/Zieladressen in Koordinaten. Die
Nutzungsrichtlinie erlaubt max. 1 Anfrage/Sekunde und verlangt einen
aussagekräftigen User-Agent (beides im Adapter berücksichtigt). Für
höheren Produktions-Traffic muss auf einen selbst gehosteten
Nominatim-Server oder einen kommerziellen Geocoder umgestellt werden.

## Verkehr

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| HERE Traffic API | https://developer.here.com | kommerziell | Free Tier + kostenpflichtig | Research Required |
| TomTom Traffic API | https://developer.tomtom.com | kommerziell | Free Tier + kostenpflichtig | Research Required |

## Fahrzeug-/Wohnwagen-Referenzkataloge (Autofill im Profil, §7)

Kuratierte Starterdatensätze für die Modellauswahl mit Autofill in
`vehicle_models` / `caravan_models`. **Keine vollständige Marktabdeckung** —
bewusst begrenzter, aber recherchierter Kernbestand statt erfundener
Platzhalterwerte (§2, §39). Erweiterbar über den in §17 vorgesehenen
Importmechanismus (CSV/JSON), sobald weitere Marken/Modelle aufgenommen
werden.

| Anbieter | URL | Lizenz/Nutzung | Umfang | Stand |
|---|---|---|---|---|
| Hobby (Preisliste Wohnwagen 2026, offizielles Herstellerdokument) | https://www.hobby-caravan.de | öffentlich publizierte technische Daten, Referenzangabe der Quelle | alle 37 Modelle Modelljahr 2026 (Serien ONTOUR, DE LUXE, EXCELLENT, EXCELLENT EDITION, PRESTIGE, MAXIA) | 2026-05-06 |
| EV Database (ev-database.org) | https://ev-database.org | öffentlich zugängliche Vergleichsdaten, Referenzangabe der Quelle | 9 E-Auto-Varianten mit genehmigter Anhängelast | 2026-09-04 |
| evkx.net / Herstellerangaben (VW, Škoda, Audi) | https://evkx.net | öffentlich zugängliche Spezifikationsdaten | 3 E-Auto-Varianten | 2026-09-04 |
| go-e.com Towing Guide 2026 | https://go-e.com/en/magazine/ev-towing-trailers-guide | öffentlicher Artikel, nur Anhängelast übernommen | 2 E-Auto-Varianten (Audi A6 Avant e-tron, Polestar 3) | 2026-09-04 |
| evspecifications.com | https://www.evspecifications.com | öffentlich zugängliche Spezifikationsdaten | Kia EV9 GT-Line AWD | 2026-09-04 |
| Dethleffs (Preisliste Wohnwagen, offizielles Herstellerdokument) | https://www.dethleffs.de | öffentlich publizierte technische Daten, Referenzangabe der Quelle | 14 Modelle MJ2027 (Serien c'joy, c'go & c'go up, SUMMER EDITION) | 2027-02-01 |
| Tabbert (Preisliste Wohnwagen, offizielles Herstellerdokument) | https://www.tabbert.com | öffentlich publizierte technische Daten, Referenzangabe der Quelle | 10 Modelle MJ2026-1 (Serie CAZADORA) | 2025-08-01 |
| Knaus (technische Daten, aufbereitet von promobil.de aus Herstellerangaben) | https://www.promobil.de | öffentlich zugängliche Spezifikationsdaten | 23 Modelle (Serien SÜDWIND, SPORT) — **ohne zulässiges Gesamtgewicht**, dieses Feld bleibt bewusst leer statt geschätzt | 2026-09-05 |

Alle Einträge tragen `source` und `verification_status = 'unverified'` (bzw.
`'verified'` bei Hobby/Dethleffs/Tabbert, da direkt aus offiziellen
Herstellerdokumenten). Fahrzeuge ohne werksseitig genehmigte Anhängelast
wurden bewusst nicht aufgenommen. Andere Wohnwagenmarken (Adria, Fendt,
Bürstner, Weinsberg, LMC, …) sind als **Research Required** vorgemerkt und
noch nicht enthalten. Bei Knaus war keine öffentlich zugängliche Quelle mit
zulässigem Gesamtgewicht pro Modell auffindbar (die offizielle Preisliste war
zum Zeitpunkt der Recherche nicht erreichbar) — das Feld bleibt für diese 23
Modelle `null`, statt einen plausiblen, aber ungeprüften Wert einzutragen.

## Ausdrücklich NICHT als Quelle verwendet (§34)

Google Maps, PiNCAMP, camping.info sowie andere kommerzielle
Campingportale werden nicht gescrapt oder ungeprüft übernommen.

## Demo-/Testdaten

Die Seed-Daten in [supabase/seeds/01_demo_data.sql](../supabase/seeds/01_demo_data.sql)
sind frei erfundene Testdaten (`source = 'demo'`, `[DEMO]`-Präfix im Namen)
für Deutschland, Kroatien und Italien — ausschließlich zur lokalen
Entwicklung und Demonstration der Funktionen, nicht produktiv nutzbar. Die
Fahrzeug-/Wohnwagen-Referenzkataloge in `supabase/seeds/02_caravan_models.sql`,
`supabase/seeds/03_vehicle_models.sql`, `supabase/seeds/04_caravan_models_dethleffs_tabbert.sql`
und `supabase/seeds/05_caravan_models_knaus.sql` sind dagegen recherchierte
Realdaten (siehe Tabelle oben), keine Demo-Daten.
