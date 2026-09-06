# OSM-Extraktion für den Campingplatz-Ingest

`osmium-tool` ist unter Windows nicht ohne Weiteres nativ installierbar
(kein offizielles Windows-Binary/Wheel). Dieses Verzeichnis enthält ein
minimales Docker-Image, das die im Auftragsdokument (Abschnitt 7)
beschriebenen Schritte reproduzierbar ausführt.

## 1. Image bauen (einmalig)

```bash
docker build -t charge2camp-osmium ingest/osm/
```

## 2. Geofabrik-Extrakt herunterladen

```bash
mkdir -p ingest/osm/data
curl -L https://download.geofabrik.de/europe/italy/nord-est-latest.osm.pbf \
    -o ingest/osm/data/nord-est-latest.osm.pbf
```

(~620 MB für Nordost-Italien; andere Regionen unter
[download.geofabrik.de](https://download.geofabrik.de).)

## 3. Auf Campingplätze filtern und nach geojsonseq exportieren

**Windows/Git-Bash:** `MSYS_NO_PATHCONV=1` ist nötig, sonst übersetzt Git
Bash die `/data`-Pfade im Container-Kommando fälschlich in Windows-Pfade.

```bash
cd ingest/osm
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/data:/data" charge2camp-osmium \
    tags-filter /data/nord-est-latest.osm.pbf \
    n/tourism=camp_site w/tourism=camp_site r/tourism=camp_site \
    -o /data/campsites.osm.pbf --overwrite

MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/data:/data" charge2camp-osmium \
    export /data/campsites.osm.pbf -f geojsonseq \
    -u type_id --geometry-types point,polygon \
    -o /data/campsites.geojsonseq --overwrite
```

**Zwei Abweichungen vom Auftragsdokument, die beim Testen mit echten Daten
nötig wurden (das Dokument nennt nur `osmium export ... -f geojsonseq`, ohne
diese Flags):**

- **`-u type_id`** (`--add-unique-id`): ohne dieses Flag enthält der
  GeoJSON-Export **keine OSM-Typ/ID-Information** — `external_key`
  (`osm:way/123456`) lässt sich dann nicht bilden.
- **`--geometry-types point,polygon`** (ohne `linestring`): `osmium export`
  gibt für geschlossene Ways standardmäßig **beide** Repräsentationen aus —
  die rohe Way-Geometrie (als `LineString`, ID-Präfix `w`) UND die von
  osmium zusammengesetzte Fläche (`Polygon`/`MultiPolygon`, ID-Präfix `a`).
  Ohne diesen Filter importiert `import_osm_campsites.py` denselben
  Campingplatz zweimal unter zwei verschiedenen `external_key`s. Beim ersten
  Testlauf mit echten Daten so aufgefallen (Region nord-est: 1014 statt 554
  echte Campingplätze).

## 4. Import

```bash
cd ../..  # zurück ins ingest/-Verzeichnis
.venv/Scripts/python.exe import_osm_campsites.py --file osm/data/campsites.geojsonseq
```
