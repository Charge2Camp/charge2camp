# Lizenzen und Attribution — Datenschicht (Auftrag §13)

Register jeder in `raw`/`core`/`enrich` (siehe
[database.md](database.md)) genutzten externen Datenquelle: Lizenz,
Pflicht-Attributionstext, Datum der letzten Prüfung. Vor kommerziellem
Go-Live erneut prüfen — mit "letzte Prüfung" markierte Einträge sind nur
zum jeweiligen Datum aktuell.

Die Attribution ist von Anfang an Teil der API-Antworten (Feld
`attribution` in `GET /api/campsites/search`,
`GET /api/campsites/{external_key}`, `GET /api/charge-points/search`,
siehe [api.md](api.md)), nicht nachträglich ergänzt.

## OpenStreetMap (Campingplatz-Rohdaten, `core.campsite`)

| | |
|---|---|
| Lizenz | [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Pflicht-Attribution | „© OpenStreetMap contributors" |
| Verwendung hier | `ingest/import_osm_campsites.py`, `ingest/derive_spatial_amenities.py` — Geofabrik-Extrakte (Italien, Österreich, Bayern), gefiltert per `osmium tags-filter` |
| Letzte Prüfung | 2026-09-06 |

**Offene juristische Frage vor Go-Live** (so im Auftragsdokument benannt,
nicht abschließend geklärt): ODbL ist Copyleft — bei einer "produktiven
Datenbank" (production database), die *substanziell* aus ODbL-Daten
abgeleitet ist, muss diese Datenbank ebenfalls unter ODbL (oder einer
kompatiblen Lizenz) weitergegeben werden ("Share-Alike"), sobald sie
öffentlich zugänglich gemacht wird. Diese Datenschicht begegnet dem
architektonisch (siehe
[supabase/migrations/20260913000000_data_layer_schema.sql](../supabase/migrations/20260913000000_data_layer_schema.sql)):
`enrich.*` ist bewusst eine **eigenständige** Sammlung, die nur über den
stabilen Textschlüssel `external_key` auf `core.*` **verweist**, statt eine
Ableitung von OSM-Daten zu sein (Community-Recherche zur
Anhängertauglichkeit, Website-Recherche zu Lademöglichkeiten — das sind
eigene Fakten, keine Bearbeitung der OSM-Geometrie/Tags). Ob `core.*`
selbst (die direkt aus OSM abgeleiteten Campingplatz-Stammdaten) beim
Go-Live insgesamt unter ODbL weitergegeben werden muss, ist vor einem
öffentlichen/kommerziellen Rollout durch eine Person mit
Lizenz-/Urheberrechtskenntnis zu klären — **nicht** durch dieses Dokument
abschließend entschieden.

## Open Charge Map (Ladepunkt-Rohdaten, `core.charge_point`, `core.connector`)

| | |
|---|---|
| API-Zugriff | `https://api.openchargemap.io/v3/poi` — **erfordert seit 2026 einen kostenlosen API-Key** (`OPEN_CHARGE_MAP_API_KEY`/`OCM_API_KEY`, auch für den referencedata-Endpunkt), siehe `ingest/import_ocm.py` |
| Verwendung hier | `ingest/import_ocm.py --api` (Bayern/Österreich/Italien) |
| Letzte Prüfung | 2026-09-06 (live gegen `v3/referencedata` und `v3/poi` geprüft, siehe unten) |

**Wichtig, beim Prüfen heute festgestellt:** Anders als in
[data-sources.md](data-sources.md) bislang vermutet ("ODbL / CC0"), lizenziert
Open Charge Map **nicht** die gesamte Datenbank unter einer einzigen
Lizenz — jeder Datensatz trägt die Lizenz seines jeweiligen
`DataProvider`s (Feld `DataProvider.License` in der API-Antwort). Live
gegen `v3/referencedata` abgefragte Stichprobe der genutzten Anbieter
(Auszug, vollständige Liste hat >80 Einträge):

| DataProvider | Lizenz-Text laut API |
|---|---|
| Open Charge Map Contributors (Standard-/Community-Anbieter, mit Abstand größter Anteil unserer importierten Daten) | „Licensed under Creative Commons Attribution 4.0 International (CC BY 4.0)" |
| Bundesnetzagentur.de | „Provided by Bundesnetzagentur.de under the CC-BY 4.0 license" |
| UK National Charge Point Registry | „Contains public sector information licensed under the Open Government Licence v2.0." |
| data.gouv.fr | „Open License" (Etalab Licence Ouverte) |
| afdc.energy.gov (NREL/DOE, USA) | „may be used for any purpose whatsoever" |
| mehrere kleinere Anbieter (z. B. SITRONICS PAO, Gaia Green Tech, Toger.co) | „CC0" bzw. „Licensed under CC0 by data sharing agreement" |
| einzelne Anbieter (z. B. ev-charging.com, e-Laad, CarStations.com) | `null` — **keine Lizenz angegeben** |

Eine Stichprobe von 200 zufälligen italienischen Ladepunkten (2026-09-06)
zeigte ausschließlich `Open Charge Map Contributors | CC BY 4.0` — die
`null`-Fälle scheinen für unsere Bayern/Österreich/Italien-Region also
selten, sind aber nicht ausgeschlossen. **Vor kommerziellem Go-Live:**
stichprobenartig prüfen, ob importierte Datensätze mit `DataProvider.
License = null` in der eigenen Datenmenge vorkommen (aktuell nicht
gespeichert, da `core.charge_point` keine Lizenzspalte hat — bei Bedarf
ergänzen), und bei Zweifel konservativ wie CC BY behandeln
(Attribution, keine Weiterverbreitung ohne Kennzeichnung).

**Pflicht-Attribution** (für den mit Abstand größten Anteil, CC BY 4.0):
„Ladepunkte: Open Charge Map" bzw. ausführlicher „Charging point data
© Open Charge Map contributors, openchargemap.org, CC BY 4.0" — bereits
im `attribution`-Feld der API-Antworten enthalten (aktuell in Kurzform,
siehe [api.md](api.md)).

Die vollständigen aktuellen Nutzungsbedingungen auf openchargemap.org
(`/site/about/terms`) laden clientseitig per JavaScript und konnten am
2026-09-06 nicht automatisiert abgerufen werden — vor Go-Live manuell im
Browser nachlesen.

## ACSI / PiNCAMP / camping.info

| | |
|---|---|
| Status | **Nicht genutzt.** Nur mit eigenem Lizenzvertrag nutzbar (Datenbankherstellerrecht, § 87a UrhG). Kein Scraping, siehe [CLAUDE.md](../CLAUDE.md) Punkt 6 und Auftragsdokument Abschnitt 2. |
| Verwendung hier | Keine. Als mögliche spätere Qualitätsquelle vorgesehen, falls ein Lizenzvertrag zustande kommt. |
| Letzte Prüfung | 2026-09-06 (Status unverändert seit Projektbeginn) |

## Siehe auch

[data-sources.md](data-sources.md) für alle übrigen Datenquellen der App
(Kartenkacheln, Routing, Geocoding, Fahrzeug-/Wohnwagenkataloge, Demo-Daten)
— dieses Dokument deckt bewusst nur die drei in Auftragsdokument Abschnitt
13 genannten Quellen der neuen `raw`/`core`/`enrich`-Datenschicht ab.
