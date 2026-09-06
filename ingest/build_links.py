"""Fussweg-Verknuepfung Campingplatz <-> Ladepunkt (Auftrag C, siehe
CLAUDE_CODE_AUFTRAG.md Abschnitt 8).

Braucht einen laufenden OSRM-Server mit Fuss-Profil (nicht Auto!) --
siehe ingest/osrm/README.md fuer den Aufbau (osrm-extract -p /opt/foot.lua,
osrm-partition, osrm-customize, dann osrm-routed). Standard-URL:
http://localhost:5001, ueber OSRM_FOOT_URL ueberschreibbar.

Ablauf pro Campingplatz (Auftrag Abschnitt 8):
1. Kandidaten per PostGIS: ST_DWithin <= 5000 m, is_operational=true,
   sortiert nach Distanz, LIMIT 50.
2. EINE OSRM-Table-Anfrage pro Campingplatz (ein Start, viele Ziele) --
   nicht N Einzelrouten.
3. Klassifizierung: on_site (innerhalb boundary ODER <=150 m Luftlinie),
   walking (Gehstrecke <=1200 m), nearby_drive (Rest bis 5000 m).
4. UPSERT auf (campsite_id, charge_point_id).
5. Am Ende: REFRESH MATERIALIZED VIEW CONCURRENTLY core.campsite_search.

Ein einzelner OSRM-Fehler bricht den Lauf NICHT ab: walk_distance_m/
walk_duration_s bleiben NULL fuer den betroffenen Campingplatz, die
Fehlerquote wird am Ende geloggt (Auftrag Abschnitt 8, "Bei OSRM-Fehlern").

Sanity-Guard (durch Auftrag F/sql/90_quality_checks.sql #8 entdeckt): liegt
Start- oder Zielpunkt ausserhalb des geladenen OSRM-Kartenausschnitts,
snapped OSRM beide Koordinaten stillschweigend auf denselben naechst-
gelegenen Strassenknoten im Ausschnitt, statt einen Fehler zu melden --
das ergibt eine "Gehstrecke" von 0 m bei mehreren Kilometern Luftlinie.
Physikalisch unmoegliche Ergebnisse (walk_distance_m < air_distance_m,
mit etwas Toleranz fuer Snapping-Ungenauigkeit) werden deshalb verworfen
(auf NULL gesetzt) statt als echte Gehstrecke gespeichert zu werden.
"""

from __future__ import annotations

import os
from typing import Any

import requests
from psycopg2.extras import execute_batch

from common import get_connection, import_run, setup_logging

OSRM_FOOT_URL = os.environ.get("OSRM_FOOT_URL", "http://localhost:5001")

CANDIDATE_RADIUS_M = 5000
CANDIDATE_LIMIT = 50
ON_SITE_AIR_DISTANCE_M = 150
WALKING_MAX_M = 1200
# Toleranz fuer GPS-/Snapping-Ungenauigkeit: eine echte Gehstrecke ist nie
# kuerzer als die Luftlinie, aber ein paar Meter Toleranz verhindert falsche
# Verwuerfe bei fast identischen Standorten (z. B. Ladepunkt direkt am
# Campingplatz-Eingang).
IMPLAUSIBLE_TOLERANCE_M = 20

FETCH_CAMPSITES_SQL = """
select id, external_key, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
from core.campsite
order by external_key
"""

FETCH_CANDIDATES_SQL = """
select
    cp.id, cp.external_key,
    ST_X(cp.geom::geometry) as lon, ST_Y(cp.geom::geometry) as lat,
    ST_Distance(cp.geom, cs.geom) as air_distance_m,
    (cs.boundary is not null and ST_Covers(cs.boundary, cp.geom)) as within_boundary
from core.charge_point cp
cross join lateral (select geom, boundary from core.campsite where id = %(campsite_id)s) cs
where cp.is_operational = true
  and ST_DWithin(cp.geom, cs.geom, %(radius)s)
order by air_distance_m
limit %(limit)s
"""

UPSERT_LINK_SQL = """
insert into core.campsite_charge_link (
    campsite_id, charge_point_id, relation, air_distance_m, walk_distance_m, walk_duration_s, computed_at
) values (%s, %s, %s, %s, %s, %s, now())
on conflict (campsite_id, charge_point_id) do update set
    relation = excluded.relation,
    air_distance_m = excluded.air_distance_m,
    walk_distance_m = excluded.walk_distance_m,
    walk_duration_s = excluded.walk_duration_s,
    computed_at = now()
"""


def classify(air_distance_m: float, within_boundary: bool, walk_distance_m: float | None) -> str:
    if within_boundary or air_distance_m <= ON_SITE_AIR_DISTANCE_M:
        return "on_site"
    if walk_distance_m is not None and walk_distance_m <= WALKING_MAX_M:
        return "walking"
    return "nearby_drive"


def fetch_walk_table(origin: tuple[float, float], destinations: list[tuple[float, float]]) -> list[dict[str, float | None]]:
    """Eine OSRM-Table-Anfrage: 1 Quelle (Campingplatz), N Ziele
    (Ladepunkt-Kandidaten). Gibt fuer jedes Ziel {distance, duration}
    zurueck (None, falls OSRM keine Fussroute findet)."""
    coords = [origin] + destinations
    coord_str = ";".join(f"{lon},{lat}" for lon, lat in coords)
    dest_indices = ";".join(str(i) for i in range(1, len(coords)))
    url = f"{OSRM_FOOT_URL}/table/v1/foot/{coord_str}"
    response = requests.get(
        url, params={"sources": "0", "destinations": dest_indices, "annotations": "distance,duration"}, timeout=30
    )
    response.raise_for_status()
    data = response.json()
    if data.get("code") != "Ok":
        raise RuntimeError(f"OSRM-Table-Antwort nicht Ok: {data.get('code')} {data.get('message')}")

    distances = data["distances"][0]
    durations = data["durations"][0]
    return [{"distance": d, "duration": t} for d, t in zip(distances, durations)]


def main() -> None:
    logger = setup_logging()

    conn = get_connection()
    osrm_errors = 0
    campsites_without_candidates = 0
    total_links = 0
    implausible_results = 0

    try:
        with import_run(conn, source="osm", scope="build_links") as (run_id, state):
            with conn.cursor() as fetch_cur:
                fetch_cur.execute(FETCH_CAMPSITES_SQL)
                campsites = fetch_cur.fetchall()

            logger.info("%d Campingplaetze zu verknuepfen.", len(campsites))

            with conn.cursor() as cur:
                for campsite_id, external_key, lon, lat in campsites:
                    cur.execute(FETCH_CANDIDATES_SQL, {"campsite_id": campsite_id, "radius": CANDIDATE_RADIUS_M, "limit": CANDIDATE_LIMIT})
                    candidates = cur.fetchall()
                    if not candidates:
                        campsites_without_candidates += 1
                        continue

                    walk_results: list[dict[str, Any] | None]
                    try:
                        destinations = [(c[2], c[3]) for c in candidates]  # (lon, lat)
                        walk_results = fetch_walk_table((lon, lat), destinations)
                    except (requests.RequestException, RuntimeError, KeyError, IndexError) as exc:
                        osrm_errors += 1
                        logger.warning("OSRM-Fehler fuer %s: %s -- setze walk_distance_m=NULL fuer alle Kandidaten.", external_key, exc)
                        walk_results = [None] * len(candidates)

                    rows = []
                    for candidate, walk in zip(candidates, walk_results):
                        cp_id, cp_key, cp_lon, cp_lat, air_distance_m, within_boundary = candidate
                        walk_distance_m = walk["distance"] if walk and walk["distance"] is not None else None
                        walk_duration_s = walk["duration"] if walk and walk["duration"] is not None else None
                        if walk_distance_m is not None and walk_distance_m < air_distance_m - IMPLAUSIBLE_TOLERANCE_M:
                            implausible_results += 1
                            walk_distance_m = None
                            walk_duration_s = None
                        relation = classify(air_distance_m, within_boundary, walk_distance_m)
                        rows.append(
                            (
                                campsite_id,
                                cp_id,
                                relation,
                                round(air_distance_m),
                                round(walk_distance_m) if walk_distance_m is not None else None,
                                round(walk_duration_s) if walk_duration_s is not None else None,
                            )
                        )

                    execute_batch(cur, UPSERT_LINK_SQL, rows, page_size=500)
                    total_links += len(rows)
                    state["record_count"] += len(rows)

            # Lesesicht auf den neuesten Stand bringen (CONCURRENTLY, damit
            # laufende Lesezugriffe nicht blockiert werden -- braucht den
            # unique Index idx_cssearch_id, siehe Migration).
            conn.commit()
            with conn.cursor() as cur:
                cur.execute("refresh materialized view concurrently core.campsite_search")
    finally:
        conn.close()

    logger.info("Fertig: %d Verknuepfungen ueber %d Campingplaetze.", total_links, len(campsites))
    if campsites_without_candidates:
        logger.info("%d Campingplaetze ohne Ladepunkt-Kandidaten im Umkreis von %d m.", campsites_without_candidates, CANDIDATE_RADIUS_M)
    if osrm_errors:
        logger.warning("OSRM-Fehler bei %d von %d Campingplaetzen (walk_distance_m=NULL gesetzt).", osrm_errors, len(campsites))
    if implausible_results:
        logger.warning(
            "%d Ergebnisse verworfen (walk_distance_m < air_distance_m -- vermutlich Punkte ausserhalb der "
            "geladenen OSRM-Karte, siehe Docstring). walk_distance_m=NULL gesetzt statt falscher Distanz.",
            implausible_results,
        )


if __name__ == "__main__":
    main()
