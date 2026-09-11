"""enrich.charge_point_image_override bleibt vom Fetcher unangetastet
(Auftrag "Ladesaeulen-Bilder" §7, Test 1) -- analog zu
test_enrich_immutability.py, hier fuer core.charge_point_image statt
enrich.trailer_suitability.

Ablauf:
1. Eine echte Ladesaeule mit mindestens einem core.charge_point_image-
   Eintrag waehlen (Fetcher muss vorher schon einmal gelaufen sein).
2. Ein Override setzen (hidden=true) fuer genau dieses Bild.
3. fetch_charge_point_images.py fuer eine Bbox, die diese Ladesaeule
   enthaelt, mit --refresh-older-than 0h erneut laufen lassen (erzwingt
   Re-Fetch trotz kuerzlich gesetztem fetched_at).
4. Pruefen: der Override (hidden/sort_order/note) ist byte-gleich zum in
   Schritt 2 gesetzten Wert, core.v_charge_point_image blendet das Bild
   weiterhin aus -- core.charge_point_image selbst darf sich aendern
   (fetched_at etc.), das ist erwuenscht.
5. Aufraeumen: Override wieder loeschen (Test hinterlaesst keine Spuren).

Voraussetzung: DATABASE_URL zeigt auf eine Instanz, in der bereits
core.charge_point_image-Zeilen existieren (mind. ein vorheriger
Fetcher-Lauf).

Aufruf:
    .venv/Scripts/python.exe test_charge_point_image_override_immutability.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import subprocess
import sys

from common import get_connection, setup_logging

TEST_NOTE_MARKER = "TEST_CHARGE_POINT_IMAGE_OVERRIDE_MARKER"


def main() -> int:
    log = setup_logging()
    conn = get_connection()
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                select i.external_key, i.source, i.source_id, cp.lon, cp.lat
                from core.charge_point_image i
                join core.charge_point_geo cp on cp.external_key = i.external_key
                order by i.fetched_at desc
                limit 1
                """
            )
            row = cur.fetchone()

        if not row:
            log.error(
                "Kein core.charge_point_image-Eintrag gefunden -- Fetcher zuerst mindestens "
                "einmal laufen lassen (siehe Docstring)."
            )
            return 1

        external_key, source, source_id, lon, lat = row
        log.info("Teste mit external_key=%s source=%s source_id=%s", external_key, source, source_id)

        with conn.cursor() as cur:
            cur.execute(
                """
                insert into enrich.charge_point_image_override (external_key, source, source_id, hidden, note)
                values (%s, %s, %s, true, %s)
                on conflict (external_key, source, source_id) do update set hidden = true, note = excluded.note
                """,
                (external_key, source, source_id, TEST_NOTE_MARKER),
            )

        with conn.cursor() as cur:
            cur.execute(
                "select hidden, sort_order, note, updated_at from enrich.charge_point_image_override "
                "where external_key = %s and source = %s and source_id = %s",
                (external_key, source, source_id),
            )
            before = cur.fetchone()

        margin = 0.001
        bbox = f"{lon - margin},{lat - margin},{lon + margin},{lat + margin}"
        result = subprocess.run(
            [
                sys.executable,
                "fetch_charge_point_images.py",
                "--bbox",
                bbox,
                "--source",
                "commons",
                "--refresh-older-than",
                "0h",
            ],
            capture_output=True,
            text=True,
        )
        log.info("Fetcher-Lauf beendet mit exit code %d", result.returncode)
        if result.returncode != 0:
            log.error("Fetcher-Lauf fehlgeschlagen:\n%s", result.stderr)
            return 1

        with conn.cursor() as cur:
            cur.execute(
                "select hidden, sort_order, note, updated_at from enrich.charge_point_image_override "
                "where external_key = %s and source = %s and source_id = %s",
                (external_key, source, source_id),
            )
            after = cur.fetchone()

        with conn.cursor() as cur:
            cur.execute(
                "select count(*) from core.v_charge_point_image where external_key = %s and source_id = %s",
                (external_key, source_id),
            )
            (visible_count,) = cur.fetchone()

        ok = True
        if before != after:
            log.error("Override hat sich veraendert: vorher=%s nachher=%s", before, after)
            ok = False
        if visible_count != 0:
            log.error("Bild ist trotz hidden=true in core.v_charge_point_image sichtbar (%d Treffer).", visible_count)
            ok = False

        if ok:
            log.info("OK: Override unveraendert, Bild bleibt in der View ausgeblendet.")
        return 0 if ok else 1
    finally:
        with conn.cursor() as cur:
            cur.execute(
                "delete from enrich.charge_point_image_override where note = %s",
                (TEST_NOTE_MARKER,),
            )
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
