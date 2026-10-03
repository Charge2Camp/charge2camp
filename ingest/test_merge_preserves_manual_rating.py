"""Harte Regel 1 (CLAUDE.md) beim Dubletten-Merge (OPTIMIERUNG.md, D-5):
core.merge_charge_points() darf eine manuelle Caravan-Bewertung
(enrich.trailer_suitability.manual_override = true) nie verwerfen und muss
sie samt Schutz-Flag auf die ueberlebende Zeile uebertragen. Alle
Auto-Merges (auto_merge_*, merge_exact_address_duplicates) laufen ueber
diese Funktion.

Faelle (keep = ueberlebende Zeile, remove = entfernte Zeile):
  a) keep automatisch "no",  remove manuell "yes"  -> manuell "yes" gewinnt
  b) keep manuell "no",      remove automatisch "yes" -> keep bleibt
  c) keep "unknown",         remove automatisch "yes" -> "yes" (wie bisher)
  d) keep ohne Bewertung,    remove manuell "yes"  -> manuell "yes"
  e) keep automatisch "yes", remove automatisch "no" -> keep bleibt (wie bisher)
  f) beide manuell: die zuletzt verifizierte Bewertung gewinnt

Laeuft komplett in einer Transaktion mit ROLLBACK.

Aufruf (lokale Docker-DB):
    .venv/Scripts/python.exe test_merge_preserves_manual_rating.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import sys

from common import get_connection

# (Fall, keep-Bewertung, remove-Bewertung, erwartet (verdict, manual_override, notes))
# Bewertung = (verdict, origin, manual_override, notes, verified_at) oder None
CASES = [
    ("a", ("no", "auto", False, "keep", None), ("yes", "admin_override", True, "remove", "2026-09-01"), ("yes", True, "remove")),
    ("b", ("no", "admin_override", True, "keep", "2026-09-01"), ("yes", "auto", False, "remove", None), ("no", True, "keep")),
    ("c", ("unknown", "auto", False, "keep", None), ("yes", "auto", False, "remove", None), ("yes", False, "remove")),
    ("d", None, ("yes", "admin_override", True, "remove", "2026-09-01"), ("yes", True, "remove")),
    ("e", ("yes", "auto", False, "keep", None), ("no", "auto", False, "remove", None), ("yes", False, "keep")),
    ("f", ("no", "admin_override", True, "keep", "2026-08-01"), ("yes", "admin_override", True, "remove", "2026-09-01"), ("yes", True, "remove")),
]

INSERT_CP = """
insert into core.charge_point (external_key, geom, source)
values (%s, 'SRID=4326;POINT(12 47.8)', %s) returning id
"""

INSERT_TS = """
insert into enrich.trailer_suitability (charge_point_key, verdict, origin, manual_override, notes, verified_at)
values (%s, %s, %s, %s, %s, %s)
"""


def main() -> int:
    conn = get_connection()
    failures: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute("select set_config('request.jwt.claims', '{\"role\":\"service_role\"}', true)")
            for case, keep_rating, remove_rating, expected in CASES:
                keep_key, remove_key = f"bnetza:test-merge-{case}", f"manual:test-merge-{case}"
                cur.execute(INSERT_CP, (keep_key, "bundesnetzagentur"))
                keep_id = cur.fetchone()[0]
                cur.execute(INSERT_CP, (remove_key, "admin_manual"))
                remove_id = cur.fetchone()[0]
                for key, rating in ((keep_key, keep_rating), (remove_key, remove_rating)):
                    if rating:
                        cur.execute(INSERT_TS, (key, *rating))

                cur.execute(
                    "select core.merge_charge_points(%s, %s, null, null, null, null, null, null, null, null, true)",
                    (keep_id, remove_id),
                )
                cur.execute(
                    "select verdict, manual_override, notes from enrich.trailer_suitability where charge_point_key = %s",
                    (keep_key,),
                )
                actual = cur.fetchone()
                if actual != expected:
                    failures.append(f"Fall {case}: erwartet {expected}, erhalten {actual}")
                cur.execute("select count(*) from enrich.trailer_suitability where charge_point_key = %s", (remove_key,))
                if cur.fetchone()[0] != 0:
                    failures.append(f"Fall {case}: Bewertung der entfernten Zeile nicht aufgeraeumt")
    finally:
        conn.rollback()
        conn.close()

    for f in failures:
        print("FEHLER:", f)
    print("BESTANDEN" if not failures else f"{len(failures)} Fehler")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
