"""Harte Regel 2 (CLAUDE.md): manuell kuratiert > Bundesnetzagentur >
weitere nationale Quellen (IRVE, RIPREE) > OCM > OSM.

Prueft (1) die Reihenfolge in core.source_registry und (2) das Verhalten
von core.absorb_technical_fields(), das technische Felder nur von einer
echt hoeher priorisierten Quelle uebernimmt. Laeuft komplett in einer
Transaktion mit ROLLBACK -- hinterlaesst nichts in der Datenbank.

Aufruf (lokale Docker-DB, siehe common.DEFAULT_DATABASE_URL):
    .venv/Scripts/python.exe test_source_priority.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import sys

from common import get_connection

EXPECTED_ORDER = [
    ({"admin_manual", "sascha_list"}, "manuell kuratiert"),
    ({"bundesnetzagentur"}, "Bundesnetzagentur"),
    ({"irve", "ripree"}, "weitere nationale Quellen"),
    ({"ocm"}, "Open Charge Map"),
    ({"osm"}, "OpenStreetMap"),
]

# (Ziel-Quelle, eingehende Quelle, erwartet absorbiert?)
ABSORB_CASES = [
    ("irve", "bundesnetzagentur", True),
    ("bundesnetzagentur", "irve", False),
    ("bundesnetzagentur", "ripree", False),
    ("ocm", "ripree", True),
    ("irve", "ripree", False),  # Gleichstand: keine Uebernahme
    ("admin_manual", "bundesnetzagentur", False),
]


def main() -> int:
    conn = get_connection()
    failures: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute("select source_id, priority from core.source_registry")
            priority = dict(cur.fetchall())

            for (higher, higher_name), (lower, lower_name) in zip(EXPECTED_ORDER, EXPECTED_ORDER[1:]):
                if min(priority[s] for s in higher) <= max(priority[s] for s in lower):
                    failures.append(f"{higher_name} muss vor {lower_name} liegen: {priority}")

            for i, (target_source, incoming_source, expected) in enumerate(ABSORB_CASES):
                cur.execute(
                    """
                    insert into core.charge_point (external_key, geom, source, max_power_kw, connector_count)
                    values (%s, 'SRID=4326;POINT(7.6 48.5)', %s, 22, 2)
                    returning id
                    """,
                    (f"test-priority:{i}", target_source),
                )
                target_id = cur.fetchone()[0]
                cur.execute(
                    "select core.absorb_technical_fields(%s, %s, 150, 4, true)",
                    (target_id, incoming_source),
                )
                absorbed = cur.fetchone()[0]
                if absorbed != expected:
                    failures.append(
                        f"{incoming_source} -> {target_source}: erwartet absorbiert={expected}, erhalten {absorbed}"
                    )
    finally:
        conn.rollback()
        conn.close()

    for f in failures:
        print("FEHLER:", f)
    print("BESTANDEN" if not failures else f"{len(failures)} Fehler")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
