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
from typing import Any, Callable, Iterator

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
            # core.source_registry.last_successful_import nachfuehren (siehe
            # supabase/migrations/
            # 20261012000000_field_provenance_and_source_registry.sql) --
            # kein Fehler, falls die Quelle dort noch nicht registriert ist
            # (z. B. kuenftige Importer vor ihrem ersten Registry-Eintrag).
            cur.execute(
                "update core.source_registry set last_successful_import = now() where source_id = %s",
                (source,),
            )
            # Nutzervorgabe (2026-09-23): Ladepunkte, die wegen zu geringer
            # Leistung deaktiviert wurden (core.
            # deactivate_insufficient_charging_stations(), siehe Migration
            # 20261024200000), sollen automatisch wieder aktiv werden,
            # sobald ein Reimport bessere Anschlussdaten liefert (>=11kW,
            # siehe 20261024210000). Zentral hier statt in jedem einzelnen
            # Importer, da alle vier (OCM/BNetzA/IRVE/RIPREE) durch dieses
            # import_run() laufen.
            cur.execute(
                "select core.reactivate_sufficiently_equipped_charge_points()",
            )
        conn.commit()


# Gemeinsame Nachbarschafts-/Uebernahme-Logik fuer alle nationalen Importer
# (import_bnetza.py, import_irve.py, import_ripree.py) -- siehe
# supabase/migrations/20261019000000_absorb_technical_fields_from_higher_priority.sql
# fuer die Begruendung und Schutzregeln. Zentral hier statt in jedem
# Importer kopiert, damit sich die Nutzervorgabe ("OCM-Daten werden bei
# Anschluessen/Ladeleistung/Betriebsbereitschaft immer von einer hoeher
# priorisierten Quelle ueberschrieben") an EINER Stelle aendern laesst.
NEARBY_DUPLICATE_RADIUS_M = 40

FIND_NEARBY_SQL = """
select id, source, manual_override, operator = %(operator)s as same_operator
from core.charge_point
where source <> %(source)s
  and ST_DWithin(geom, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, %(radius)s)
"""


def find_and_absorb_nearby_duplicate(
    cur,
    *,
    source: str,
    lat: float,
    lon: float,
    operator: str | None,
    max_power_kw: float | None,
    connector_count: int | None,
    is_operational: bool,
    connectors: list[dict[str, Any]],
    replace_connectors: Callable[[Any, str, list[dict[str, Any]]], None],
    radius: float = NEARBY_DUPLICATE_RADIUS_M,
) -> dict[str, Any]:
    """Sucht nach core.charge_point-Zeilen anderer Quellen im Umkreis von
    `radius` Metern. Bei GENAU EINEM Treffer (eindeutig) wird geprueft, ob
    die aktuelle Quelle laut core.source_registry eine hoehere Prioritaet
    hat als die Quelle des Treffers -- wenn ja UND der Treffer nicht
    manual_override=true ist, werden max_power_kw/connector_count/
    is_operational automatisch auf den Treffer uebernommen (core.
    absorb_technical_fields()) und dessen Anschluesse per `replace_connectors`
    ersetzt. Bei MEHREREN Treffern (mehrdeutig) findet KEINE automatische
    Uebernahme statt -- das bleibt bewusst eine Admin-Entscheidung ueber das
    Dubletten-Dashboard, genau wie bisher.

    Rueckgabe: {"initial_is_active": bool, "duplicate": bool,
    "same_operator": bool, "absorbed": bool, "ambiguous": bool} -- der
    Aufrufer setzt payload["initial_is_active"] auf den zurueckgegebenen
    Wert und zaehlt/loggt die uebrigen Felder wie bisher."""
    cur.execute(FIND_NEARBY_SQL, {"source": source, "lat": lat, "lon": lon, "radius": radius, "operator": operator})
    matches = cur.fetchall()

    if not matches:
        return {"initial_is_active": True, "duplicate": False, "same_operator": False, "absorbed": False, "ambiguous": False}

    same_operator = any(m[3] for m in matches)

    if len(matches) > 1:
        # Mehrdeutig -- mehrere Kandidaten in Reichweite, keine automatische
        # Zuordnung moeglich. Wie bisher: neue Zeile inaktiv anlegen, Admin
        # entscheidet im Dubletten-Dashboard.
        return {"initial_is_active": False, "duplicate": True, "same_operator": same_operator, "absorbed": False, "ambiguous": True}

    target_id, _target_source, target_manual_override, _same_operator = matches[0]
    absorbed = False
    if not target_manual_override:
        cur.execute(
            "select core.absorb_technical_fields(%s, %s, %s, %s, %s)",
            (target_id, source, max_power_kw, connector_count, is_operational),
        )
        absorbed = cur.fetchone()[0]
        if absorbed:
            replace_connectors(cur, target_id, connectors)

    return {"initial_is_active": False, "duplicate": True, "same_operator": same_operator, "absorbed": absorbed, "ambiguous": False}
