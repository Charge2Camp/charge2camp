"""Idempotenz des Bilder-Fetchers (Auftrag "Ladesaeulen-Bilder" §7, Test 2):
ein zweiter Lauf gegen dieselbe Bbox erzeugt keine Duplikate.

Ablauf:
1. Eine kleine, echte Bbox mit mindestens einer Ladesaeule waehlen.
2. fetch_charge_point_images.py --source commons zweimal hintereinander
   mit --refresh-older-than 0h laufen lassen (erzwingt Re-Fetch beim
   zweiten Lauf, statt ihn wegen "kuerzlich geholt" zu ueberspringen --
   genau das soll ja idempotent sein).
3. Zeilenzahl in core.charge_point_image fuer diese Bbox vor/zwischen/nach
   beiden Laeufen vergleichen: nach Lauf 1 > vorher (falls Treffer
   existieren), nach Lauf 2 == nach Lauf 1 (kein Duplikat, nur upgedatet).

Nutzt eine ECHTE Ladesaeule aus core.charge_point (erstes Ergebnis
innerhalb der Bbox) statt Fixtures, damit der Test den echten Commons-
Abgleich durchlaeuft.

Aufruf:
    .venv/Scripts/python.exe test_charge_point_image_idempotency.py \\
        --bbox west,south,east,north

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import argparse
import subprocess
import sys

from common import get_connection, setup_logging


def count_rows(conn, bbox: tuple[float, float, float, float]) -> int:
    west, south, east, north = bbox
    with conn.cursor() as cur:
        cur.execute(
            """
            select count(*)
            from core.charge_point_image i
            join core.charge_point_geo cp on cp.external_key = i.external_key
            where cp.lon between %s and %s and cp.lat between %s and %s
            """,
            (west, east, south, north),
        )
        (count,) = cur.fetchone()
        return count


def run_fetcher(bbox_str: str) -> int:
    result = subprocess.run(
        [
            sys.executable,
            "fetch_charge_point_images.py",
            "--bbox",
            bbox_str,
            "--source",
            "commons",
            "--limit",
            "20",
            "--refresh-older-than",
            "0h",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr, file=sys.stderr)
    return result.returncode


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bbox", required=True, help="west,south,east,north")
    args = parser.parse_args()

    log = setup_logging()
    conn = get_connection()
    conn.autocommit = True

    west, south, east, north = (float(p) for p in args.bbox.split(","))
    bbox = (west, south, east, north)

    before = count_rows(conn, bbox)
    log.info("Zeilen vor Lauf 1: %d", before)

    if run_fetcher(args.bbox) != 0:
        log.error("Erster Fetcher-Lauf fehlgeschlagen.")
        return 1
    after_first = count_rows(conn, bbox)
    log.info("Zeilen nach Lauf 1: %d", after_first)

    if run_fetcher(args.bbox) != 0:
        log.error("Zweiter Fetcher-Lauf fehlgeschlagen.")
        return 1
    after_second = count_rows(conn, bbox)
    log.info("Zeilen nach Lauf 2: %d", after_second)

    if after_second != after_first:
        log.error("Nicht idempotent: %d != %d nach zweitem Lauf.", after_second, after_first)
        return 1

    log.info("OK: identische Zeilenzahl nach zweitem Lauf -- idempotent.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
