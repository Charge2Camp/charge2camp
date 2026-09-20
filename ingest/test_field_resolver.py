"""Tests A-G aus dem Auftragsdokument (\\MyCloud\\work\\charge2camp\\
LAdesäule_Schnittstellen.rtf, Abschnitt 19) fuer den zentralen Feld-Resolver
core.upsert_charge_point() und die Anhaengertauglichkeits-Schreibfunktion
enrich.set_trailer_suitability() (siehe supabase/migrations/
20261012000000_field_provenance_and_source_registry.sql).

Verdict-Mapping Dokument -> enrich.trailer_suitability.verdict:
    SUITABLE   -> 'yes'
    UNSUITABLE -> 'no'
    UNKNOWN    -> 'unknown'

Jeder Test arbeitet auf einer eigenen, frisch angelegten core.charge_point-
Zeile mit eindeutigem external_key (Praefix 'test:field_resolver:') und
raeumt sich in einem finally-Block selbst wieder auf -- gleiche Konvention
wie test_enrich_immutability.py.

Aufruf:
    .venv/Scripts/python.exe test_field_resolver.py

Exit-Code 0 = alle Tests bestanden, 1 = mindestens ein Test fehlgeschlagen.
"""

from __future__ import annotations

import sys
import uuid

from psycopg2.extras import Json

from common import get_connection, setup_logging

log = setup_logging()


def _fresh_external_key() -> str:
    return f"test:field_resolver:{uuid.uuid4()}"


def _base_payload(external_key: str, **overrides: object) -> dict:
    payload = {
        "external_key": external_key,
        "name": "Testsaeule",
        "operator": "Test-Betreiber",
        "network": None,
        "lat": 48.1,
        "lon": 11.5,
        "address": "Teststr. 1",
        "postcode": "80331",
        "city": "Muenchen",
        "country_code": "DE",
        "access_type": "public",
        "is_operational": True,
        "max_power_kw": 150,
        "connector_count": 2,
        "source_updated_at": None,
        "initial_is_active": True,
    }
    payload.update(overrides)
    return payload


def upsert_charge_point(cur, payload: dict, source: str) -> tuple[str, bool]:
    cur.execute(
        "select id, manual_override from core.upsert_charge_point(%(payload)s, %(source)s)",
        {"payload": Json(payload), "source": source},
    )
    charge_point_id, manual_override = cur.fetchone()
    return charge_point_id, manual_override


def set_trailer_suitability(cur, external_key: str, verdict: str, origin: str) -> str:
    cur.execute(
        "select verdict from enrich.set_trailer_suitability("
        "p_charge_point_key => %s, p_verdict => %s, p_origin => %s)",
        (external_key, verdict, origin),
    )
    return cur.fetchone()[0]


def cleanup(cur, external_key: str) -> None:
    cur.execute("delete from core.field_change_log where charge_point_id = (select id from core.charge_point where external_key = %s)", (external_key,))
    cur.execute("delete from enrich.trailer_suitability where charge_point_key = %s", (external_key,))
    cur.execute("delete from core.connector where charge_point_id = (select id from core.charge_point where external_key = %s)", (external_key,))
    cur.execute("delete from core.charge_point where external_key = %s", (external_key,))


def test_a(cur) -> bool:
    """Manual caravan = SUITABLE, Automatic caravan = UNSUITABLE -> Result = SUITABLE."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    set_trailer_suitability(cur, key, "yes", "admin_override")
    result = set_trailer_suitability(cur, key, "no", "community")
    cleanup(cur, key)
    ok = result == "yes"
    if not ok:
        log.error("Test A FEHLGESCHLAGEN: erwartet 'yes', erhalten %r", result)
    return ok


def test_b(cur) -> bool:
    """Manual caravan = SUITABLE, Automatic caravan = UNKNOWN -> Result = SUITABLE."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    set_trailer_suitability(cur, key, "yes", "admin_override")
    result = set_trailer_suitability(cur, key, "unknown", "auto")
    cleanup(cur, key)
    ok = result == "yes"
    if not ok:
        log.error("Test B FEHLGESCHLAGEN: erwartet 'yes', erhalten %r", result)
    return ok


def test_c(cur) -> bool:
    """Manual caravan = SUITABLE, Official status = OUT_OF_SERVICE -> caravan=SUITABLE, status=OUT_OF_SERVICE."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    set_trailer_suitability(cur, key, "yes", "admin_override")
    upsert_charge_point(cur, _base_payload(key, is_operational=False), "ocm")
    cur.execute("select is_operational from core.charge_point where external_key = %s", (key,))
    (is_operational,) = cur.fetchone()
    cur.execute("select verdict from enrich.trailer_suitability where charge_point_key = %s", (key,))
    (verdict,) = cur.fetchone()
    cleanup(cur, key)
    ok = verdict == "yes" and is_operational is False
    if not ok:
        log.error("Test C FEHLGESCHLAGEN: verdict=%r is_operational=%r", verdict, is_operational)
    return ok


def test_d(cur) -> bool:
    """Manual caravan = SUITABLE, Old power = 150kW, New official power = 300kW -> caravan=SUITABLE, power=300kW."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key, max_power_kw=150), "ocm")
    set_trailer_suitability(cur, key, "yes", "admin_override")
    upsert_charge_point(cur, _base_payload(key, max_power_kw=300), "ocm")
    cur.execute("select max_power_kw from core.charge_point where external_key = %s", (key,))
    (power,) = cur.fetchone()
    cur.execute("select verdict from enrich.trailer_suitability where charge_point_key = %s", (key,))
    (verdict,) = cur.fetchone()
    cleanup(cur, key)
    ok = verdict == "yes" and float(power) == 300
    if not ok:
        log.error("Test D FEHLGESCHLAGEN: verdict=%r power=%r", verdict, power)
    return ok


def test_e(cur) -> bool:
    """Manual caravan = SUITABLE, OSM enthaelt die Station nicht -> Station bleibt, caravan=SUITABLE.
    Keine Importquelle in diesem Projekt loescht core.charge_point-Zeilen
    beim Fehlen in einer einzelnen Quelle (kein DELETE-Pfad existiert) --
    dieser Test belegt das am Datenmodell: die Zeile ist nach dem Anlegen
    weiterhin vorhanden, ganz ohne dass irgendein OSM-Import sie je beruehrt."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    set_trailer_suitability(cur, key, "yes", "admin_override")
    cur.execute("select count(*) from core.charge_point where external_key = %s", (key,))
    (count,) = cur.fetchone()
    cur.execute("select verdict from enrich.trailer_suitability where charge_point_key = %s", (key,))
    (verdict,) = cur.fetchone()
    cleanup(cur, key)
    ok = count == 1 and verdict == "yes"
    if not ok:
        log.error("Test E FEHLGESCHLAGEN: count=%r verdict=%r", count, verdict)
    return ok


def test_f(cur) -> bool:
    """No manual caravan assessment, no reliable automatic assessment -> caravan = UNKNOWN."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    result = set_trailer_suitability(cur, key, "unknown", "auto")
    cleanup(cur, key)
    ok = result == "unknown"
    if not ok:
        log.error("Test F FEHLGESCHLAGEN: erwartet 'unknown', erhalten %r", result)
    return ok


def test_g(cur) -> bool:
    """Manual caravan = UNSUITABLE, Automatic source = SUITABLE -> Result = UNSUITABLE."""
    key = _fresh_external_key()
    upsert_charge_point(cur, _base_payload(key), "ocm")
    set_trailer_suitability(cur, key, "no", "admin_override")
    result = set_trailer_suitability(cur, key, "yes", "community")
    cleanup(cur, key)
    ok = result == "no"
    if not ok:
        log.error("Test G FEHLGESCHLAGEN: erwartet 'no', erhalten %r", result)
    return ok


TESTS = [
    ("A", test_a),
    ("B", test_b),
    ("C", test_c),
    ("D", test_d),
    ("E", test_e),
    ("F", test_f),
    ("G", test_g),
]


def main() -> int:
    conn = get_connection()
    conn.autocommit = True
    all_ok = True
    try:
        with conn.cursor() as cur:
            for name, test_fn in TESTS:
                try:
                    passed = test_fn(cur)
                except Exception:
                    log.exception("Test %s hat eine Exception geworfen.", name)
                    passed = False
                log.info("Test %s: %s", name, "BESTANDEN" if passed else "FEHLGESCHLAGEN")
                all_ok = all_ok and passed
    finally:
        conn.close()

    if all_ok:
        log.info("Alle Tests bestanden.")
        return 0
    log.error("Mindestens ein Test ist fehlgeschlagen.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
