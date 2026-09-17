"""Ladesaeulen-Ingest von Open Charge Map (Auftrag A, siehe
CLAUDE_CODE_AUFTRAG.md Abschnitt 6).

Zwei Modi:
  --api   Live-Abfrage gegen https://api.openchargemap.io/v3/poi.
          Liefert vollstaendig aufgeloeste Referenzdaten (Laendername,
          Betreiber, Steckertyp-Titel) -- die zuverlaessigste Quelle.
  --file  Liest eine Datei ODER ein Verzeichnis im Format des offiziellen
          Export-Repos github.com/openchargemap/ocm-export (dort eine
          JSON-Datei PRO Ladepunkt unter data/<ISO>/OCM-<id>.json).

WICHTIGE EINSCHRAENKUNG bei --file (beim Erstellen dieses Skripts empirisch
geprueft, weicht vom Auftragsdokument ab): Die Export-Dateien enthalten NUR
numerische Referenz-IDs (CountryID, UsageTypeID, ConnectionTypeID), keine
aufgeloesten Namen/Codes -- anders als die Live-API mit compact=false, die
genau das Format aus der Feldtabelle in Abschnitt 6 liefert. Ohne einen
gueltigen API-Key kann OCMs referencedata-Endpunkt (der diese IDs aufloesen
wuerde) nicht abgefragt werden -- er verlangt inzwischen ebenfalls einen Key.
Deshalb: `country_code` und `access_type` bleiben bei --file NULL, wenn nur
eine *_ID vorliegt (gezaehlt, nicht geraten -- keine Scheindaten). Mit
--api sind beide Felder immer zuverlaessig gefuellt.
"""

from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from pathlib import Path
from typing import Any

import requests
from psycopg2.extras import Json, execute_batch

from common import get_connection, import_run, setup_logging

# ConnectionType.ID -> (standard, current_type), siehe Auftragsdokument
# Abschnitt 6. Unbekannte IDs werden nicht geraten, sondern als
# "unknown:<id>" gespeichert und gezaehlt.
CONNECTION_TYPE_MAP: dict[int, tuple[str, str]] = {
    1: ("Type1", "AC"),
    2: ("CHAdeMO", "DC"),
    25: ("Type2", "AC"),
    28: ("Schuko", "AC"),
    32: ("CCS1", "DC"),
    33: ("CCS2", "DC"),
    1036: ("Type2_Socket", "AC"),
}

# CurrentTypeID-Fallback (stabil dokumentiert bei OCM), nur genutzt, wenn
# CONNECTION_TYPE_MAP keinen Stromtyp liefert: 10/20 = AC (ein-/dreiphasig),
# 30 = DC.
CURRENT_TYPE_BY_ID: dict[int, str] = {10: "AC", 20: "AC", 30: "DC"}

UPSERT_CORE_SQL = """
insert into core.charge_point (
    external_key, name, operator, network, geom, address, postcode, city,
    country_code, access_type, is_operational, max_power_kw, connector_count,
    source, source_updated_at, last_seen_at, updated_at, is_active
) values (
    %(external_key)s, %(name)s, %(operator)s, %(network)s,
    ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography,
    %(address)s, %(postcode)s, %(city)s, %(country_code)s, %(access_type)s,
    %(is_operational)s, %(max_power_kw)s, %(connector_count)s,
    'ocm', %(source_updated_at)s, now(), now(), %(initial_is_active)s
)
on conflict (external_key) do update set
    -- Von Haenden manuell im Admin-Bereich korrigierte Felder (siehe
    -- admin/.../ladestationen/[id]/actions.ts updateChargePoint) werden bei
    -- gesetztem manual_override NICHT mehr von OCM ueberschrieben --
    -- gleiches Prinzip wie is_active weiter unten. Ohne dieses Flag wuerde
    -- z.B. eine korrigierte "Ladenetz.de"->"Stadtwerke Muenchen"-Aenderung
    -- beim naechsten Reimport wieder verloren gehen (Nutzerfeedback).
    name = case when charge_point.manual_override then charge_point.name else excluded.name end,
    operator = case when charge_point.manual_override then charge_point.operator else excluded.operator end,
    network = excluded.network,
    geom = case when charge_point.manual_override then charge_point.geom else excluded.geom end,
    address = case when charge_point.manual_override then charge_point.address else excluded.address end,
    postcode = excluded.postcode,
    city = case when charge_point.manual_override then charge_point.city else excluded.city end,
    country_code = case when charge_point.manual_override then charge_point.country_code else excluded.country_code end,
    access_type = case when charge_point.manual_override then charge_point.access_type else excluded.access_type end,
    -- Ausnahme vom manual_override-Schutz: meldet OCM eine Saeule als NICHT
    -- betriebsbereit, wird das immer uebernommen, auch wenn ein Admin die
    -- Zeile fixiert hat. Datenqualitaet/Aktualitaet zu "ausser Betrieb" hat
    -- hier Vorrang vor dem sonst geltenden Schutz vor stillem Ueberschreiben
    -- (Nutzervorgabe) -- eine veraltete "betriebsbereit"-Korrektur soll
    -- Nutzer nicht zu einer defekten Saeule schicken. Meldet OCM dagegen
    -- (wieder) betriebsbereit, gilt der normale manual_override-Schutz
    -- weiter (kein automatisches "Reparieren" einer Admin-Korrektur in die
    -- andere Richtung).
    is_operational = case
        when not excluded.is_operational then false
        when charge_point.manual_override then charge_point.is_operational
        else excluded.is_operational
    end,
    max_power_kw = case when charge_point.manual_override then charge_point.max_power_kw else excluded.max_power_kw end,
    connector_count = case when charge_point.manual_override then charge_point.connector_count else excluded.connector_count end,
    source_updated_at = excluded.source_updated_at,
    last_seen_at = now(),
    updated_at = now()
    -- is_active bewusst NICHT in diesem UPDATE-Zweig: eine bereits
    -- bestehende Zeile (egal ob von einem Admin de-/reaktiviert, oder von
    -- der Dublettenpruefung unten inaktiv angelegt) behaelt ihren Status,
    -- ein erneuter Import soll das nicht ueberschreiben. Nur beim
    -- ERSTMALIGEN Insert (kein Conflict) greift %(initial_is_active)s.
returning id, manual_override
"""

# Nutzerwunsch (siehe Konversation "was passiert, wenn OCM eine Saeule
# listet, die ich bereits manuell eingetragen habe"): OCM-Importe pruefen
# jetzt VOR dem Insert, ob im Umkreis von NEARBY_MANUAL_RADIUS_M bereits ein
# Ladepunkt mit einer ANDEREN Quelle als 'ocm' existiert (typischerweise
# source='admin_manual', siehe admin/.../ladestationen/neu). Falls ja: der
# neue OCM-Datensatz wird trotzdem angelegt (echte OCM-Daten, nicht
# unterdruecken -- Prinzip "keine Scheindaten" gilt auch umgekehrt: OCM-Info
# nicht verschweigen), aber inaktiv (is_active=false), damit er nicht als
# Dublette auf der Karte auftaucht. Der Admin sieht beide Kandidaten dann
# im Dashboard-Check "Unplausible Koordinaten"/"Moegliche Dubletten" bzw.
# kann den neuen OCM-Datensatz manuell reaktivieren/zusammenfuehren
# (core.merge_charge_points, siehe supabase/migrations/
# 20260930020000_merge_duplicates.sql), falls die manuelle Station veraltet
# war. Kein automatisches, stilles Zusammenfuehren -- das bleibt eine
# Admin-Entscheidung.
NEARBY_MANUAL_RADIUS_M = 40

FIND_NEARBY_NON_OCM_SQL = """
select 1 from core.charge_point
where source <> 'ocm'
  and ST_DWithin(geom, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, %(radius)s)
limit 1
"""

FILL_MISSING_TRAILER_SUITABILITY_SQL = """
insert into enrich.trailer_suitability (charge_point_key, verdict, origin)
select cp.external_key, 'unknown', 'auto'
from core.charge_point cp
where cp.source = 'ocm'
  and not exists (
      select 1 from enrich.trailer_suitability ts
      where ts.charge_point_key = cp.external_key
  )
on conflict (charge_point_key) do nothing
"""


def parse_connection(raw_conn: dict[str, Any], unknown_counter: Counter) -> dict[str, Any]:
    connection_type = raw_conn.get("ConnectionType")
    if isinstance(connection_type, dict):
        type_id = connection_type.get("ID")
        title = connection_type.get("Title")
    else:
        type_id = raw_conn.get("ConnectionTypeID")
        title = None

    mapped = CONNECTION_TYPE_MAP.get(type_id)
    if mapped:
        standard, current_type = mapped
    else:
        standard = title or (f"unknown:{type_id}" if type_id is not None else "unknown")
        current_type = None
        unknown_counter[type_id] += 1

    if current_type is None:
        current_type = CURRENT_TYPE_BY_ID.get(raw_conn.get("CurrentTypeID"))

    return {
        "standard": standard,
        "power_kw": raw_conn.get("PowerKW"),
        "current_type": current_type,
        "quantity": raw_conn.get("Quantity") or 1,
    }


def parse_poi(poi: dict[str, Any]) -> dict[str, Any] | None:
    """None = Datensatz muss uebersprungen werden (keine ID oder keine
    Koordinaten), siehe Auftragsdokument Abschnitt 6 'Verhalten'."""
    ocm_id = poi.get("ID")
    address = poi.get("AddressInfo") or {}
    lat = address.get("Latitude")
    lon = address.get("Longitude")
    if ocm_id is None or lat is None or lon is None:
        return None

    country = address.get("Country")
    country_code = country.get("ISOCode") if isinstance(country, dict) else None

    operator_info = poi.get("OperatorInfo")
    operator = operator_info.get("Title") if isinstance(operator_info, dict) else None

    usage_type = poi.get("UsageType")
    access_type = None
    if isinstance(usage_type, dict):
        title = (usage_type.get("Title") or "").lower()
        if "private" in title:
            access_type = "private"
        elif "restricted" in title:
            access_type = "restricted"
        else:
            access_type = "public"

    status_type = poi.get("StatusType")
    if isinstance(status_type, dict) and status_type.get("IsOperational") is not None:
        is_operational = bool(status_type["IsOperational"])
    else:
        is_operational = True  # NULL -> betriebsbereit annehmen, siehe Auftrag

    connections = poi.get("Connections") or []
    power_values = [c.get("PowerKW") for c in connections if c.get("PowerKW") is not None]
    max_power_kw = max(power_values) if power_values else None
    connector_count = sum((c.get("Quantity") or 1) for c in connections)

    town = address.get("Town")
    address_line = ", ".join(
        x for x in (address.get("AddressLine1"), address.get("AddressLine2")) if x
    )

    return {
        "external_key": f"ocm:{ocm_id}",
        "name": address.get("Title"),
        "operator": operator,
        "network": operator,  # OCM liefert keinen separaten Netzwerk-Namen, siehe Auftrag
        "lat": lat,
        "lon": lon,
        "address": address_line or None,
        "postcode": address.get("Postcode"),
        "city": town.strip() if isinstance(town, str) else town,
        "country_code": country_code,
        "access_type": access_type,
        "is_operational": is_operational,
        "source_updated_at": poi.get("DateLastStatusUpdate"),
        "max_power_kw": max_power_kw,
        "connector_count": connector_count,
        "_ocm_id": ocm_id,
        "_connections": connections,
    }


def upsert_raw(cur, source_id: str, payload: dict, lat: float, lon: float, run_id: int) -> None:
    cur.execute(
        """
        insert into raw.charge_point (source, source_id, import_run_id, payload, lat, lon)
        values ('ocm', %s, %s, %s, %s, %s)
        on conflict (source, source_id) do update set
            import_run_id = excluded.import_run_id,
            payload = excluded.payload,
            lat = excluded.lat,
            lon = excluded.lon,
            fetched_at = now()
        """,
        (source_id, run_id, Json(payload), lat, lon),
    )


def replace_connectors(cur, charge_point_id: str, connections: list[dict], unknown_counter: Counter) -> None:
    cur.execute("delete from core.connector where charge_point_id = %s", (charge_point_id,))
    parsed = [parse_connection(c, unknown_counter) for c in connections]
    rows = [(charge_point_id, c["standard"], c["power_kw"], c["current_type"], c["quantity"]) for c in parsed]
    if rows:
        execute_batch(
            cur,
            """
            insert into core.connector (charge_point_id, standard, power_kw, current_type, quantity)
            values (%s, %s, %s, %s, %s)
            """,
            rows,
            page_size=500,
        )


def fetch_from_api(args: argparse.Namespace) -> list[dict]:
    key = args.key or os.environ.get("OCM_API_KEY") or os.environ.get("OPEN_CHARGE_MAP_API_KEY")
    if not key:
        raise SystemExit(
            "Kein API-Key gefunden. --key uebergeben oder OCM_API_KEY / "
            "OPEN_CHARGE_MAP_API_KEY setzen (kostenloser Key: openchargemap.org)."
        )
    params: dict[str, Any] = {
        "key": key,
        "maxresults": args.max_results,
        "compact": "false",
        "includecomments": "false",
    }
    if args.country:
        params["countrycode"] = args.country
    if args.bbox:
        min_lat, min_lon, max_lat, max_lon = (float(x) for x in args.bbox.split(","))
        params["boundingbox"] = f"({min_lat},{min_lon}),({max_lat},{max_lon})"

    response = requests.get("https://api.openchargemap.io/v3/poi", params=params, timeout=300)
    response.raise_for_status()
    return response.json()


def fetch_from_file(path: str) -> list[dict]:
    p = Path(path)
    if p.is_dir():
        pois = []
        for file in sorted(p.glob("**/*.json")):
            with file.open("r", encoding="utf-8") as f:
                pois.append(json.load(f))
        return pois
    with p.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else [data]


def main() -> None:
    parser = argparse.ArgumentParser(description="Ladesaeulen-Ingest von Open Charge Map (Auftrag A).")
    source_group = parser.add_mutually_exclusive_group(required=True)
    source_group.add_argument("--api", action="store_true", help="Live-Abfrage gegen api.openchargemap.io")
    source_group.add_argument("--file", metavar="PATH", help="JSON-Datei oder Verzeichnis (ocm-export-Format)")
    parser.add_argument("--bbox", metavar="minLat,minLon,maxLat,maxLon")
    parser.add_argument("--country", metavar="ISO2")
    parser.add_argument("--max-results", type=int, default=2000)
    parser.add_argument("--key", help="OCM-API-Key (sonst OCM_API_KEY/OPEN_CHARGE_MAP_API_KEY env)")
    args = parser.parse_args()

    logger = setup_logging()

    if args.api:
        pois = fetch_from_api(args)
        scope = f"bbox:{args.bbox}" if args.bbox else (f"country:{args.country}" if args.country else "unbounded")
    else:
        pois = fetch_from_file(args.file)
        scope = f"file:{args.file}"

    logger.info("%d Datensaetze von der Quelle erhalten (scope=%s)", len(pois), scope)

    unknown_connection_types: Counter = Counter()
    skipped_no_id_or_coords = 0
    missing_country_code = 0
    near_manual_duplicates = 0

    conn = get_connection()
    try:
        with import_run(conn, source="ocm", scope=scope) as (run_id, state):
            with conn.cursor() as cur:
                for poi in pois:
                    parsed = parse_poi(poi)
                    if parsed is None:
                        skipped_no_id_or_coords += 1
                        continue
                    if parsed["country_code"] is None:
                        missing_country_code += 1

                    upsert_raw(cur, str(parsed["_ocm_id"]), poi, parsed["lat"], parsed["lon"], run_id)

                    # Dublettenpruefung nur fuer NEUE core.charge_point-Zeilen
                    # relevant (ON CONFLICT ignoriert initial_is_active
                    # ohnehin, siehe Kommentar an UPSERT_CORE_SQL).
                    cur.execute(
                        FIND_NEARBY_NON_OCM_SQL,
                        {"lat": parsed["lat"], "lon": parsed["lon"], "radius": NEARBY_MANUAL_RADIUS_M},
                    )
                    has_nearby_manual = cur.fetchone() is not None
                    if has_nearby_manual:
                        near_manual_duplicates += 1
                    parsed["initial_is_active"] = not has_nearby_manual

                    cur.execute(UPSERT_CORE_SQL, parsed)
                    charge_point_id, manual_override = cur.fetchone()

                    # Bei fixierten Stationen (Admin-Korrektur, siehe
                    # manual_override-Kommentar oben) auch die Anschluesse
                    # unangetastet lassen -- replace_connectors loescht sonst
                    # ALLE bestehenden Zeilen und schreibt die OCM-Version
                    # neu, unabhaengig vom Stationsfeld-Schutz oben.
                    if not manual_override:
                        replace_connectors(cur, charge_point_id, parsed["_connections"], unknown_connection_types)

                    state["record_count"] += 1

                cur.execute(FILL_MISSING_TRAILER_SUITABILITY_SQL)
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Ladepunkte.", state["record_count"])
    if skipped_no_id_or_coords:
        logger.warning("%d Datensaetze ohne ID/Koordinaten uebersprungen.", skipped_no_id_or_coords)
    if missing_country_code:
        logger.warning(
            "%d Ladepunkte ohne aufloesbaren Laendercode gespeichert (country_code=NULL) -- "
            "typisch bei --file ohne Referenzdaten-Aufloesung, siehe Modulkommentar.",
            missing_country_code,
        )
    if unknown_connection_types:
        logger.warning("Unbekannte ConnectionType-IDs (Anzahl je ID): %s", dict(unknown_connection_types))
    if near_manual_duplicates:
        logger.warning(
            "%d Ladepunkte lagen beim (Erst-)Import innerhalb von %dm einer bereits bestehenden "
            "Nicht-OCM-Station (z. B. manuell angelegt) -- als is_active=false gespeichert, siehe "
            "Admin-Dashboard 'Moegliche Dubletten (Ladepunkte)' zur manuellen Pruefung/Zusammenfuehrung.",
            near_manual_duplicates,
            NEARBY_MANUAL_RADIUS_M,
        )


if __name__ == "__main__":
    main()
