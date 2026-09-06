"""Der wichtigste Test des Projekts (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt
12, Akzeptanzkriterien): ein zweiter Importlauf darf NIEMALS eine Zeile in
enrich.* veraendern. Die Verbindung core<->enrich laeuft ausschliesslich
ueber den stabilen external_key, nie ueber UPSERTs, die enrich.* anfassen.

Ablauf:
1. Einen echten, bereits importierten Ladepunkt waehlen (core.charge_point,
   source='ocm') und seinen rohen OCM-Payload aus raw.charge_point holen --
   also exakt das, was ein erneuter Import erneut verarbeiten wuerde.
2. Eine klar erkennbare Test-Anhaengertauglichkeit in enrich.trailer_
   suitability setzen (verdict='yes', Notiz mit Marker), Originalwert vorher
   sichern.
3. import_ocm.py --file <payload> als Subprozess erneut ausfuehren --
   simuliert einen zweiten Import genau dieses Ladepunkts.
4. Pruefen: enrich.trailer_suitability fuer diesen Ladepunkt ist BYTE-GLEICH
   zum in Schritt 2 gesetzten Wert. core.charge_point.updated_at muss sich
   dagegen tatsaechlich veraendert haben (sonst haette der Reimport gar
   nichts getan, und der Test waere trivial gruen).
5. Aufraeumen: Original-enrich-Wert wiederherstellen (Test hinterlaesst
   keine dauerhaften Spuren in der Datenbank).

Aufruf:
    .venv/Scripts/python.exe test_enrich_immutability.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen (mit Begruendung auf stdout).
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from common import get_connection, setup_logging

TEST_NOTES_MARKER = "TEST_ENRICH_IMMUTABILITY_MARKER"


def main() -> int:
    log = setup_logging()
    conn = get_connection()
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                select rc.source_id, rc.payload, cp.external_key
                from raw.charge_point rc
                join core.charge_point cp on cp.external_key = 'ocm:' || rc.source_id
                where rc.source = 'ocm'
                order by rc.source_id
                limit 1
                """
            )
            row = cur.fetchone()
            if row is None:
                log.error("Kein importierter OCM-Ladepunkt gefunden -- vorher import_ocm.py laufen lassen.")
                return 1
            source_id, payload, external_key = row
            log.info("Test-Ladepunkt: %s", external_key)

            cur.execute(
                "select verdict, confirm_count, dispute_count, notes, origin, updated_at "
                "from enrich.trailer_suitability where charge_point_key = %s",
                (external_key,),
            )
            original = cur.fetchone()
            if original is None:
                log.error("%s hat noch keine enrich.trailer_suitability-Zeile -- unerwartet nach Import.", external_key)
                return 1
            log.info("Original-Anhaengertauglichkeit: %s", original)

            cur.execute(
                """
                update enrich.trailer_suitability
                set verdict = 'yes', confirm_count = 7, dispute_count = 2,
                    notes = %s, origin = 'staff', updated_at = now()
                where charge_point_key = %s
                """,
                (TEST_NOTES_MARKER, external_key),
            )
            cur.execute(
                "select verdict, confirm_count, dispute_count, notes, origin, updated_at "
                "from enrich.trailer_suitability where charge_point_key = %s",
                (external_key,),
            )
            test_value = cur.fetchone()
            log.info("Test-Wert gesetzt: %s", test_value)

            cur.execute("select updated_at from core.charge_point where external_key = %s", (external_key,))
            core_updated_before = cur.fetchone()[0]

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(payload, f)
            payload_path = f.name

        try:
            log.info("Fuehre import_ocm.py --file %s erneut aus ...", payload_path)
            result = subprocess.run(
                [sys.executable, str(Path(__file__).parent / "import_ocm.py"), "--file", payload_path],
                capture_output=True,
                text=True,
                cwd=Path(__file__).parent,
            )
            if result.returncode != 0:
                log.error("import_ocm.py --file ist fehlgeschlagen:\n%s", result.stderr)
                return 1
            log.info("Reimport-Ausgabe:\n%s", result.stdout.strip())
        finally:
            Path(payload_path).unlink(missing_ok=True)

        with conn.cursor() as cur:
            cur.execute(
                "select verdict, confirm_count, dispute_count, notes, origin, updated_at "
                "from enrich.trailer_suitability where charge_point_key = %s",
                (external_key,),
            )
            after = cur.fetchone()
            cur.execute("select updated_at from core.charge_point where external_key = %s", (external_key,))
            core_updated_after = cur.fetchone()[0]

            # Aufraeumen, bevor ausgewertet wird -- der Originalwert muss
            # auch bei einem fehlgeschlagenen Test wiederhergestellt werden.
            cur.execute(
                """
                update enrich.trailer_suitability
                set verdict = %s, confirm_count = %s, dispute_count = %s,
                    notes = %s, origin = %s, updated_at = %s
                where charge_point_key = %s
                """,
                (*original, external_key),
            )
            log.info("enrich.trailer_suitability auf Originalwert zurueckgesetzt.")

        if after != test_value:
            log.error("FEHLGESCHLAGEN: enrich.trailer_suitability wurde vom Reimport veraendert.")
            log.error("  vorher (Test-Wert): %s", test_value)
            log.error("  nachher:            %s", after)
            return 1

        if core_updated_after == core_updated_before:
            log.error(
                "FEHLGESCHLAGEN: core.charge_point.updated_at hat sich NICHT veraendert -- "
                "der Reimport hat den Ladepunkt offenbar gar nicht verarbeitet, der Test ist damit nicht aussagekraeftig."
            )
            return 1

        log.info("BESTANDEN: enrich.trailer_suitability unveraendert, core.charge_point wurde reimportiert.")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
