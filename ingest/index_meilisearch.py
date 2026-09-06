"""Auftrag E -- Suchindex: liest core.campsite_search und schreibt den
Meilisearch-Index 'campsites' (siehe CLAUDE_CODE_AUFTRAG.md Abschnitt 10).

Abweichung vom Auftragsdokument (bewusst, siehe README): core.campsite_search
ist eine materialisierte Sicht ohne eigene updated_at-Spalte und wird als
Ganzes per `REFRESH MATERIALIZED VIEW CONCURRENTLY` aktualisiert (siehe
build_links.py) -- ein inkrementeller "nur Zeilen mit updated_at >
last_index_run"-Lauf ist auf so einer Sicht nicht sinnvoll nachbaubar, ohne
eine zusaetzliche Tracking-Spalte einzufuehren. Dieses Skript indiziert
deshalb bei jedem Lauf den kompletten aktuellen Stand der Sicht neu
(Meilisearch braucht dafuer bei ~4000 Dokumenten nur wenige Sekunden).

Aufruf:
    python ingest/index_meilisearch.py
"""

from __future__ import annotations

import os
from decimal import Decimal

import meilisearch
import psycopg2.extras

from common import get_connection, setup_logging

INDEX_NAME = "campsites"

FETCH_SQL = """
    select id, external_key, name, slug, country_code, city, website,
           lat, lon, amenities, charging_on_site, on_site_power_kw,
           pitch_charging, charging_type, charging_origin, nearest_walk_m,
           nearest_trailer_ok_m, nearby_max_power_kw, charge_points_walkable
    from core.campsite_search
"""


def get_client() -> meilisearch.Client:
    url = os.environ.get("MEILISEARCH_URL", "http://127.0.0.1:7700")
    key = os.environ.get("MEILI_MASTER_KEY")
    return meilisearch.Client(url, key)


def to_document(row: dict) -> dict:
    # psycopg2 liefert numeric-Spalten als Decimal -- JSON kennt das nicht.
    doc = {k: (float(v) if isinstance(v, Decimal) else v) for k, v in row.items()}
    # Meilisearch braucht eine Dokument-ID als "id" -- unsere UUID-Spalte
    # heisst schon so, aber Bindestriche sind darin erlaubt (anders als bei
    # rein numerischen/primaryKey-Konventionen anderer Suchmaschinen).
    doc["id"] = str(row["id"])
    lat, lon = doc.pop("lat"), doc.pop("lon")
    if lat is not None and lon is not None:
        doc["_geo"] = {"lat": lat, "lng": lon}
    return doc


def main() -> None:
    log = setup_logging()
    client = get_client()

    index = client.index(INDEX_NAME)
    index.update_filterable_attributes(
        [
            "amenities",
            "country_code",
            "charging_on_site",
            "pitch_charging",
            "nearest_walk_m",
            "nearest_trailer_ok_m",
            "nearby_max_power_kw",
            "_geo",
        ]
    )
    index.update_sortable_attributes(["name", "nearest_walk_m", "nearby_max_power_kw", "_geo"])
    index.update_searchable_attributes(["name", "city", "country_code"])

    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(FETCH_SQL)
            rows = cur.fetchall()
    finally:
        conn.close()

    documents = [to_document(dict(row)) for row in rows]
    log.info("%d Dokumente aus core.campsite_search gelesen.", len(documents))

    batch_size = 1000
    for i in range(0, len(documents), batch_size):
        batch = documents[i : i + batch_size]
        task = index.add_documents(batch, primary_key="id")
        client.wait_for_task(task.task_uid)
    log.info("Index '%s' aktualisiert: %d Dokumente.", INDEX_NAME, len(documents))


if __name__ == "__main__":
    main()
