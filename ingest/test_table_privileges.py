"""Sicherheits-Regressionstest fuer Tabellenrechte (OPTIMIERUNG.md, Befund S-3).

core, enrich und raw enthalten die Lade-/Campingplatz-Daten ("DNA" des
Produkts) und interne Protokolle. core/enrich sind ueber PostgREST
exponiert. Prueft:
1. Jede Tabelle in core/enrich/raw hat RLS aktiv (Absicherung, falls
   jemals ein Grant an anon/authenticated dazukommt).
2. anon hat auf KEINE Relation in core/enrich/raw irgendein Recht --
   auch nicht auf Views/Materialized Views (die kein RLS haben koennen).
3. authenticated nur die Allow-Liste unten (Nutzer-Meldungen und
   -Vorschlaege, jeweils mit RLS-Policies abgesichert).
4. Meldet als OFFEN (kein Fehlschlag), solange die PostGIS-Tabelle
   public.spatial_ref_sys fuer anon/authenticated beschreibbar ist --
   Befund S-6, nur durch supabase_admin (Supabase-Support) behebbar.

Aufruf (lokale Docker-DB, siehe common.DEFAULT_DATABASE_URL; fuer Prod
read-only per DATABASE_URL):
    .venv/Scripts/python.exe test_table_privileges.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import sys

from common import get_connection

PRIVILEGES = ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER")

AUTHENTICATED_ALLOWED = {
    "core.app_usage_event": {"INSERT"},
    "enrich.caravan_model_suggestion": {"INSERT", "SELECT"},
    "enrich.vehicle_model_suggestion": {"INSERT", "SELECT"},
    "enrich.missing_station_report": {"INSERT", "SELECT"},
    "enrich.trailer_report": {"SELECT"},
}

RELATIONS_SQL = """
select n.nspname || '.' || c.relname, c.relkind, c.relrowsecurity, c.oid
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname in ('core', 'enrich', 'raw')
  and c.relkind in ('r', 'p', 'v', 'm', 'f')
"""


def granted(cur, role: str, oid: int) -> set[str]:
    return {p for p in PRIVILEGES if _has(cur, role, oid, p)}


def _has(cur, role: str, oid: int, privilege: str) -> bool:
    cur.execute("select has_table_privilege(%s, %s::oid, %s)", (role, oid, privilege))
    return cur.fetchone()[0]


def main() -> int:
    conn = get_connection()
    failures: list[str] = []
    try:
        with conn.cursor() as cur:
            cur.execute(RELATIONS_SQL)
            for name, relkind, rls, oid in cur.fetchall():
                if relkind in ("r", "p") and not rls:
                    failures.append(f"RLS fehlt: {name}")
                anon = granted(cur, "anon", oid)
                if anon:
                    failures.append(f"anon hat {sorted(anon)} auf {name}")
                authenticated = granted(cur, "authenticated", oid)
                extra = authenticated - AUTHENTICATED_ALLOWED.get(name, set())
                if extra:
                    failures.append(f"authenticated hat {sorted(extra)} auf {name} (nicht in Allow-Liste)")

            cur.execute("select to_regclass('public.spatial_ref_sys')::oid")
            srs = cur.fetchone()[0]
            if srs is not None:
                for role in ("anon", "authenticated"):
                    writable = granted(cur, role, srs) & {"INSERT", "UPDATE", "DELETE", "TRUNCATE"}
                    if writable:
                        print(f"OFFEN (S-6): {role} darf public.spatial_ref_sys schreiben: {sorted(writable)}")
    finally:
        conn.rollback()
        conn.close()

    for f in failures:
        print("FEHLER:", f)
    print("BESTANDEN" if not failures else f"{len(failures)} Fehler")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
