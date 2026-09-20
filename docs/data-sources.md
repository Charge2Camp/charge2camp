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

### Wiederkehrender Reimport (seit 2026-09-14)

`src/app/api/cron/ocm-import/route.ts`, per `vercel.json`-Cron täglich um
03:00 UTC ausgelöst (`CRON_SECRET`-geschützt). Importiert **ein** Kernland
pro Lauf (Wochentag-Rotation über DE/FR/IT/NL/AT/BE/CH) — ein voller Zyklus
über alle sieben Länder dauert eine Woche. Bewusst nicht alle Länder in
einem Lauf: Vercel-Hobby-Plan begrenzt `maxDuration` auf 60s, bei großen
Ländern (DE) reicht das selbst mit Bulk-Upserts knapp; ein Upgrade auf Pro
erlaubt bis zu 300s. TypeScript-Portierung derselben Kernlogik wie
`ingest/import_ocm.py` (Steckertyp-Mapping, Ableitung von
`max_power_kw`/`connector_count`), da das Python-Skript per `psycopg2`
direkt verbindet und dafür kein DB-Passwort im Deploy hinterlegt ist — der
Cron-Pfad schreibt stattdessen über den Service-Role-Client (PostgREST),
analog zum Admin-Backend. `raw.charge_point`-Zwischenspeicherung entfällt
dabei (raw-Schema nicht über PostgREST erreichbar).

**Dublettenschutz gegen manuell erfasste Stationen**
(`core.deactivate_new_ocm_near_manual`, siehe Migration
`20260930040000`): Ein neu importierter OCM-Ladepunkt, der innerhalb von
40m eines bereits bestehenden Nicht-OCM-Datensatzes liegt (typischerweise
`source='admin_manual'`, siehe unten), wird **nicht verworfen**, sondern
mit `is_active=false` gespeichert — sichtbar in der App bleibt die
manuelle Station, der neue OCM-Datensatz taucht im Admin-Dashboard unter
"Mögliche Dubletten (Ladepunkte)" auf und kann dort manuell
zusammengeführt werden (`core.merge_charge_points`, siehe unten). Gleiche
Prüfung, nur als Vorabcheck statt Nachbearbeitung, in
`ingest/import_ocm.py` für manuelle/größere Reimport-Läufe.

### Dubletten zusammenführen (Admin-Dashboard, seit 2026-09-14)

`core.merge_charge_points`/`core.merge_campsites` (Migration
`20260930020000`) plus Review-UI unter `/ladestationen/dubletten` und
`/campingplaetze/dubletten` im Admin-Backend: pro erkanntem Dublettenpaar
(aus `core.run_quality_checks()`) wählt ein Admin je Feld, welcher der
beiden Datensätze übernommen wird; Anschlüsse, Bewertungen, Favoriten,
Blockliste, Anhängertauglichkeit und Campingplatz-Verknüpfungen werden auf
den erhaltenen Datensatz umgehängt statt beim Löschen des Duplikats
verloren zu gehen. Koordinaten sind seither auch direkt in den
Stammdaten-Formularen (Ladepunkt/Campingplatz) bearbeitbar (Auslöser:
Dashboard-Check "Unplausible Koordinaten").

### Verbindliche Quellenpriorität & feldbasierte Provenance (seit 2026-09-20)

Auftrag: `\\MyCloud\work\charge2camp\LAdesäule_Schnittstellen.rtf`. Umgesetzt in
[supabase/migrations/20261012000000_field_provenance_and_source_registry.sql](../supabase/migrations/20261012000000_field_provenance_and_source_registry.sql):
`core.source_registry` (Priorität je Quelle), `core.upsert_charge_point()`
als **einziger** Merge-Resolver für `core.charge_point` (jedes Feld einzeln,
nicht der ganze Datensatz — sowohl `ingest/import_ocm.py` als auch
`src/app/api/cron/ocm-import/route.ts` rufen dieselbe Funktion auf), und
`enrich.set_trailer_suitability()` als einziger Schreibpfad für
Anhängertauglichkeit.

| Priorität | Quelle | `source_id` | Registry-Priorität |
|---|---|---|---:|
| 1 | Charge2Camp Admin/Sascha-Liste (manuell) | `admin_manual`, `sascha_list` | 100 |
| 2 | Bundesnetzagentur Ladesäulenregister | `bundesnetzagentur` | 90 |
| 4 | Open Charge Map | `ocm` | 40 (Community-Daten, keine staatliche Quelle) |
| 5 | OpenStreetMap | `osm` | 10 (nur Kontext-/Geodaten, keine Ladeinfrastruktur-Stammdaten) |

**Harte Regel unabhängig von der Priorität:** Eine manuell verifizierte
Anhängertauglichkeit (`enrich.trailer_suitability.manual_override = true`)
darf durch keinen automatischen Import geändert werden, auch nicht auf
`unknown` zurückgesetzt. Alle anderen Ladepunkt-Felder bleiben weiterhin per
Quellenpriorität automatisch aktualisierbar — mit der bestehenden,
bewusst beibehaltenen Ausnahme `core.charge_point.manual_override`
(Stammdaten-Korrekturen im Admin-Bereich), siehe Kommentar an
`core.upsert_charge_point()`.

### Import-Log Bundesnetzagentur (`ingest/import_bnetza.py --file`)

Aktiv seit 2026-09-20, verifiziert gegen eine echte Exportdatei
(`Ladesaeulenregister_BNetzA_2026-09-01.csv`, Stand 01.09.2026,
**116.443 Ladeeinrichtungen**, 219.826 Anschlüsse). Kein Live-API — das
Ladesäulenregister wird von der Bundesnetzagentur als periodischer
CSV-Download bereitgestellt (`ladesaeulenregister.de`), UTF-8-kodiert mit
BOM, Trennzeichen `;`, deutsches Dezimalkomma bei Koordinaten/Leistung, 10
Praeambel-/Kopfzeilen vor der eigentlichen Spaltenkopfzeile. Details zur
Spaltenzuordnung (inkl. der parallelen `Steckertypen<N>`/`Nennleistung
Stecker<N>`-Listenstruktur je "Ladepunkt"-Gruppe) siehe Moduldocstring in
[ingest/import_bnetza.py](../ingest/import_bnetza.py).

`source_id = 'DE'`-Ladepunkte tragen `source = 'bundesnetzagentur'`,
`access_type = 'public'` (das Register erfasst laut eigener Präambel
ausschließlich öffentlich zugängliche Ladeeinrichtungen — dokumentiertes
Faktum der Quelle, keine Annahme) und `country_code = 'DE'`. Steckertypen
werden auf dieselben `core.connector.standard`-Werte abgebildet, die der
bestehende Steckertyp-Filter (`src/lib/connector-categories.ts`) bereits
kennt (Type2/Type2_Socket/Type1/Schuko/CCS2/CHAdeMO/"CEE 3 Pin"/"CEE 5
Pin"); "DC Megawatt Charging System (MCS)" und "DC Tesla Fahrzeugkupplung
(Typ 2)" sind neue, in der Kategorienliste noch nicht erfasste Typen — sie
landen unverändert in `core.connector.standard`, statt in eine
elektrisch falsche Kategorie gezwungen zu werden.

Gleicher zentraler Resolver wie OCM (`core.upsert_charge_point()`),
gleicher Nachbarschafts-Dublettencheck gegen manuell erfasste Stationen wie
`ingest/import_ocm.py` (40m-Radius + Betreiber-Abgleich als
Dublettensignal), gleiches `enrich.trailer_suitability`-Auffüllen für neu
importierte Stationen ohne bestehende Bewertung (seit
`20261013000000_fill_missing_trailer_suitability_any_source.sql`
quellenübergreifend, nicht mehr nur für `ocm`). Import-Dauer für die volle
DE-Datei lokal: ca. 6 Minuten (Einzeiliger Upsert pro Zeile inkl.
Dublettenprüfung, kein Bulk-Pfad wie beim TS-Cron für OCM). Idempotenz
gegen einen erneuten Lauf derselben Datei verifiziert (Zeilen-/
Anschlusszahl unverändert).

**Wiederkehrender Import:** noch nicht automatisiert (kein Cron wie bei
OCM) — die Bundesnetzagentur veröffentlicht keine feste
Aktualisierungsfrequenz für den Download, ein manueller/geplanter
Reimport-Rhythmus ist noch zu entscheiden.

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
| Knaus (technische Daten, aufbereitet von promobil.de aus Herstellerangaben) | https://www.promobil.de | öffentlich zugängliche Spezifikationsdaten | 23 Modelle (Serien SÜDWIND, SPORT) | 2026-09-05 |

Alle Einträge tragen `source` und `verification_status = 'unverified'` (bzw.
`'verified'` bei Hobby/Dethleffs/Tabbert, da direkt aus offiziellen
Herstellerdokumenten). Fahrzeuge ohne werksseitig genehmigte Anhängelast
wurden bewusst nicht aufgenommen. Andere Wohnwagenmarken (Adria, Fendt,
Bürstner, Weinsberg, LMC, …) sind als **Research Required** vorgemerkt und
noch nicht enthalten. `caravan_models`/`caravans` tragen seit 2026-09-14
(Nutzerentscheidung) kein Gewichtsfeld mehr — Gewicht hat keine Bedeutung
für Reichweite, Abmessungen oder Anhängertauglichkeits-Kriterien einer
Ladestation; die frühere Knaus-Lücke beim zulässigen Gesamtgewicht ist
dadurch gegenstandslos.

## Ausdrücklich NICHT als Quelle verwendet (§34)

Google Maps, PiNCAMP, camping.info sowie andere kommerzielle
Campingportale werden nicht gescrapt oder ungeprüft übernommen.

**Schmale, bewusst dokumentierte Ausnahme:** Meldet ein Nutzer eine fehlende
Ladestation über "Mein Profil" per geteiltem Google-Maps-Link
([src/app/profil/fehlende-saeule](../src/app/profil/fehlende-saeule)), löst
[src/lib/maps-link.ts](../src/lib/maps-link.ts) NUR den Kurzlink-Redirect auf
und liest die dabei entstehende finale URL (`response.url`) auf ein
Koordinaten-Muster (`@lat,lon,zoom` bzw. `!3d!4d`) hin aus -- niemals
`response.text()`/`.json()`, also nie Googles gerenderten Seiteninhalt, Namen,
Adressen, Bewertungen oder Fotos. Löst der Link stattdessen (je nachdem, über
welchen "Teilen"-Button er erzeugt wurde) zu einer Such-URL der Form
`.../maps?q=Name,+Adresse&ftid=...` ohne eingebettete Koordinaten auf, wird
NUR der `q`-Parameter (reiner URL-Text) an den bereits für die Routenplanung
genutzten eigenen Geocoder (Nominatim/OpenStreetMap,
[src/lib/providers/geocoding/nominatim.ts](../src/lib/providers/geocoding/nominatim.ts))
übergeben -- weiterhin keine Anfrage an Google, keine Übernahme aus Googles
Datenbestand, nur URL-Text plus eigener, längst dokumentierter Geocoding-
Provider. Alle übrigen Felder (Name, Betreiber, Adresse, Anschlüsse,
Anhängertauglichkeit) trägt ein Admin nach eigener Prüfung von Hand ein
([admin/.../ladestationen/fehlende-saeulen](../admin/app/\(dashboard\)/ladestationen/fehlende-saeulen)) --
nichts landet ohne Admin-Freigabe in `core.charge_point`.

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
API-abgerufene Daten, keine Testdaten.

Für Stationen, die bei Open Charge Map (noch) nicht gelistet sind, gibt es
im Admin-Backend unter „Ladestation anlegen“
([admin/app/(dashboard)/ladestationen/neu](../admin/app/(dashboard)/ladestationen/neu))
eine manuelle Erfassung mit allen relevanten Feldern (Adresse, Koordinaten,
Anschlüsse, Anhängertauglichkeit). Diese Einträge tragen
`source = 'admin_manual'` (Konvention analog zu `'ocm'`/`'demo'`) und
`external_key` mit Präfix `manual:<uuid>` — echte, von einem Admin geprüfte
Daten, aber ohne automatischen Re-Import/Update über den OCM-Ingest. Die
Fahrzeug-/Wohnwagen-Referenzkataloge in `supabase/seeds/02_caravan_models.sql`,
`supabase/seeds/03_vehicle_models.sql`, `supabase/seeds/04_caravan_models_dethleffs_tabbert.sql`
und `supabase/seeds/05_caravan_models_knaus.sql` sind dagegen recherchierte
Realdaten (siehe Tabelle oben), keine Demo-Daten.
