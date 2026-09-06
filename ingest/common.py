"""Gemeinsame Hilfsfunktionen fuer die Ingest-Skripte: DB-Verbindung,
Logging, import_run-Tracking (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt 4/6ff).

Die Skripte laufen gegen die bestehende Supabase-Postgres-Instanz dieses
Projekts (raw/core/enrich-Schemas, siehe
supabase/migrations/20260913000000_data_layer_schema.sql), NICHT gegen eine
separate Datenbank.
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import contextmanager
from typing import Iterator

# Patcht ssl/requests auf den System-Zertifikatsspeicher (Windows Certificate
# Store), sobald irgendein Modul dieses Pakets importiert wird -- sonst
# schlagen HTTPS-Anfragen (z. B. an die OCM-API) auf manchen Rechnern mit
# CERTIFICATE_VERIFY_FAILED fehl. Analog zu `NODE_OPTIONS=--use-system-ca`
# im Node-Teil dieses Projekts (siehe package.json). Muss vor jedem Import
# von `requests` passieren, daher hier an zentraler Stelle.
import pip_system_certs.wrapt_requests  # noqa: F401

import psycopg2

# Entspricht dem lokalen `supabase start`-Standardport (siehe
# `docker port supabase_db_eCamper` -> 5432/tcp -> 54322). Fuer eine
# Cloud-/andere Umgebung ueber DATABASE_URL ueberschreiben.
DEFAULT_DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"


def get_database_url() -> str:
    return os.environ.get("DATABASE_URL", DEFAULT_DATABASE_URL)


def get_connection():
    return psycopg2.connect(get_database_url())


def setup_logging() -> logging.Logger:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    return logging.getLogger("ingest")


@contextmanager
def import_run(conn, source: str, scope: str | None, notes: str | None = None) -> Iterator[tuple[int, dict]]:
    """Legt eine raw.import_run-Zeile an und schliesst sie am Ende mit
    Status ('ok'/'failed') und record_count ab. `state["record_count"]`
    im Block hochzaehlen, damit der Abschluss die echte Zahl schreibt.

    Ein Fehler im Block markiert den Lauf als 'failed' statt ihn auf
    'running' haengen zu lassen -- und wird danach weitergereicht (kein
    stilles Verschlucken)."""
    with conn.cursor() as cur:
        cur.execute(
            "insert into raw.import_run (source, scope, notes) values (%s, %s, %s) returning id",
            (source, scope, notes),
        )
        run_id = cur.fetchone()[0]
    conn.commit()

    state = {"record_count": 0}
    try:
        yield run_id, state
    except Exception:
        with conn.cursor() as cur:
            cur.execute(
                "update raw.import_run set status='failed', finished_at=now(), record_count=%s where id=%s",
                (state["record_count"], run_id),
            )
        conn.commit()
        raise
    else:
        with conn.cursor() as cur:
            cur.execute(
                "update raw.import_run set status='ok', finished_at=now(), record_count=%s where id=%s",
                (state["record_count"], run_id),
            )
        conn.commit()
