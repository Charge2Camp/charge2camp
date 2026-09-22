"""Ladesaeulen-Ingest von der Bundesnetzagentur (Ladesaeulenregister),
siehe \\MyCloud\\work\\charge2camp\\LAdesäule_Schnittstellen.rtf Abschnitt 1
(PRIORITAET 2 -- offizielle nationale Ladeinfrastrukturquelle) und
docs/data-sources.md.

Format der Exportdatei (empirisch aus einer echten BNetzA-Exportdatei
ermittelt, siehe Kommentare unten -- KEINE geratenen Spalten):
  - CSV, Trennzeichen ';', UTF-8 mit BOM (3 Bytes EF BB BF). Vorsicht bei
    einem manuellen Blick in die Datei: cp1252 kann dieselben Bytes OHNE
    Fehler decodieren, liefert dabei aber lautlos falsche Zeichen (jedes
    UTF-8-Mehrbyte-Zeichen wird als zwei cp1252-Zeichen zerlegt, z. B.
    "Längengrad" -> "Längengrad") -- das erste, was das Skript beim
    Parsen einer neuen Exportdatei probieren sollte, ist ein einzelnes
    Feld mit Umlaut auf Zeichen-Codepoints zu pruefen (ord()), nicht nur
    auf einen decode()-Fehler. Einzelne, uns nicht betreffende Spalten
    (Public Key1..6, OCPP-Zertifikatsdaten) enthalten vereinzelt Bytes,
    die auch in UTF-8 ungueltig sind -- deshalb `errors="replace"` beim
    Decodieren.
  - Die ersten 10 Zeilen sind Praeambel/Hinweistext + eine zweizeilige
    Kopfzeilengruppierung ("Allgemeine Informationen" / "1. Ladepunkt" /
    "2. Ladepunkt" / ...), die eigentliche Spaltenkopfzeile ist Zeile 11
    (Index 10), Daten ab Zeile 12.
  - Eine Zeile = eine "Ladeeinrichtung" (= unser core.charge_point), mit
    bis zu 6 Spaltengruppen (Steckertypen<N>, Nennleistung Stecker<N>,
    EVSE-ID<N>, Public Key<N>) fuer bis zu 6 "Ladepunkte" (= unsere
    core.connector-Zeilen). Innerhalb EINER Steckertypen<N>-Zelle koennen
    mehrere Typen durch "; " getrennt stehen (z. B. eine AC-Dose mit
    zusaetzlicher DC-Fahrzeugkupplung an derselben Position) -- das ist der
    tatsaechliche Wertevorrat, kein Sonderfall.
  - Breitengrad/Laengengrad und alle Nennleistungs-Felder verwenden
    deutsches Dezimalkomma ("48,442398"), keinen Punkt.
  - "Ladeeinrichtungs-ID" ist projektweit eindeutig (empirisch geprueft:
    keine Duplikate in einer echten Exportdatei) und stabil genug fuer
    external_key (Auftragsdokument Abschnitt 16, Matching-Stufe 1).
  - Das Register enthaelt laut eigenem Praeambeltext AUSSCHLIESSLICH
    "oeffentlich zugaengliche Ladeeinrichtungen" -- access_type='public'
    ist damit ein dokumentiertes Faktum der Quelle, keine Annahme.
  - "Status" hat in der Praxis (mindestens) die Werte 'In Betrieb' und
    'In Wartung'. Nur 'In Betrieb' wird als is_operational=true gewertet.
  - Steckertyp-Rohwerte (Auszug aus einer echten Datei) werden auf die im
    Projekt bereits etablierten core.connector.standard-Werte abgebildet
    (siehe src/lib/connector-categories.ts CONNECTOR_CATEGORIES fuer
    Type2/Type2_Socket/Type1/Schuko/CCS2/CHAdeMO/"CEE 3 Pin"/"CEE 5 Pin" --
    exakt dieselben Strings wie dort, damit der bestehende Steckertyp-Filter
    diese Ladepunkte sofort mit abdeckt). "DC Megawatt Charging System
    (MCS)" und "DC Tesla Fahrzeugkupplung (Typ 2)" sind neue, in
    connector-categories.ts noch NICHT kategorisierte Typen -- bewusst als
    eigene, sprechende Strings gespeichert statt in eine falsche
    Kategorie gezwungen (keine Scheindaten). Ein unbekannter, zukuenftig
    neu auftauchender Rohwert wird unveraendert als standard gespeichert
    und gezaehlt (analog zum unknown:<id>-Fallback in import_ocm.py).

Nutzt DENSELBEN zentralen Resolver wie OCM (core.upsert_charge_point(),
siehe supabase/migrations/20261012000000_field_provenance_and_source_registry.sql)
-- keine eigene Merge-Logik.

WICHTIG (Nutzerfeedback, siehe supabase/migrations/
20261019070000_consolidate_bnetza_same_location.sql): "Eine Zeile = eine
Ladeeinrichtung" (siehe oben) bedeutet NICHT "eine Zeile = ein physischer
Standort" -- ein Hub mit mehreren Saeulen erzeugt mehrere Zeilen mit exakt
identischen Koordinaten (empirisch bestaetigt: 11.984 von ca. 30.000
BNetzA-Standorten betreffen mehrere Zeilen). Damit core.charge_point wie bei
OCM eine Zeile PRO STANDORT bleibt (sonst gilt z. B. eine
Anhaengertauglichkeits-Pruefung nur fuer eine von mehreren Saeulen desselben
Hubs), werden Zeilen mit identischen Koordinaten VOR dem Upsert zu einem
einzigen Datensatz zusammengefuehrt (siehe _group_rows_by_location() unten)
-- external_key des Ergebnisses ist bevorzugt eine bereits in core.
charge_point bestehende Ladeeinrichtungs-ID der Gruppe, sonst die kleinste
(siehe _group_rows_by_location()-Docstring, warum "kleinste ID" allein
NICHT stabil ueber Reimporte ist).
"""

from __future__ import annotations

import argparse
import csv
import io
from collections import Counter
from pathlib import Path
from typing import Any

from psycopg2.extras import Json, execute_batch

from common import find_and_absorb_nearby_duplicate, get_connection, import_run, setup_logging

# Rohwert (nach Aufsplitten einer Steckertypen<N>-Zelle an "; ") ->
# (core.connector.standard, current_type). Siehe Moduldocstring.
STECKERTYP_MAP: dict[str, tuple[str, str]] = {
    "AC Typ 2 Steckdose": ("Type2_Socket", "AC"),
    "AC Typ 2 Fahrzeugkupplung": ("Type2", "AC"),
    "AC Typ 1 Steckdose": ("Type1", "AC"),
    "AC Schuko": ("Schuko", "AC"),
    "AC CEE 3-polig": ("CEE 3 Pin", "AC"),
    "AC CEE 5-polig": ("CEE 5 Pin", "AC"),
    "DC Fahrzeugkupplung Typ Combo 2 (CCS)": ("CCS2", "DC"),
    "DC CHAdeMO": ("CHAdeMO", "DC"),
    "DC Megawatt Charging System (MCS)": ("MCS", "DC"),
    "DC Tesla Fahrzeugkupplung (Typ 2)": ("Tesla (Type 2 DC)", "DC"),
}

# Anzahl Zeilen vor der eigentlichen Spaltenkopfzeile (Praeambel +
# zweizeilige Gruppierungskopfzeile "Allgemeine Informationen"/"1.
# Ladepunkt"/...) -- siehe Moduldocstring. Empirisch aus einer echten
# Exportdatei ermittelt, nicht dokumentiert von der Bundesnetzagentur.
HEADER_ROWS_BEFORE_COLUMNS = 10

# Ein neu importierter BNetzA-Punkt in der Naehe einer bereits bestehenden
# Nicht-BNetzA-Station wird trotzdem angelegt (echte Daten nicht
# unterdruecken), aber inaktiv, damit er nicht als sichtbare Dublette
# auftaucht. Bei GENAU EINEM eindeutigen Treffer wird zusaetzlich geprueft,
# ob BNetzA (priority=90) hoeher priorisiert ist als die Quelle des Treffers
# (typischerweise 'ocm', priority=40) -- wenn ja, werden max_power_kw/
# connector_count/is_operational UND die Anschluesse automatisch auf den
# Treffer uebernommen (Nutzervorgabe: BNetzA/nationale Quellen ueberschreiben
# OCM bei Anschluessen/Ladeleistung/Betriebsbereitschaft). Bei mehreren
# Kandidaten (mehrdeutig) findet KEINE automatische Uebernahme statt --
# Zusammenfuehrung bleibt dann eine Admin-Entscheidung
# (core.merge_charge_points). Siehe ingest/common.py
# find_and_absorb_nearby_duplicate() und supabase/migrations/
# 20261019000000_absorb_technical_fields_from_higher_priority.sql.
NEARBY_MANUAL_RADIUS_M = 40


def _parse_decimal(value: str | None) -> float | None:
    """Deutsches Dezimalkomma -> float. Leerstring/None -> None (nicht 0 --
    keine Scheindaten)."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return float(value.replace(",", "."))


def _parse_connectors(row: dict[str, str], unknown_counter: Counter) -> list[dict[str, Any]]:
    """Steckertypen<N> UND Nennleistung Stecker<N> sind beide parallele,
    mit '; ' getrennte Listen derselben Laenge (ein Ladepunkt kann mehrere
    physische Anschlussformen an derselben Position haben, z. B. zwei
    AC-Typ-2-Dosen mit je eigener Nennleistung "22; 22") -- KEIN einzelner
    Wert fuer die ganze Gruppe. Bei abweichender Elementanzahl (sollte laut
    Format nicht vorkommen) wird die kuerzere Liste nicht erfunden
    aufgefuellt -- ueberzaehlige Steckertypen bekommen power_kw=None."""
    connectors: list[dict[str, Any]] = []
    for i in range(1, 7):
        raw_types = (row.get(f"Steckertypen{i}") or "").strip()
        if not raw_types:
            continue
        tokens = [t.strip() for t in raw_types.split(";") if t.strip()]
        raw_powers = (row.get(f"Nennleistung Stecker{i}") or "").strip()
        powers = [p.strip() for p in raw_powers.split(";")] if raw_powers else []
        for idx, token in enumerate(tokens):
            power_kw = _parse_decimal(powers[idx]) if idx < len(powers) else None
            mapped = STECKERTYP_MAP.get(token)
            if mapped:
                standard, current_type = mapped
            else:
                standard, current_type = token, None
                unknown_counter[token] += 1
            connectors.append({
                "standard": standard,
                "power_kw": power_kw,
                "current_type": current_type,
                "quantity": 1,
            })
    return connectors


def parse_row(row: dict[str, str], unknown_counter: Counter) -> dict[str, Any] | None:
    """Analog zu parse_poi() in import_ocm.py -- baut das
    core.upsert_charge_point-Payload aus einer BNetzA-Zeile. None = Zeile
    muss uebersprungen werden (keine ID oder keine Koordinaten)."""
    reg_id = (row.get("Ladeeinrichtungs-ID") or "").strip()
    lat = _parse_decimal(row.get("Breitengrad"))
    lon = _parse_decimal(row.get("Längengrad"))
    if not reg_id or lat is None or lon is None:
        return None

    strasse = (row.get("Straße") or "").strip()
    hausnummer = (row.get("Hausnummer") or "").strip()
    address = " ".join(x for x in (strasse, hausnummer) if x) or None

    # Anzeigename (Karte) ist bei >50% der Zeilen leer (empirisch geprueft)
    # -- Betreiber ist dann der einzig sinnvolle Name, kein Rateversuch.
    name = (row.get("Anzeigename (Karte)") or "").strip() or (row.get("Betreiber") or "").strip() or None

    status = (row.get("Status") or "").strip()

    return {
        "external_key": f"bnetza:{reg_id}",
        "name": name,
        "operator": (row.get("Betreiber") or "").strip() or None,
        "network": None,  # BNetzA kennt kein separates Roaming-/Netzwerkfeld
        "lat": lat,
        "lon": lon,
        "address": address,
        "postcode": (row.get("Postleitzahl") or "").strip() or None,
        "city": (row.get("Ort") or "").strip() or None,
        "country_code": "DE",  # Register ist ausschliesslich Deutschland
        "access_type": "public",  # siehe Moduldocstring: Register erfasst nur oeffentliche Ladeeinrichtungen
        "is_operational": status == "In Betrieb",
        "max_power_kw": _parse_decimal(row.get("Nennleistung Ladeeinrichtung [kW]")),
        "connector_count": int(row["Anzahl Ladepunkte"]) if (row.get("Anzahl Ladepunkte") or "").strip() else None,
        "source_updated_at": None,  # siehe main(): wird pro Lauf einheitlich aus dem Dateikopf gesetzt
        "_connectors": _parse_connectors(row, unknown_counter),
    }


def _merge_connectors(connector_lists: list[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Fasst Anschluesse mehrerer Ladeeinrichtungen derselben Gruppe
    zusammen -- exakte Dopplungen (gleicher standard/power_kw/current_type)
    werden zu einer Zeile mit summierter quantity, analog zu
    core.merge_charge_points() (20260930020000)."""
    merged: dict[tuple[str, float | None, str | None], dict[str, Any]] = {}
    for connectors in connector_lists:
        for c in connectors:
            key = (c["standard"], c["power_kw"], c["current_type"])
            if key in merged:
                merged[key]["quantity"] += c["quantity"]
            else:
                merged[key] = dict(c)
    return list(merged.values())


def _location_group_sort_key(reg_id: str) -> tuple[int, int | str]:
    """Sortierschluessel fuer eine Ladeeinrichtungs-ID innerhalb einer
    Standort-Gruppe. Ladeeinrichtungs-IDs sind laut Moduldocstring
    projektweit eindeutig, aber NICHT dokumentiert als garantiert
    numerisch -- ein einzelner unerwarteter Rohwert (Formatwechsel bei
    BNetzA, Dateneingabefehler) durfte bisher wegen int() den kompletten
    Importlauf mit ValueError abbrechen. Numerische IDs sortieren weiterhin
    numerisch (unveraendertes Verhalten fuer den Normalfall), nicht-
    numerische IDs sortieren deterministisch dahinter, statt den Lauf zu
    beenden."""
    try:
        return (0, int(reg_id))
    except ValueError:
        return (1, reg_id)


def _group_rows_by_location(
    cur, parsed_rows: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """Fasst geparste Zeilen mit exakt identischen Koordinaten (= dieselbe
    physische Ladeeinrichtungs-Gruppe/derselbe Standort, siehe Moduldocstring)
    zu je einem core.upsert_charge_point-Payload zusammen.

    external_key des Ergebnisses: bevorzugt eine Ladeeinrichtungs-ID der
    Gruppe, die in core.charge_point (source='bundesnetzagentur') BEREITS
    existiert -- sonst (Erstimport der Gruppe) die kleinste ID. "Immer die
    kleinste ID" allein ist NICHT stabil ueber Reimporte: wird genau die
    zuvor kleinste Saeule eines Hubs stillgelegt und faellt aus einem
    spaeteren Export heraus, waere ohne diese Praeferenz die naechst-
    kleinere ID der neue external_key -- core.upsert_charge_point() wuerde
    dafuer eine NEUE core.charge_point-Zeile anlegen statt die bestehende
    zu aktualisieren, und die alte Zeile (mit ihren Bewertungen/
    Anhaengertauglichkeits-Pruefungen) bliebe als Karteileiche zurueck.

    max_power_kw = staerkster EINZELNER Anschluss der zusammengefassten
    Gruppe (Nutzervorgabe), nicht die Summe -- Fallback auf den rohen
    "Nennleistung Ladeeinrichtung"-Wert der gewaehlten Ueberlebenden-Zeile,
    falls kein Anschluss eine Nennleistung hat. connector_count = Anzahl der
    zusammengefassten (bereits deduplizierten) Anschluss-Zeilen."""
    groups: dict[tuple[float, float], list[dict[str, Any]]] = {}
    for row in parsed_rows:
        groups.setdefault((row["lat"], row["lon"]), []).append(row)

    all_keys = [row["external_key"] for row in parsed_rows]
    cur.execute(
        "select external_key from core.charge_point "
        "where source = 'bundesnetzagentur' and external_key = any(%s)",
        (all_keys,),
    )
    existing_keys = {r[0] for r in cur.fetchall()}

    merged_payloads: list[dict[str, Any]] = []
    for members in groups.values():
        members.sort(key=lambda r: _location_group_sort_key(r["external_key"].removeprefix("bnetza:")))
        existing_members = [m for m in members if m["external_key"] in existing_keys]
        survivor = existing_members[0] if existing_members else members[0]
        connectors = _merge_connectors([m["_connectors"] for m in members])
        connector_powers = [c["power_kw"] for c in connectors if c["power_kw"] is not None]

        payload = dict(survivor)
        payload["_connectors"] = connectors
        # sum(quantity), nicht len(connectors) -- Anzahl PHYSISCHER
        # Anschluesse, nicht Anzahl unterschiedlicher Anschluss-Spezifikationen
        # (analog core.merge_charge_points(), 20260930020000).
        payload["connector_count"] = sum(c["quantity"] for c in connectors) or None
        payload["max_power_kw"] = max(connector_powers) if connector_powers else survivor["max_power_kw"]
        payload["is_operational"] = any(m["is_operational"] for m in members)
        merged_payloads.append(payload)

    return merged_payloads


def load_rows(path: str) -> tuple[list[dict[str, str]], str | None]:
    """Liest die BNetzA-Exportdatei ein und gibt (Datenzeilen als dicts,
    'Letzte Aktualisierung vom:'-Datum aus der Praeambel) zurueck. Siehe
    Moduldocstring zur Kodierung/Zeilenstruktur."""
    raw = Path(path).read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
    text = raw.decode("utf-8", errors="replace")

    stand_datum = None
    lines_iter = io.StringIO(text)
    preamble_lines = []
    for _ in range(HEADER_ROWS_BEFORE_COLUMNS):
        line = next(lines_iter, "")
        preamble_lines.append(line)
        if line.startswith("Letzte Aktualisierung vom:"):
            stand_datum = line.split(":", 1)[1].strip().rstrip(";").strip()

    reader = csv.DictReader(lines_iter, delimiter=";")
    rows = list(reader)
    return rows, stand_datum


def replace_connectors(cur, charge_point_id: str, connectors: list[dict[str, Any]]) -> None:
    cur.execute("delete from core.connector where charge_point_id = %s", (charge_point_id,))
    if connectors:
        execute_batch(
            cur,
            """
            insert into core.connector (charge_point_id, standard, power_kw, current_type, quantity)
            values (%s, %s, %s, %s, %s)
            """,
            [(charge_point_id, c["standard"], c["power_kw"], c["current_type"], c["quantity"]) for c in connectors],
            page_size=500,
        )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ladesaeulen-Ingest vom Bundesnetzagentur-Ladesaeulenregister."
    )
    parser.add_argument("--file", required=True, metavar="PATH", help="CSV-Exportdatei des Ladesaeulenregisters")
    args = parser.parse_args()

    logger = setup_logging()

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"Datei nicht gefunden: {path}")

    rows, stand_datum = load_rows(args.file)
    logger.info("%d Datensaetze aus %s gelesen (Stand laut Datei: %s).", len(rows), args.file, stand_datum)

    unknown_connection_types: Counter = Counter()
    skipped_no_id_or_coords = 0
    near_manual_duplicates = 0
    near_manual_same_operator = 0
    absorbed_count = 0
    merged_row_count = 0

    conn = get_connection()
    try:
        with import_run(conn, source="bundesnetzagentur", scope=f"file:{args.file}") as (run_id, state):
            with conn.cursor() as cur:
                # Pass 1: JEDE Rohzeile wird archiviert (raw.charge_point
                # bleibt 1:1 zur Exportdatei, unabhaengig von der
                # Standort-Gruppierung unten) -- siehe Moduldocstring.
                parsed_rows: list[dict[str, Any]] = []
                for row in rows:
                    parsed = parse_row(row, unknown_connection_types)
                    if parsed is None:
                        skipped_no_id_or_coords += 1
                        continue
                    parsed["source_updated_at"] = stand_datum
                    parsed_rows.append(parsed)

                    reg_id = parsed["external_key"].removeprefix("bnetza:")
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
                        (reg_id, run_id, Json(row), parsed["lat"], parsed["lon"]),
                    )

                # Pass 2: nach Standort (identische Koordinaten) gruppiert --
                # core.charge_point bekommt eine Zeile PRO STANDORT, nicht
                # pro Ladeeinrichtung (siehe Moduldocstring/
                # _group_rows_by_location()).
                location_groups = _group_rows_by_location(cur, parsed_rows)
                for parsed in location_groups:
                    dup = find_and_absorb_nearby_duplicate(
                        cur,
                        source="bundesnetzagentur",
                        lat=parsed["lat"],
                        lon=parsed["lon"],
                        operator=parsed["operator"],
                        max_power_kw=parsed["max_power_kw"],
                        connector_count=parsed["connector_count"],
                        is_operational=parsed["is_operational"],
                        connectors=parsed["_connectors"],
                        replace_connectors=replace_connectors,
                        radius=NEARBY_MANUAL_RADIUS_M,
                    )
                    if dup["duplicate"]:
                        near_manual_duplicates += 1
                        if dup["same_operator"]:
                            near_manual_same_operator += 1
                        if dup["absorbed"]:
                            absorbed_count += 1
                    parsed["initial_is_active"] = dup["initial_is_active"]

                    payload = {k: v for k, v in parsed.items() if not k.startswith("_")}
                    cur.execute(
                        "select id, manual_override from core.upsert_charge_point(%(payload)s, 'bundesnetzagentur')",
                        {"payload": Json(payload)},
                    )
                    charge_point_id, manual_override = cur.fetchone()

                    # Bei fixierten Stationen (Admin-Korrektur) auch die
                    # Anschluesse unangetastet lassen -- gleiches Prinzip wie
                    # in import_ocm.py replace_connectors().
                    if not manual_override:
                        replace_connectors(cur, charge_point_id, parsed["_connectors"])

                    state["record_count"] += 1

                merged_row_count = len(parsed_rows) - len(location_groups)

                # Quellenuebergreifend (nicht nur 'ocm'), siehe
                # supabase/migrations/
                # 20261013000000_fill_missing_trailer_suitability_any_source.sql.
                cur.execute("select core.fill_missing_trailer_suitability()")

                # Zusammenfassung fuer den Log: "Verarbeitet" (unten) zaehlt nur
                # geparste Zeilen, sagt aber nichts darueber aus, ob dieser Lauf
                # tatsaechlich etwas veraendert hat -- core.upsert_charge_point()
                # ist idempotent, ein Re-Import derselben Datei "verarbeitet"
                # also genauso viele Zeilen wie der Erstimport, obwohl nichts
                # Neues passiert. started_at kommt aus raw.import_run statt aus
                # einem lokalen "jetzt zu Laufbeginn"-Zeitstempel, damit die
                # Grenze exakt mit dem in import_run() angelegten Lauf
                # uebereinstimmt (inkl. der Zeit, die load_rows() zum
                # CSV-Einlesen vor dem ersten Insert braucht).
                cur.execute("select started_at from raw.import_run where id = %s", (run_id,))
                run_started_at = cur.fetchone()[0]

                cur.execute(
                    "select count(*) from core.charge_point where source = 'bundesnetzagentur' and created_at >= %s",
                    (run_started_at,),
                )
                new_charge_point_count = cur.fetchone()[0]

                # distinct charge_point_id: core.upsert_charge_point() kann pro
                # Zeile mehrere Feld-Konflikte gleichzeitig loggen (z. B. name
                # UND address geaendert) -- das soll hier als EIN veraenderter
                # Ladepunkt zaehlen, nicht als mehrere.
                cur.execute(
                    """
                    select count(distinct charge_point_id)
                    from core.field_change_log
                    where action = 'applied' and incoming_source = 'bundesnetzagentur' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                changed_charge_point_count = cur.fetchone()[0]

                cur.execute(
                    """
                    select count(*)
                    from core.field_change_log
                    where action = 'rejected_by_manual_override' and incoming_source = 'bundesnetzagentur' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                rejected_change_count = cur.fetchone()[0]
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Ladepunkte.", state["record_count"])
    logger.info(
        "Davon %d neu angelegt, %d bestehende mit mindestens einer geaenderten Spalte.",
        new_charge_point_count,
        changed_charge_point_count,
    )
    if merged_row_count:
        logger.info(
            "%d Ladeeinrichtungs-Zeilen der Exportdatei wurden mit mindestens einer weiteren Zeile "
            "am selben Standort (identische Koordinaten) zu einem core.charge_point zusammengefasst "
            "(siehe Moduldocstring/_group_rows_by_location()).",
            merged_row_count,
        )
    if rejected_change_count:
        logger.warning(
            "%d Feldaenderungen durch manual_override abgelehnt (Admin-Korrektur bleibt bestehen) -- "
            "siehe core.field_change_log.",
            rejected_change_count,
        )
    if skipped_no_id_or_coords:
        logger.warning("%d Datensaetze ohne ID/Koordinaten uebersprungen.", skipped_no_id_or_coords)
    if unknown_connection_types:
        logger.warning("Unbekannte Steckertypen-Rohwerte (Anzahl je Wert): %s", dict(unknown_connection_types))
    if near_manual_duplicates:
        logger.warning(
            "%d Ladepunkte lagen beim Import innerhalb von %dm einer bereits bestehenden "
            "Nicht-BNetzA-Station -- als is_active=false gespeichert, siehe Admin-Dashboard "
            "'Moegliche Dubletten (Ladepunkte)' zur manuellen Pruefung/Zusammenfuehrung.",
            near_manual_duplicates,
            NEARBY_MANUAL_RADIUS_M,
        )
        if near_manual_same_operator:
            logger.warning(
                "Davon %d mit identischem Betreiber wie die bestehende Nicht-BNetzA-Station -- "
                "starkes Dublettensignal.",
                near_manual_same_operator,
            )
        if absorbed_count:
            logger.info(
                "%d davon eindeutig zugeordnet: Anschluesse/Ladeleistung/Betriebsbereitschaft der "
                "bestehenden (niedriger priorisierten) Station automatisch von BNetzA uebernommen, "
                "siehe core.field_change_log (action='applied_absorb_higher_priority').",
                absorbed_count,
            )


if __name__ == "__main__":
    main()
