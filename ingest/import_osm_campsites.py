"""Campingplatz-Ingest von OpenStreetMap (Auftrag B, siehe
CLAUDE_CODE_AUFTRAG.md Abschnitt 7).

Liest eine `geojsonseq`-Datei, wie sie `osmium export` erzeugt (siehe
ingest/osm/README.md fuer den vollstaendigen Extraktionsablauf: Geofabrik-
Extrakt -> `osmium tags-filter` -> `osmium export -u type_id`). Das
`-u type_id`-Flag ist WICHTIG -- ohne dieses Flag fehlt die OSM-Typ/ID-
Information im Export komplett und `external_key` kann nicht gebildet
werden (im Auftragsdokument nicht erwaehnt, beim Testen dieses Skripts
entdeckt).

Streamt zeilenweise (ein GeoJSON-Feature pro Zeile), auch fuer sehr grosse
Extrakte (z. B. europe-latest) geeignet -- die gesamte Datei wird nie ins
RAM geladen.

Bewusst NUR der Kernimport (core.campsite + direkt aus eigenen Tags
ablesbare Merkmale, siehe DIRECT_AMENITY_RULES unten). Merkmale, die laut
Auftragsdokument eine raeumliche Suche "innerhalb boundary" nach ANDEREN
OSM-Objekten brauchen (pool/playground/shop/restaurant/charging_on_site)
sowie die raeumlich abgeleiteten Lage-Merkmale (beach_nearby/lake_access/
river_access/mountain) sind ein separater Folgeschritt (eigener Import
weiterer OSM-Layer + raeumlicher Join), siehe sql/quality-Notiz am Ende
dieser Datei.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Iterator

from psycopg2.extras import Json

from common import get_connection, import_run, setup_logging

TYPE_LETTER_TO_WORD = {"n": "node", "w": "way", "r": "relation"}

# Direkt aus den eigenen Tags des Campingplatz-Objekts ablesbar (kein
# raeumlicher Join noetig), siehe Auftragsdokument Abschnitt 7.
DIRECT_AMENITY_RULES: list[tuple[str, Any]] = [
    ("wifi", lambda p: p.get("internet_access") in ("wlan", "yes", "wifi")),
    ("laundry", lambda p: p.get("laundry") == "yes"),
    ("dump_station", lambda p: p.get("sanitary_dump_station") == "yes"),
    ("dogs_allowed", lambda p: p.get("dog") in ("yes", "leashed")),
    ("open_all_year", lambda p: p.get("opening_hours") == "24/7" or p.get("seasonal") == "no"),
    ("accessible", lambda p: p.get("wheelchair") == "yes"),
    ("caravans_allowed", lambda p: p.get("caravans") == "yes"),
]

# Provenienz-Konfidenz je Quelle, siehe Auftragsdokument Abschnitt 7
# ("Wichtig: source und confidence je Merkmal setzen").
CONFIDENCE_OSM_DIRECT = 80

UPSERT_CAMPSITE_SQL = """
insert into core.campsite (
    external_key, name, geom, boundary, address, postcode, city, country_code,
    website, phone, email, capacity, source, last_seen_at, updated_at
) values (
    %(external_key)s, %(name)s,
    ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography,
    case when %(boundary_geojson)s is null then null
         else ST_SetSRID(ST_GeomFromGeoJSON(%(boundary_geojson)s), 4326)::geography end,
    %(address)s, %(postcode)s, %(city)s, %(country_code)s,
    %(website)s, %(phone)s, %(email)s, %(capacity)s,
    'osm', now(), now()
)
on conflict (external_key) do update set
    name = excluded.name,
    geom = excluded.geom,
    boundary = excluded.boundary,
    address = excluded.address,
    postcode = excluded.postcode,
    city = excluded.city,
    country_code = excluded.country_code,
    website = excluded.website,
    phone = excluded.phone,
    email = excluded.email,
    capacity = excluded.capacity,
    last_seen_at = now(),
    updated_at = now()
returning id
"""

# Eine Angabe mit hoeherer confidence darf nie durch eine mit niedrigerer
# ueberschrieben werden (Auftragsdokument Abschnitt 7).
UPSERT_AMENITY_SQL = """
insert into core.campsite_amenity (campsite_id, amenity_key, value_bool, value_num, source, confidence)
values (%s, %s, %s, %s, %s, %s)
on conflict (campsite_id, amenity_key) do update set
    value_bool = excluded.value_bool,
    value_num = excluded.value_num,
    source = excluded.source,
    confidence = excluded.confidence,
    updated_at = now()
where excluded.confidence > core.campsite_amenity.confidence
"""

FILL_MISSING_RESEARCH_TASK_SQL = """
insert into enrich.research_task (campsite_key, status)
select cs.external_key, 'open'
from core.campsite cs
where cs.website is not null
  and not exists (
      select 1 from enrich.research_task rt where rt.campsite_key = cs.external_key
  )
on conflict (campsite_key) do nothing
"""


def external_key_from_osm_id(feature_id: str) -> str:
    letter, numeric = feature_id[0], feature_id[1:]
    type_word = TYPE_LETTER_TO_WORD.get(letter, letter)
    return f"osm:{type_word}/{numeric}"


def centroid_of_ring(ring: list[list[float]]) -> tuple[float, float]:
    """Flaechengewichteter Polygon-Schwerpunkt (Shoelace-Formel). Faellt bei
    entarteten/sehr kleinen Polygonen auf den einfachen Eckpunkt-Mittelwert
    zurueck, statt eine Division durch (nahezu) 0 zu riskieren."""
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    n = len(pts)
    area = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x0, y0 = pts[i]
        x1, y1 = pts[(i + 1) % n]
        cross = x0 * y1 - x1 * y0
        area += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    area *= 0.5
    if abs(area) < 1e-12:
        return sum(p[0] for p in pts) / n, sum(p[1] for p in pts) / n
    return cx / (6 * area), cy / (6 * area)


def point_and_boundary(geometry: dict) -> tuple[float, float, dict | None] | None:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return None

    if gtype == "Point":
        lon, lat = coords
        return lat, lon, None

    if gtype in ("Polygon", "MultiPolygon"):
        ring = coords[0] if gtype == "Polygon" else coords[0][0]
        lon, lat = centroid_of_ring(ring)
        boundary = {"type": "Polygon", "coordinates": [ring]}
        return lat, lon, boundary

    if gtype == "LineString":
        if len(coords) >= 4 and coords[0] == coords[-1]:
            # Geschlossener Ring, von osmium aber nicht als Flaeche erkannt
            # (z. B. fehlendes area=yes) -- selbst als Polygon behandeln.
            lon, lat = centroid_of_ring(coords)
            boundary = {"type": "Polygon", "coordinates": [coords]}
            return lat, lon, boundary
        # Offener Linienzug (unvollstaendige Way-Geometrie): Startpunkt als
        # Naeherung, keine Flaeche -- besser als den Datensatz zu verlieren.
        lon, lat = coords[0]
        return lat, lon, None

    return None


def parse_amperage(raw: str) -> float | None:
    # power_supply:amperage steht manchmal als "6;10" (mehrere Werte) --
    # ersten nehmen, ehrlicher Best-Effort statt Fehlschlag.
    first = str(raw).split(";")[0].strip()
    try:
        return float(first)
    except ValueError:
        return None


def parse_campsite(feature: dict) -> dict[str, Any] | None:
    """None = kein echter Campingplatz (z. B. ein von osmium mitexportierter
    Way-Member-Knoten wie ein Zaun-/Toreintrag) oder Geometrie nicht
    verwertbar."""
    props = feature.get("properties") or {}
    if props.get("tourism") != "camp_site":
        return None

    feature_id = feature.get("id")
    if not feature_id:
        return None

    geom = point_and_boundary(feature.get("geometry") or {})
    if geom is None:
        return None
    lat, lon, boundary = geom

    name = props.get("name")
    confidence = 50
    if not name:
        name = "Campingplatz (unbenannt)"
        confidence = 20

    website = props.get("website") or props.get("contact:website")
    phone = props.get("phone") or props.get("contact:phone")
    email = props.get("operator:email") or props.get("contact:email") or props.get("email")

    address = props.get("addr:street")
    housenumber = props.get("addr:housenumber")
    if address and housenumber:
        address = f"{address} {housenumber}"

    capacity = None
    if props.get("capacity") is not None:
        try:
            capacity = int(float(props["capacity"]))
        except (TypeError, ValueError):
            capacity = None

    return {
        "external_key": external_key_from_osm_id(feature_id),
        "name": name,
        "confidence": confidence,
        "lat": lat,
        "lon": lon,
        "boundary_geojson": json.dumps(boundary) if boundary else None,
        "address": address,
        "postcode": props.get("addr:postcode"),
        "city": props.get("addr:city"),
        "country_code": (props.get("addr:country") or "").upper()[:2] or None,
        "website": website,
        "phone": phone,
        "email": email,
        "capacity": capacity,
        "_props": props,
        "_feature": feature,
    }


def iter_geojsonseq(path: Path) -> Iterator[dict]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            # osmium's geojsonseq-Format ist RFC 8142 (RS-getrennt) ODER
            # schlicht eine Zeile pro Feature -- beides robust behandeln.
            line = line.lstrip("\x1e")
            if line:
                yield json.loads(line)


def upsert_raw(cur, source_id: str, payload: dict, lat: float, lon: float, run_id: int) -> None:
    cur.execute(
        """
        insert into raw.campsite (source, source_id, import_run_id, payload, lat, lon)
        values ('osm', %s, %s, %s, %s, %s)
        on conflict (source, source_id) do update set
            import_run_id = excluded.import_run_id,
            payload = excluded.payload,
            lat = excluded.lat,
            lon = excluded.lon,
            fetched_at = now()
        """,
        (source_id, run_id, Json(payload), lat, lon),
    )


def apply_direct_amenities(cur, campsite_id: str, props: dict) -> None:
    for key, rule in DIRECT_AMENITY_RULES:
        if rule(props):
            cur.execute(UPSERT_AMENITY_SQL, (campsite_id, key, True, None, "osm_direct", CONFIDENCE_OSM_DIRECT))

    if props.get("power_supply") == "yes" and props.get("power_supply:amperage"):
        amperage = parse_amperage(props["power_supply:amperage"])
        if amperage is not None:
            cur.execute(
                UPSERT_AMENITY_SQL,
                (campsite_id, "pitch_electric_a", None, amperage, "osm_direct", CONFIDENCE_OSM_DIRECT),
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Campingplatz-Ingest von OpenStreetMap (Auftrag B).")
    parser.add_argument("--file", required=True, metavar="PATH", help="geojsonseq-Datei (osmium export -u type_id)")
    args = parser.parse_args()

    logger = setup_logging()
    path = Path(args.file)

    skipped_not_campsite = 0
    skipped_no_geometry = 0
    unnamed_count = 0

    conn = get_connection()
    try:
        with import_run(conn, source="osm", scope=f"file:{args.file}") as (run_id, state):
            with conn.cursor() as cur:
                for feature in iter_geojsonseq(path):
                    parsed = parse_campsite(feature)
                    if parsed is None:
                        props = feature.get("properties") or {}
                        if props.get("tourism") != "camp_site":
                            skipped_not_campsite += 1
                        else:
                            skipped_no_geometry += 1
                        continue

                    if parsed["confidence"] == 20:
                        unnamed_count += 1

                    upsert_raw(cur, parsed["external_key"].split(":", 1)[1], parsed["_feature"], parsed["lat"], parsed["lon"], run_id)

                    cur.execute(UPSERT_CAMPSITE_SQL, parsed)
                    campsite_id = cur.fetchone()[0]

                    apply_direct_amenities(cur, campsite_id, parsed["_props"])

                    state["record_count"] += 1

                cur.execute(FILL_MISSING_RESEARCH_TASK_SQL)
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Campingplaetze.", state["record_count"])
    logger.info("Uebersprungen (kein tourism=camp_site, z. B. Way-Member-Knoten): %d", skipped_not_campsite)
    if skipped_no_geometry:
        logger.warning("Uebersprungen (keine verwertbare Geometrie): %d", skipped_no_geometry)
    if unnamed_count:
        logger.warning("%d Campingplaetze ohne Namen (confidence=20, 'Campingplatz (unbenannt)').", unnamed_count)


if __name__ == "__main__":
    main()
