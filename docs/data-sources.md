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
| Open Charge Map | https://openchargemap.org | je Datenanbieter unterschiedlich, überwiegend CC BY 4.0/CC0 (**nicht** ODbL — siehe [LIZENZEN.md](LIZENZEN.md)) | kostenlos, API-Key nötig | aktiv seit Auftrag A (Datenschicht) |
| Eco-Movement | https://ecomovement.com | kommerziell | kostenpflichtig | Research Required — Adapter/Mock zunächst |
| Eigene Startdaten (300+ anhängertaugliche Ladepunkte) | privat | eigene Daten | kostenlos | rechtliche Prüfung vor Import ausstehen (§17) |

### Import-Log Open Charge Map (`ingest/import_ocm.py --api`)

Lokale Testphasen-Datenbank, Stand 2026-09-14: Live-Abfrage gegen
`api.openchargemap.io/v3/poi` je Länder-ISO-Code, `compact=false` (liefert
aufgelöste Steckertyp-/Betreiber-/Länder-Namen statt nur numerischer IDs).
Kernländer zuerst importiert (Rest folgt bei Bedarf):

| Land | Ladepunkte | | Land | Ladepunkte |
|---|---:|---|---|---:|
| Deutschland (DE) | 24.622 | | Niederlande (NL) | 8.174 |
| Frankreich (FR) | 16.170 | | Österreich (AT) | 1.345 |
| Italien (IT) | 10.679 | | Belgien (BE) | 1.287 |
| Schweiz (CH) | 915 | | Liechtenstein (LI) | 17 |

**Gesamt: 63.209 reale Ladepunkte**, `source = 'ocm'` in `core.charge_point`,
Steckertyp/Leistung/Anzahl je Anschluss in `core.connector`. Unauflösbare
OCM-ConnectionType-IDs werden mit dem von der API gelieferten Klartext-Titel
gespeichert statt geraten; bleibt der Titel ebenfalls leer, steht
`"Unknown"` (≈800 Anschlüsse) — keine Schätzung. Jeder Lauf ist in
`raw.import_run` protokolliert (Quelle, Scope, Zeitpunkt, Datensatzzahl).
Alle importierten Ladepunkte starten mit
`enrich.trailer_suitability.verdict = 'unknown'` — Anhängertauglichkeit ist
unverifiziert und muss durch Community-Meldungen oder redaktionelle Prüfung
befüllt werden, es wurden keine Alt-Bewertungen übernommen.

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

## Straßenrestriktionen (Höhe/Breite/Gewicht)

| Anbieter | URL | Lizenz | Kosten | Status |
|---|---|---|---|---|
| Overpass API | https://overpass-api.de | ODbL (OpenStreetMap-Rohdaten) | kostenlos, kein API-Key | aktiv seit Phase 7 |

**Hinweis Overpass API (Phase 7):** Genutzt über
[src/lib/providers/road-restrictions/overpass.ts](../src/lib/providers/road-restrictions/overpass.ts)
zur Warnung vor bekannten `maxheight`/`maxwidth`/`maxweight`-Beschränkungen
entlang der geplanten Route, abgeglichen mit den Gespann-Maßen. Der
öffentliche Dienst ist ohne SLA und wird deshalb nur mit einer begrenzten
Anzahl Stichprobenpunkte pro Route abgefragt (siehe Kommentar im Adapter).
OSM-Tag-Abdeckung ist lückenhaft — die Prüfung ist eine Best-Effort-Warnung,
keine verlässliche Vollständigkeitsgarantie, und ersetzt keine
Beschilderung vor Ort.

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
enthalten frei erfundene Testdaten (`source = 'demo'`, `[DEMO]`-Präfix im
Namen) für drei Campingplätze in Deutschland, Kroatien und Italien —
ausschließlich zur lokalen Entwicklung und Demonstration der
Campingplatz-Funktionen, nicht produktiv nutzbar.

**Ladestationen werden nicht mehr über erfundene Demo-Seeds befüllt.** Die
frühere Demo-Tabelle `public.charging_stations` (inkl. der ehemaligen Seeds
`01_demo_data.sql`-Ladestationsblock und
`06_demo_charging_stations_muenchen_meran.sql`, ~54 frei erfundene
Ladepunkte entlang der Brennerroute München–Meran) wurde geleert; die Seeds
selbst wurden entfernt bzw. bereinigt. Das reale Ladenetz kommt
ausschließlich über den Open-Charge-Map-Ingest
([ingest/import_ocm.py](../ingest/import_ocm.py)) in `core.charge_point` /
`core.connector` — siehe Abschnitt oben zu Open Charge Map. Alle so
importierten Ladepunkte tragen `source = 'ocm'` und sind echte,
API-abgerufene Daten, keine Testdaten. Die
Fahrzeug-/Wohnwagen-Referenzkataloge in `supabase/seeds/02_caravan_models.sql`,
`supabase/seeds/03_vehicle_models.sql`, `supabase/seeds/04_caravan_models_dethleffs_tabbert.sql`
und `supabase/seeds/05_caravan_models_knaus.sql` sind dagegen recherchierte
Realdaten (siehe Tabelle oben), keine Demo-Daten.
