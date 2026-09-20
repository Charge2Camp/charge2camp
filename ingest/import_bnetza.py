"""Ladesaeulen-Ingest von der Bundesnetzagentur (Ladesaeulenregister),
siehe \\MyCloud\\work\\charge2camp\\LAdesäule_Schnittstellen.rtf Abschnitt 1
(PRIORITAET 2 -- offizielle nationale Ladeinfrastrukturquelle) und
docs/data-sources.md.

STATUS: Geruest, KEIN Live-Import. Die Bundesnetzagentur veroeffentlicht das
Ladesaeulenregister als periodischen CSV/XLSX-Download (kein Live-API,
siehe ladesaeulenregister.de), mit einem eigenen, bislang ungeprueften
Spaltenformat. Nach dem Prinzip "keine Scheindaten" (CLAUDE.md Punkt 2) wird
hier KEINE Spaltenzuordnung geraten -- COLUMN_MAP bleibt leer, bis eine
echte Exportdatei vorliegt (Nutzer liefert sie nach).

Sobald COLUMN_MAP befuellt ist, ist der Rest bewusst analog zu
import_ocm.py --file gehalten:
  1. Rohdaten unveraendert nach raw.charge_point (source='bundesnetzagentur')
     schreiben (Auditierbarkeit, siehe raw.import_run).
  2. Je Zeile ein payload-dict im selben Format wie parse_poi() in
     import_ocm.py bauen (external_key, name, operator, lat, lon, address,
     postcode, city, country_code, access_type, is_operational,
     max_power_kw, connector_count, source_updated_at).
  3. core.upsert_charge_point(payload, 'bundesnetzagentur') aufrufen --
     DERSELBE zentrale Resolver wie fuer OCM, keine eigene Merge-Logik
     (Auftragsdokument Abschnitt 13).
  4. core.source_registry.last_successful_import wird automatisch von
     ingest/common.py's import_run()-Contextmanager nachgefuehrt.

external_key-Konvention: 'bnetza:<EVSE-ID oder Registernummer>' -- MUSS eine
stabile, in der Exportdatei vorhandene ID sein (siehe Auftragsdokument
Abschnitt 16, Matching-Stufe 1 "offizielle externe Ladepunkt-ID"). Bis diese
Spalte bekannt ist, kann external_key nicht befuellt werden.
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from psycopg2.extras import Json

from common import get_connection, import_run, setup_logging

# TODO(BNetzA-Exportdatei ausstehend): Spalte im CSV/XLSX -> core.charge_point-Feld.
# Beispielhafte Zielstruktur (NICHT geraten befuellen, siehe Moduldocstring):
# COLUMN_MAP = {
#     "Betreiber": "operator",
#     "Straße": "address_street",
#     "Hausnummer": "address_house_number",
#     "Postleitzahl": "postcode",
#     "Ort": "city",
#     "Bundesland": None,  # kein core-Feld, nur zur Info
#     "Breitengrad": "lat",
#     "Laengengrad": "lon",
#     "Nennleistung Ladeeinrichtung [kW]": "max_power_kw",
#     "Anzahl Ladepunkte": "connector_count",
#     "Inbetriebnahmedatum": "source_updated_at",
# }
COLUMN_MAP: dict[str, str | None] = {}


def load_rows(path: str) -> list[dict[str, Any]]:
    """Liest die BNetzA-Exportdatei (CSV oder XLSX) roh ein -- OHNE
    Spaltenzuordnung. Platzhalter, bis eine echte Datei vorliegt."""
    raise NotImplementedError(
        "import_bnetza.py: COLUMN_MAP ist leer. Bitte zuerst eine echte "
        "Bundesnetzagentur-Exportdatei (CSV/XLSX vom Ladesaeulenregister) "
        "bereitstellen und die Spaltenzuordnung in COLUMN_MAP eintragen -- "
        f"siehe Moduldocstring. Angegebener Pfad: {path}"
    )


def parse_row(row: dict[str, Any]) -> dict[str, Any] | None:
    """Analog zu parse_poi() in import_ocm.py -- baut das core.upsert_charge_point-
    Payload aus einer BNetzA-Zeile. Braucht COLUMN_MAP, siehe load_rows()."""
    raise NotImplementedError("Siehe load_rows() -- COLUMN_MAP muss zuerst befuellt werden.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ladesaeulen-Ingest vom Bundesnetzagentur-Ladesaeulenregister (Geruest, siehe Moduldocstring)."
    )
    parser.add_argument("--file", required=True, metavar="PATH", help="CSV/XLSX-Exportdatei des Ladesaeulenregisters")
    args = parser.parse_args()

    logger = setup_logging()

    if not COLUMN_MAP:
        raise SystemExit(
            "COLUMN_MAP ist leer -- kein Live-Import moeglich (Prinzip 'keine "
            "Scheindaten', siehe CLAUDE.md Punkt 2 und Moduldocstring). Bitte "
            "zuerst eine echte Exportdatei bereitstellen."
        )

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"Datei nicht gefunden: {path}")

    rows = load_rows(args.file)
    logger.info("%d Datensaetze aus %s gelesen.", len(rows), args.file)

    conn = get_connection()
    try:
        with import_run(conn, source="bundesnetzagentur", scope=f"file:{args.file}") as (run_id, state):
            with conn.cursor() as cur:
                for row in rows:
                    parsed = parse_row(row)
                    if parsed is None:
                        continue

                    cur.execute(
                        """
                        insert into raw.charge_point (source, source_id, import_run_id, payload, lat, lon)
                        values ('bundesnetzagentur', %s, %s, %s, %s, %s)
                        on conflict (source, source_id) do update set
                            import_run_id = excluded.import_run_id,
                            payload = excluded.payload,
                            lat = excluded.lat,
                            lon = excluded.lon,
                            fetched_at = now()
                        """,
                        (parsed["external_key"], run_id, Json(row), parsed["lat"], parsed["lon"]),
                    )

                    payload = {k: v for k, v in parsed.items() if not k.startswith("_")}
                    cur.execute(
                        "select id, manual_override from core.upsert_charge_point(%(payload)s, 'bundesnetzagentur')",
                        {"payload": Json(payload)},
                    )
                    cur.fetchone()

                    state["record_count"] += 1
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Ladepunkte.", state["record_count"])


if __name__ == "__main__":
    main()
