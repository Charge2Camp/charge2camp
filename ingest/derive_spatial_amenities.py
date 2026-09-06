"""Raeumlich abgeleitete Campingplatz-Merkmale (Auftrag B Abschnitt 7,
CLAUDE_CODE_AUFTRAG.md): Merkmale, die eine raeumliche Suche nach ANDEREN
OSM-Objekten "innerhalb boundary" (oder in der Naehe, wenn keine Flaeche
bekannt ist) brauchen -- import_osm_campsites.py deckt bewusst nur direkt
aus den eigenen Tags des Campingplatzes ablesbare Merkmale ab (siehe
Modulkommentar dort).

Bewusst eingegrenzter Umfang (Kostenoptimierung, siehe CLAUDE.md): nur
`pool` und `playground`. `shop`/`restaurant` (Tag `shop=*` bzw.
`amenity=restaurant,cafe`) sind auf Laenderebene um Groessenordnungen
haeufiger als Schwimmbecken/Spielplaetze -- deren Extraktion/Verarbeitung
fuer ganz Bayern+Oesterreich+Italien waere ein eigener, deutlich teurerer
Schritt. `charging_on_site` wird bereits zuverlaessiger aus den echten
Ladepunkt-Standortdaten abgeleitet (core.campsite_charge_link, siehe
core.campsite_search-View) und braucht diese Herleitung nicht zusaetzlich.

Ablauf:
1. Eine oder mehrere geojsonseq-Dateien lesen (osmium export -u type_id
   --geometry-types point,polygon, gefiltert auf
   leisure=swimming_pool/swimming_pool=yes/leisure=playground/
   playground=yes -- siehe ingest/osm/README.md).
2. Jedes Feature einem Merkmal zuordnen, Zentroid berechnen (dieselbe
   Logik wie import_osm_campsites.point_and_boundary).
3. Alle Kandidatenpunkte in eine temporaere Tabelle laden.
4. EIN raeumlicher Join gegen core.campsite: innerhalb der Campingplatz-
   Flaeche (boundary), falls bekannt, sonst im 50-m-Umkreis um den
   Campingplatz-Punkt (viele Campingplaetze haben nur einen Punkt, keine
   Flaeche). confidence=70 ('osm_spatial'), darf eine hoehere confidence
   (z. B. spaetere Website-Recherche, 90) nie ueberschreiben.

Aufruf:
    .venv/Scripts/python.exe derive_spatial_amenities.py \
        osm/data/italy-poolplayground.geojsonseq \
        osm/data/austria-poolplayground.geojsonseq \
        osm/data/bayern-poolplayground.geojsonseq
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Callable

from psycopg2.extras import execute_values

from common import get_connection, import_run, setup_logging
from import_osm_campsites import iter_geojsonseq, point_and_boundary

CONFIDENCE_OSM_SPATIAL = 70
FALLBACK_RADIUS_M = 50  # fuer Campingplaetze ohne bekannte Flaeche (nur Punkt-Geometrie)

AMENITY_RULES: list[tuple[str, Callable[[dict[str, Any]], bool]]] = [
    ("pool", lambda p: p.get("swimming_pool") == "yes" or p.get("leisure") == "swimming_pool"),
    ("playground", lambda p: p.get("playground") == "yes" or p.get("leisure") == "playground"),
]

CREATE_TEMP_TABLE_SQL = """
create temporary table spatial_amenity_candidate (
    lon double precision not null,
    lat double precision not null,
    amenity_key text not null
) on commit drop
"""

INSERT_CANDIDATES_SQL = "insert into spatial_amenity_candidate (lon, lat, amenity_key) values %s"

DERIVE_SQL = """
insert into core.campsite_amenity (campsite_id, amenity_key, value_bool, source, confidence)
select distinct cs.id, t.amenity_key, true, 'osm_spatial', %(confidence)s
from core.campsite cs
join spatial_amenity_candidate t
  on (
        cs.boundary is not null
        and ST_Covers(cs.boundary, ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography)
     ) or (
        cs.boundary is null
        and ST_DWithin(cs.geom, ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography, %(radius)s)
     )
on conflict (campsite_id, amenity_key) do update set
    value_bool = excluded.value_bool,
    source = excluded.source,
    confidence = excluded.confidence,
    updated_at = now()
where excluded.confidence > core.campsite_amenity.confidence
"""


def extract_candidates(path: Path) -> list[tuple[float, float, str]]:
    rows: list[tuple[float, float, str]] = []
    for feature in iter_geojsonseq(path):
        props = feature.get("properties") or {}
        matched_keys = [key for key, rule in AMENITY_RULES if rule(props)]
        if not matched_keys:
            continue
        geom = point_and_boundary(feature.get("geometry") or {})
        if geom is None:
            continue
        lat, lon, _boundary = geom
        for key in matched_keys:
            rows.append((lon, lat, key))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Raeumlich abgeleitete pool/playground-Merkmale (Auftrag B §7).")
    parser.add_argument("files", nargs="+", metavar="PATH", help="geojsonseq-Dateien (osmium export -u type_id)")
    args = parser.parse_args()

    logger = setup_logging()

    candidates: list[tuple[float, float, str]] = []
    for file_arg in args.files:
        path = Path(file_arg)
        file_candidates = extract_candidates(path)
        logger.info("%s: %d Kandidaten (pool/playground).", path.name, len(file_candidates))
        candidates.extend(file_candidates)

    logger.info("Insgesamt %d Kandidatenpunkte.", len(candidates))
    if not candidates:
        logger.warning("Keine Kandidaten gefunden -- nichts zu tun.")
        return

    conn = get_connection()
    try:
        with import_run(conn, source="osm", scope="derive_spatial_amenities") as (run_id, state):
            with conn.cursor() as cur:
                cur.execute(CREATE_TEMP_TABLE_SQL)
                execute_values(cur, INSERT_CANDIDATES_SQL, candidates, page_size=2000)
                cur.execute(DERIVE_SQL, {"confidence": CONFIDENCE_OSM_SPATIAL, "radius": FALLBACK_RADIUS_M})
                state["record_count"] = cur.rowcount
        conn.commit()
    finally:
        conn.close()

    logger.info("Fertig: %d core.campsite_amenity-Zeilen gesetzt/aktualisiert (pool/playground).", state["record_count"])


if __name__ == "__main__":
    main()
