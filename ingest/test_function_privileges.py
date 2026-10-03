"""Sicherheits-Regressionstest fuer Funktionsrechte in core/enrich
(OPTIMIERUNG.md, Befunde S-4 und S-5).

Postgres vergibt EXECUTE auf neue Funktionen standardmaessig an PUBLIC.
core und enrich sind ueber PostgREST exponiert -- ohne ausdrueckliches
REVOKE ist jede Funktion mit dem oeffentlichen Anon-Key aufrufbar, auch
SECURITY-DEFINER-Funktionen ohne eigene Pruefung (z. B. enrich.
set_trailer_suitability mit p_origin='admin_override').

Prueft:
1. anon darf KEINE Funktion in core/enrich ausfuehren.
2. authenticated nur die Allow-Liste unten -- genau die RPCs, die App und
   Admin mit der Nutzer-Session aufrufen (alle anderen laufen ueber den
   Service-Role-Client). Jede davon prueft die Berechtigung selbst.
3. service_role darf alle Funktionen ausfuehren (Importer, Admin-Backend).
4. enrich.moderate_trailer_report lehnt einen eingeloggten Nicht-Admin ab
   (S-5: Pruefung war in 20261012000000 verloren gegangen).

Aufruf (lokale Docker-DB, siehe common.DEFAULT_DATABASE_URL):
    .venv/Scripts/python.exe test_function_privileges.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import sys

import psycopg2

from common import get_connection

AUTHENTICATED_ALLOWED = {
    "enrich.submit_trailer_report",
    "enrich.submit_campsite_charging",
    "enrich.moderate_trailer_report",
    "core.research_queue",
    "core.run_quality_checks",
}

PRIVILEGES_SQL = """
select n.nspname || '.' || p.proname,
       p.oid::regprocedure::text,
       has_function_privilege('anon', p.oid, 'execute'),
       has_function_privilege('authenticated', p.oid, 'execute'),
       has_function_privilege('service_role', p.oid, 'execute')
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
left join pg_depend d on d.objid = p.oid and d.deptype = 'e'
where n.nspname in ('core', 'enrich')
  and d.objid is null  -- Funktionen von Extensions (z. B. pg_trgm) ausnehmen
"""


def main() -> int:
    conn = get_connection()
    failures: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute(PRIVILEGES_SQL)
            for name, signature, anon, authenticated, service_role in cur.fetchall():
                if anon:
                    failures.append(f"anon darf {signature} ausfuehren")
                if authenticated and name not in AUTHENTICATED_ALLOWED:
                    failures.append(f"authenticated darf {signature} ausfuehren (nicht in Allow-Liste)")
                if not service_role:
                    failures.append(f"service_role darf {signature} NICHT ausfuehren")

            # S-5: eingeloggter Nicht-Admin (zufaellige uid ohne profiles-Zeile)
            cur.execute("set local role authenticated")
            cur.execute(
                "select set_config('request.jwt.claims', %s, true)",
                ('{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000f5"}',),
            )
            try:
                cur.execute("select enrich.moderate_trailer_report(-1, 'reject', null)")
                failures.append("moderate_trailer_report laeuft fuer Nicht-Admin durch")
            except psycopg2.Error as e:
                if "Admin" not in str(e):
                    failures.append(f"moderate_trailer_report: falsche Ablehnung fuer Nicht-Admin: {e}")
    finally:
        conn.rollback()
        conn.close()

    for f in failures:
        print("FEHLER:", f)
    print("BESTANDEN" if not failures else f"{len(failures)} Fehler")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
