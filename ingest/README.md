# Ingest-Skripte (Datenschicht)

Python-Skripte, die echte europäische Campingplatz-/Ladesäulendaten in die
bestehende Supabase-Postgres-Instanz dieses Projekts importieren (Schemas
`raw`/`core`/`enrich`, siehe
[supabase/migrations/20260913000000_data_layer_schema.sql](../supabase/migrations/20260913000000_data_layer_schema.sql)
und `CLAUDE_CODE_AUFTRAG.md` auf dem Desktop für den vollständigen Auftrag).

Diese Skripte laufen **gegen dieselbe Datenbank** wie die Next.js-App (kein
separater Datenbank-Container) — vor dem Ausführen also `npx supabase start`
in Projekt-Root.

**Abweichung von Auftragsdokument §12, Punkt 1** (`docker compose up -d`
startet DB, Meilisearch, OSRM, Adminer): per Architekturentscheidung läuft
die DB über die Supabase-CLI statt in `docker-compose.yml` (Supabase Studio
übernimmt dabei auch die Rolle von Adminer), und der Fuß-Routing-OSRM-Server
läuft separat über eigene `docker run`-Befehle
([osrm/README.md](osrm/README.md)), nicht in derselben Compose-Datei --
`docker compose up -d` (Projekt-Root) startet nur noch Meilisearch. Siehe
Schritt 2/7/8 im Ablauf unten für die tatsächlichen Befehle.

## Kompletter Ablauf: vom leeren Rechner bis zur ersten Suchanfrage

Kurzfassung aller Schritte unten, in der Reihenfolge zum Nachvollziehen
(jeder einzelne Schritt ist weiter unten bzw. in den verlinkten READMEs
ausführlich erklärt):

1. Docker Desktop installieren und starten.
2. Projekt-Root: `npm install`, dann `npx supabase start` (Postgres, Auth,
   PostgREST, wendet alle `supabase/migrations/*.sql` automatisch an).
3. `cd ingest`, virtuelle Umgebung anlegen + `requirements.txt`
   installieren (siehe "Setup" unten).
4. **Auftrag A:** `import_ocm.py --api --bbox ...` (echter OCM-API-Key
   nötig, siehe unten) oder `--file` mit einem Export.
5. **Auftrag B:** OSM-Extrakt besorgen ([osm/README.md](osm/README.md)),
   dann `import_osm_campsites.py --file ...`.
6. **Auftrag B §7 (optional, siehe unten):** `derive_spatial_amenities.py`
   für `pool`/`playground`.
7. **Auftrag C:** OSRM-Fuß-Server aufbauen
   ([osrm/README.md](osrm/README.md)), dann `build_links.py`.
8. **Auftrag E:** `docker compose up -d meilisearch` (Projekt-Root), dann
   `index_meilisearch.py`.
9. Next.js-Dev-Server starten (`npm run dev` in Projekt-Root) und die
   **erste Suchanfrage** stellen:
   ```bash
   curl "http://localhost:3000/api/campsites/search?amenities=pool,playground&charging=walking&max_walk_m=800"
   ```
   Antwort enthält `total`, gefilterte `items` und Facetten-Trefferzähler
   unter `facets` (siehe [docs/api.md](../docs/api.md)).
10. Datenqualität prüfen: `psql $DATABASE_URL -f ../sql/90_quality_checks.sql`
    (siehe unten) und `test_enrich_immutability.py` (wichtigster Test).

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

**Noch nicht Teil dieses Skripts** (separater Folgeschritt, siehe unten):
Merkmale, die eine räumliche Suche nach *anderen* OSM-Objekten "innerhalb
boundary" brauchen (`pool`, `playground`, `shop`, `restaurant`,
`charging_on_site`), sowie die räumlich abgeleiteten Lage-Merkmale
(`beach_nearby`, `lake_access`, `river_access`, `mountain`).

### Auftrag B §7 — Räumlich abgeleitete Merkmale (`pool`, `playground`)

`derive_spatial_amenities.py` deckt **nur `pool` und `playground`** ab
(bewusste Eingrenzung, siehe Modulkommentar): `shop=*`/`amenity=restaurant,
cafe` sind auf Länderebene um Größenordnungen häufiger und damit ein
eigener, teurerer Extraktionsschritt; `charging_on_site` kommt bereits
zuverlässiger aus den echten Ladepunkt-Standortdaten
(`core.campsite_charge_link`, siehe `core.campsite_search`).

```bash
cd osm
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/data:/data" charge2camp-osmium \
    tags-filter /data/italy-latest.osm.pbf \
    n/leisure=swimming_pool w/leisure=swimming_pool \
    n/swimming_pool=yes w/swimming_pool=yes \
    n/leisure=playground w/leisure=playground \
    n/playground=yes w/playground=yes \
    -o /data/italy-poolplayground.osm.pbf --overwrite
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/data:/data" charge2camp-osmium \
    export /data/italy-poolplayground.osm.pbf -f geojsonseq \
    -u type_id --geometry-types point,polygon \
    -o /data/italy-poolplayground.geojsonseq --overwrite
cd ..

.venv/Scripts/python.exe derive_spatial_amenities.py osm/data/italy-poolplayground.geojsonseq
```

(Wiederholen für weitere Regionen, alle Dateien können auch in einem Lauf
übergeben werden: `derive_spatial_amenities.py datei1.geojsonseq datei2.geojsonseq ...`.)
Setzt `core.campsite_amenity` mit `source='osm_spatial'`, `confidence=70` --
überschreibt nie eine höhere Konfidenz (z. B. `website_research=90`).
Danach `core.campsite_search` neu auffrischen und `index_meilisearch.py`
erneut laufen lassen (siehe Auftrag E unten), sonst zeigt die Suche die
neuen Merkmale nicht.

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

## Ladesäulen-Bilder (Wikimedia Commons + Mapillary)

Befüllt `core.charge_point_image` (Migration
`supabase/migrations/20260925000000_charge_point_images.sql`), angezeigt in
der `ChargePointGallery` auf jeder Ladepunkt-Detailseite. Details siehe
Docstring in [fetch_charge_point_images.py](fetch_charge_point_images.py).

**Abweichung vom Auftragsdokument** (`CLAUDE_CODE_AUFTRAG_LADESAEULEN_BILDER.md`):
Quelle A ("Wikimedia Commons über OSM-Tags") geht dort von einem lokal
gespeicherten `raw.osm_*` für Ladesäulen aus -- das gibt es in diesem
Projekt nicht (Ladesäulen kommen ausschließlich von Open Charge Map, siehe
Auftrag A oben; `raw.osm_*` existiert nur für Campingplätze). Die
`image=`/`wikimedia_commons=`-Tags werden deshalb live per Overpass-API im
~30 m-Umkreis jeder Ladesäule abgefragt statt aus einer Tabelle gelesen --
Lizenzprüfung/Ergebnis über die Commons-API bleiben unverändert wie im
Auftrag beschrieben.

```bash
# Testlauf, nur Commons (kein Mapillary-Token nötig), ohne DB-Schreibzugriff:
.venv/Scripts/python.exe fetch_charge_point_images.py \
  --bbox 10.5,46.3,12.5,47.2 --source commons --dry-run

# Echter Lauf (Commons + Mapillary, braucht MAPILLARY_ACCESS_TOKEN):
export MAPILLARY_ACCESS_TOKEN=...   # nie ins Repo committen
.venv/Scripts/python.exe fetch_charge_point_images.py \
  --bbox 10.5,46.3,12.5,47.2 --source all
```

Tests:

```bash
.venv/Scripts/python.exe test_charge_point_image_bearing.py
.venv/Scripts/python.exe test_charge_point_image_idempotency.py --bbox 10.5,46.3,12.5,47.2
.venv/Scripts/python.exe test_charge_point_image_override_immutability.py
```

## Auftrag F — Datenqualität und der wichtigste Test des Projekts

```bash
# Zehn Qualitätsabfragen (Abdeckung, Dubletten, Widersprüche, ... --
# siehe sql/90_quality_checks.sql für Details je Abfrage):
docker exec -i supabase_db_eCamper psql -U postgres -d postgres < ../sql/90_quality_checks.sql
# oder direkt, falls psql lokal installiert ist:
psql "$DATABASE_URL" -f ../sql/90_quality_checks.sql

# Der wichtigste Test: ein zweiter Import darf enrich.* NIEMALS verändern.
.venv/Scripts/python.exe test_enrich_immutability.py
```

`test_enrich_immutability.py` nimmt einen bereits importierten Ladepunkt,
setzt eine erkennbare Test-Anhängertauglichkeit, führt `import_ocm.py --file`
für genau diesen Ladepunkt erneut aus und prüft, dass `enrich.
trailer_suitability` unverändert bleibt (und `core.charge_point.updated_at`
sich tatsächlich geändert hat, sonst wäre der Test nicht aussagekräftig).
Räumt danach den Originalwert wieder auf, hinterlässt keine Spuren in der
Datenbank. Exit-Code 0 = bestanden.
