# Ingest-Skripte (Datenschicht)

Python-Skripte, die echte europäische Campingplatz-/Ladesäulendaten in die
bestehende Supabase-Postgres-Instanz dieses Projekts importieren (Schemas
`raw`/`core`/`enrich`, siehe
[supabase/migrations/20260913000000_data_layer_schema.sql](../supabase/migrations/20260913000000_data_layer_schema.sql)
und `CLAUDE_CODE_AUFTRAG.md` auf dem Desktop für den vollständigen Auftrag).

Diese Skripte laufen **gegen dieselbe Datenbank** wie die Next.js-App (kein
separater Datenbank-Container) — vor dem Ausführen also `npx supabase start`
in Projekt-Root.

## Setup

```bash
cd ingest
python -m venv .venv
```

**Windows:**

```powershell
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

> Schlägt die Installation mit `CERTIFICATE_VERIFY_FAILED` fehl: liegt an
> fehlenden System-Root-Zertifikaten in manchen Python-Installationen unter
> Windows (analog zu `NODE_OPTIONS=--use-system-ca` im Node-Teil dieses
> Projekts). `pip-system-certs` in `requirements.txt` behebt das für alle
> HTTPS-Aufrufe der Skripte selbst — falls aber schon die **Installation**
> von `pip-system-certs` selbst fehlschlägt, einmalig mit
> `--trusted-host pypi.org --trusted-host files.pythonhosted.org` installieren.

**macOS/Linux:**

```bash
.venv/bin/pip install -r requirements.txt
```

## Datenbankverbindung

Standard ist der lokale `supabase start`-Port:
`postgresql://postgres:postgres@localhost:54322/postgres`. Abweichend über
`DATABASE_URL` setzen (z. B. für eine Cloud-Supabase-Instanz).

## Auftrag A — Ladesäulen-Ingest (Open Charge Map)

```bash
# Live-Abfrage (braucht einen kostenlosen API-Key von openchargemap.org,
# als OCM_API_KEY oder OPEN_CHARGE_MAP_API_KEY in der Umgebung, oder --key):
.venv/Scripts/python.exe import_ocm.py --api --bbox 45.9,10.8,46.8,12.5
.venv/Scripts/python.exe import_ocm.py --api --country IT --max-results 8000

# Datei-/Verzeichnis-Import (kein API-Key nötig, reproduzierbar) --
# akzeptiert eine einzelne JSON-Datei (Array oder ein POI-Objekt) ODER ein
# Verzeichnis mit vielen Einzeldateien im Format von
# github.com/openchargemap/ocm-export (data/<ISO>/OCM-<id>.json):
.venv/Scripts/python.exe import_ocm.py --file pfad/zu/ocm-export/data/IT
```

**Bekannte Einschränkung bei `--file`:** Die Export-Dateien von
`ocm-export` enthalten nur numerische Referenz-IDs (Land, Nutzungstyp) statt
aufgelöster Namen/Codes — anders als die Live-API. `country_code` und
`access_type` bleiben deshalb bei reinem Datei-Import `NULL`, statt einen
falschen Wert zu raten (siehe Kommentar am Kopf von `import_ocm.py`). Mit
`--api` sind beide Felder immer zuverlässig gefüllt.

Nach jedem Lauf: `raw.import_run` zeigt Status/Satzzahl, jeder neue
Ladepunkt bekommt automatisch einen `enrich.trailer_suitability`-Eintrag mit
`verdict='unknown'`. Ein zweiter Lauf verändert **niemals** bestehende
`enrich.*`-Zeilen (wichtigster Test des Projekts, siehe
`CLAUDE_CODE_AUFTRAG.md` Abschnitt 12).

## Auftrag B — Campingplatz-Ingest (OpenStreetMap)

Braucht zuerst einen OSM-Export im `geojsonseq`-Format — siehe
[osm/README.md](osm/README.md) für den vollständigen Extraktionsablauf
(Geofabrik-Extrakt → `osmium tags-filter` → `osmium export`, per Docker-Image
statt einer nativen Windows-Installation von `osmium-tool`).

```bash
.venv/Scripts/python.exe import_osm_campsites.py --file osm/data/campsites.geojsonseq
```

Importiert `core.campsite` + die Merkmale, die direkt aus den eigenen Tags
des Campingplatz-Objekts ablesbar sind (`wifi`, `laundry`, `dump_station`,
`dogs_allowed`, `open_all_year`, `accessible`, `caravans_allowed`,
`pitch_electric_a`). Legt für jeden Platz mit Website automatisch einen
offenen `enrich.research_task`-Eintrag an (Arbeitsliste für die
Website-Recherche), rührt aber nie einen bestehenden an.

**Noch nicht Teil dieses Skripts** (separater Folgeschritt, siehe
Auftragsdokument Abschnitt 7): Merkmale, die eine räumliche Suche nach
*anderen* OSM-Objekten "innerhalb boundary" brauchen (`pool`, `playground`,
`shop`, `restaurant`, `charging_on_site`), sowie die räumlich abgeleiteten
Lage-Merkmale (`beach_nearby`, `lake_access`, `river_access`, `mountain`).

## Auftrag C — Fußweg-Verknüpfung

Braucht einen laufenden OSRM-Server mit **Fuß-Profil** — siehe
[osrm/README.md](osrm/README.md) für den Aufbau (separat vom
Auto-Routing der App).

```bash
.venv/Scripts/python.exe build_links.py
```

Verknüpft jeden Campingplatz mit Ladepunkten im 5-km-Umkreis über eine
einzige OSRM-Table-Anfrage pro Platz (`relation`: `on_site` ≤150 m Luftlinie
oder innerhalb der Grenzfläche, `walking` ≤1200 m Gehstrecke, sonst
`nearby_drive`). Aktualisiert am Ende `core.campsite_search`
(`REFRESH MATERIALIZED VIEW CONCURRENTLY`). Ein einzelner OSRM-Fehler
bricht den Lauf nicht ab (`walk_distance_m` bleibt `NULL`, Fehlerquote wird
geloggt).

## Auftrag E — Suchindex (Meilisearch)

Braucht einen laufenden Meilisearch-Server — per Docker Compose aus dem
Projekt-Root (`docker-compose.yml`):

```bash
docker compose up -d meilisearch
```

Läuft unter `http://localhost:7700` mit dem Master-Key aus `.env.local`
(`MEILI_MASTER_KEY`, Default `charge2camp-dev-master-key` — für einen
öffentlich erreichbaren Server vor Go-Live unbedingt ändern). Health-Check:
`curl http://localhost:7700/health`.

```bash
.venv/Scripts/python.exe index_meilisearch.py
```

Liest `core.campsite_search` komplett neu ein und schreibt den Index
`campsites` (Felder, `filterableAttributes`/`sortableAttributes`/
`searchableAttributes`, `_geo`-Feld siehe Auftragsdokument Abschnitt 10).

**Abweichung vom Auftragsdokument:** kein inkrementeller Lauf über
`updated_at` — `core.campsite_search` ist eine materialisierte Sicht ohne
eigene Änderungs-Zeitspalte und wird ohnehin als Ganzes per
`REFRESH MATERIALIZED VIEW CONCURRENTLY` aktualisiert (siehe `build_links.py`
oben). Ein voller Reindex dauert bei ~4000 Dokumenten nur wenige Sekunden,
ein inkrementeller Lauf wäre unnötige Komplexität für den aktuellen
Datenumfang.

Nach jedem `build_links.py`-Lauf (neue Verknüpfungen) oder Import mit
geänderten Merkmalen/Ladeinfos: `index_meilisearch.py` erneut ausführen,
sonst zeigt die Suche veraltete Facetten/Distanzen.
