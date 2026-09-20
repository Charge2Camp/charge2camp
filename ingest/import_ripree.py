"""Ladesaeulen-Ingest vom spanischen RIPREE (Registro de Puntos de Recarga,
Ministerio para la Transicion Ecologica y el Reto Demografico, MITECO),
siehe \\MyCloud\\work\\charge2camp\\LAdesäule_Schnittstellen.rtf Abschnitt 1
(PRIORITAET 2 -- offizielle nationale Ladeinfrastrukturquelle) und
docs/data-sources.md.

Format der Exportdatei (empirisch aus einer echten, am 2026-09-20 vom
oeffentlichen MITECO-Export-Endpunkt geladenen Datei ermittelt, siehe
core.source_registry.api_information -- KEINE geratenen Spalten):
  - CSV, Trennzeichen ';', Kopfzeile in Zeile 1, keine Praeambel (anders als
    BNetzA). UTF-16LE OHNE BOM -- WICHTIG, das ist keine Standard-Kodierung
    fuer diese Art Export: die ersten Bytes sind "43 00 4F 00 4D 00 55 00"
    ("COMU..." mit je einem Nullbyte je ASCII-Zeichen), es fehlt aber das
    fuer UTF-16LE uebliche BOM (FF FE). `raw.decode("utf-16-le")` ohne
    vorherigen BOM-Strip ist deshalb richtig. Vorsicht beim manuellen
    Pruefen eines Sonderzeichens im Terminal: ein Terminal/Font kann ein
    korrekt decodiertes Zeichen (z. B. 'Ó', U+00D3, empirisch per ord()
    bestaetigt) trotzdem kaputt darstellen -- das ist ein reines
    Anzeigeproblem, kein Encoding-Fehler. Immer per ord() pruefen, nie nach
    Terminal-Optik urteilen.
  - Drei Spalten sind Excel-Style-Text-Escaped, um eine automatische
    Zahlkonvertierung durch Excel zu verhindern: LATITUD, LONGITUD,
    CODIGO POSTAL UND LOCALIZACION (letztere trotz Textinhalt wie
    "DESCONOCIDO" -- empirisch alle vier Spalten ueber 5000 Zeilen
    stichprobenartig als einzige betroffene Spalten bestaetigt). Format:
    `="39.5948000"` (Gleichheitszeichen, dann in Anfuehrungszeichen der
    Wert). csv.reader liefert wegen der aeusseren Anfuehrungszeichen den
    Wert bereits ohne die CSV-Quotierung, aber MIT dem technischen
    `="..."`-Rest -- `_strip_excel_text_wrapper()` entfernt genau das.
  - Eine Zeile = EIN Anschluss (ID. CONECTOR). Zeilen gruppieren sich ueber
    "COD. PUNTO DE RECARGA" zu Ladepunkten, und Ladepunkte gruppieren sich
    ueber "COD.INSTALACION" zu Installationen -- eine ZWEISTUFIGE
    Hierarchie, anders als BNetzA (flache 6er-Spaltengruppen) oder
    Frankreichs IRVE (eine Zeile = ein Ladepunkt). Empirisch bestaetigt
    (voller Dateiscan): 42.671 Anschlusszeilen -> 35.530 verschiedene
    Ladepunkte -> 12.031 verschiedene Installationen.
  - GRANULARITAETSENTSCHEIDUNG (bewusst, kein offensichtliches 1:1-Mapping):
    core.charge_point = eine Zeile je COD.INSTALACION (Installationsebene),
    NICHT je Ladepunkt. Alle anderen Quellen in diesem Projekt (BNetzA, OCM,
    IRVE) modellieren "Station" als core.charge_point-Einheit mit
    einzelnen Steckern als core.connector-Zeilen; RIPREEs "Installation"
    ist das naechstliegende Aequivalent zu "Station" (ein "Punto de
    Recarga" bei RIPREE entspricht eher dem, was andere Quellen einen
    einzelnen Ladepunkt/Pedestal nennen -- eine Gruppierung auf dieser
    Ebene wuerde Stationen in zu viele core.charge_point-Zeilen
    zersplittern, verglichen mit jeder anderen Quelle in diesem Projekt).
    Empirisch bestaetigt: alle Installationsfelder (NOMBRE INSTALACION,
    LATITUD, LONGITUD, DIRECCIÓN, CODIGO POSTAL, MUNICIPIO) sind innerhalb
    einer COD.INSTALACION-Gruppe ueber ALLE 12.031 Gruppen hinweg
    konsistent -- die Gruppierung ist also unproblematisch, keine
    widerspruechlichen Werte muessen aufgeloest werden. ALLE Anschlusszeilen
    unter einer COD.INSTALACION werden zu core.connector-Zeilen, unabhaengig
    davon, zu welchem COD. PUNTO DE RECARGA sie gehoeren.
  - "ID. CONECTOR" ist NICHT global eindeutig und auch keine stabile
    Kennung -- empirisch beobachtete Werte reichen von simplen Ziffern
    ("1", "2") ueber OCPI-aehnliche IDs ("ES*PGO*ECO00002*1") bis zu
    Freitext/Geraetebezeichnungen ("CIRCUTOR ePARK M-2S2 8.1."). Global
    eindeutig (empirisch: 42.671 von 42.671 Zeilen eindeutig) ist dagegen
    das Paar (COD. PUNTO DE RECARGA, ID. CONECTOR) -- wird NICHT als
    external_key verwendet (das ist COD.INSTALACION, siehe unten), aber als
    stabiler raw.charge_point-Bezug innerhalb des payload-Arrays genutzt.
  - external_key: f"ripree:{COD.INSTALACION}". COD.INSTALACION ist meist
    numerisch (z. B. "2023002088"), vereinzelt aber alphanumerisch (z. B.
    "WHLABVKER2AC4BYYIKQF") -- als Text behandeln, nie als int parsen.
  - raw.charge_point-GRANULARITAET: EIN raw.charge_point-Datensatz je
    COD.INSTALACION (source_id = COD.INSTALACION), payload = JSON-Array
    ALLER Roh-CSV-Zeilen dieser Installation (unveraendert, als dict je
    Zeile). Begruendung: raw.charge_point (source, source_id) PRIMARY KEY
    impliziert projektweit "eine Roh-Zeile je spaeterem core.charge_point"
    (siehe BNetzA/OCM: 1 CSV-Zeile = 1 Station = 1 raw-Zeile) -- dieselbe
    Konvention hier beizubehalten heisst, auf Installationsebene zu
    buendeln statt auf Anschlussebene, DAMIT raw.charge_point unabhaengig
    von der Quelle immer 1:1 zu core.charge_point steht. Kein Datenverlust:
    das JSON-Array haelt jede Roh-Zeile inklusive aller 27 Spalten
    vollstaendig fest, es wird nichts vor dem Speichern aggregiert.
  - POTENCIA MAXIMA: deutsches/spanisches Dezimalkomma PLUS Einheitensuffix
    ("350,00 kW") -- Suffix strippen, Komma->Punkt, dann float(). Nie leer
    (empirisch: 0 von 42.671 Zeilen leer).
  - max_power_kw/connector_count auf Installationsebene: max_power_kw =
    max(POTENCIA MAXIMA) ueber alle Anschlusszeilen der Installation,
    connector_count = Anzahl VERSCHIEDENER COD. PUNTO DE RECARGA (die
    Ladepunkt-, nicht die rohe Anschlusszeilenzahl -- analog dazu, wie
    BNetzA/OCM connector_count als Anzahl physischer Ladepunkte definieren,
    nicht als Anzahl Steckervarianten).
  - TIPO DE CARGA liefert AC_3_PHASE/AC_1_PHASE/DC direkt je Zeile -- wird
    bevorzugt gegenueber einer aus TIPO CONECTOR abgeleiteten AC/DC-Angabe
    verwendet (Kreuzauswertung ueber alle 42.671 Zeilen zeigt: ganz
    ueberwiegend konsistent mit dem Steckertyp, aber nicht zu 100% -- z. B.
    401 IEC_62196_T2-Zeilen mit TIPO DE CARGA=DC, vermutlich Meldefehler
    des Betreibers. Die Quellenangabe TIPO DE CARGA gewinnt trotzdem, weil
    sie die tatsaechlich vom Betreiber gemeldete Betriebsart ist, keine
    Vermutung von uns).
  - is_operational: RIPREE hat KEINE Echtzeit-/Betriebsstatus-Spalte -- das
    Register ist rein deklarativ vom Betreiber gemeldete Stammdaten, kein
    Live-Status. Immer true. (Diese Quelle kann is_operational also nie auf
    false setzen -- core.upsert_charge_point() uebernimmt eine gemeldete
    Nicht-Betriebsbereitschaft zwar IMMER auch unter manual_override, RIPREE
    liefert dieses Signal aber schlicht nie.)
  - ACCESIBILIDAD ist ENTGEGEN einer naheliegenden Vermutung NICHT das
    Signal fuer oeffentlich/privat, sondern fuer Barrierefreiheit
    (Zugaenglichkeit fuer Personen mit eingeschraenkter Mobilitaet) --
    Werte empirisch: NODISPONIBLE (38.455x, "nicht verfuegbar/unbekannt"),
    SI (3.823x), NO (393x). Eine derart dominante "unbekannt"-Verteilung
    passt nicht zu einem Kernfeld wie "oeffentlich zugaenglich", wohl aber
    zu einem oft nicht erfassten Zusatzmerkmal wie Barrierefreiheit. TIPOS
    DE SERVICIOS ist zu 89% leer und enthaelt Umgebungs-Tags
    (APARCAMIENTO/SUPERMERCADO/...), ebenfalls kein Zugriffssignal.
    access_type wird deshalb NICHT aus einer Zeilenspalte abgeleitet,
    sondern pauschal auf 'public' gesetzt -- gestuetzt auf: (1) RIPREE ist
    das gesetzlich vorgeschriebene staatliche Register fuer oeffentlich
    zugaengliche Ladeinfrastruktur (Real Decreto 29/2021 bzw. dessen
    Nachfolgeregelungen zur Meldepflicht "puntos de recarga de acceso
    publico"), analog zur Rolle von BNetzA in Deutschland; (2) METODOS DE
    PAGOS (Zahlungsmethoden) ist in KEINER der 42.671 Zeilen leer -- ein
    starkes indirektes Indiz fuer bezahlpflichtige, also oeffentlich
    nutzbare Infrastruktur, denn rein betriebsinterne/private Ladepunkte
    bräuchten keine dokumentierte Zahlungsmethode. Diese Herleitung ist
    plausibel, aber anders als bei BNetzA (expliziter Praeambeltext "nur
    oeffentlich zugaengliche Ladeeinrichtungen") NICHT durch einen
    woertlichen Quellentext in der Exportdatei selbst belegt -- vor einer
    produktiven Verwendung idealerweise gegen die MITECO-Registerordnung
    gegenpruefen.
  - Steckertyp-Rohwerte (TIPO CONECTOR, OCPI-Standardcodes) werden auf die
    im Projekt etablierten core.connector.standard-Werte abgebildet (siehe
    src/lib/connector-categories.ts und STECKERTYP_MAP unten). FORMATO
    (Socket/Cable) unterscheidet dabei wie bei BNetzA Steckdose vs. fest
    montierte Fahrzeugkupplung -- fuer IEC_62196_T2 empirisch beide Faelle
    haeufig (18.637 Socket / 8.559 Cable), deshalb zeilenweise nach FORMATO
    zwischen Type2_Socket und Type2 unterschieden statt pauschal einer
    Kategorie zugeordnet.
  - IEC_62196_T3A/IEC_62196_T3C sind der veraltete franzoesische
    "Type 3" (Scame)-Steckerstandard -- KEIN Type1/Type2, eigener String
    "Type3 (Scame)". IEC_60309_2_*: CEE-Industriesteckdosen, Varianten nach
    Phasenzahl/Amperage im Code (three_16/three_32 = 3-phasig 16A/32A,
    single_16 = 1-phasig 16A) unterschieden -- analog zu BNetzAs
    "CEE 3 Pin"/"CEE 5 Pin"-Konvention, aber mit expliziter Amperage-Angabe,
    da der RIPREE-Code sie hergibt. TeslaConnectorEurope -> "Tesla (Type 2
    DC)", identischer String wie BNetzAs "DC Tesla Fahrzeugkupplung (Typ
    2)"-Mapping (dieselbe physische Steckerform). DOMESTIC_F -> Schuko;
    DOMESTIC_A/DOMESTIC_E/DOMESTIC_L sind andere Haushaltssteckertypen
    (unterschiedliche Laender-/Steckernormen) und werden NICHT auf Schuko
    gezwungen, da elektrisch nicht bestaetigt identisch -- eigene,
    sprechende Strings. Ein unbekannter, zukuenftig neu auftauchender
    TIPO-CONECTOR-Rohwert wird unveraendert als standard gespeichert und
    gezaehlt (analog zum unknown:<id>-Fallback in import_ocm.py).

Nutzt DENSELBEN zentralen Resolver wie OCM/BNetzA (core.upsert_charge_point(),
siehe supabase/migrations/20261012000000_field_provenance_and_source_registry.sql)
-- keine eigene Merge-Logik.
"""

from __future__ import annotations

import argparse
import csv
import io
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from psycopg2.extras import Json, execute_batch

from common import find_and_absorb_nearby_duplicate, get_connection, import_run, setup_logging

# TIPO CONECTOR (OCPI-Standardcode) -> (core.connector.standard, current_type
# als Fallback, falls TIPO DE CARGA fuer eine Zeile fehlt). Siehe
# Moduldocstring fuer die Begruendung je Zeile.
STECKERTYP_MAP: dict[str, tuple[str, str]] = {
    "IEC_62196_T2_COMBO": ("CCS2", "DC"),
    "IEC_62196_T1_COMBO": ("CCS1", "DC"),
    "CHADEMO": ("CHAdeMO", "DC"),
    "DOMESTIC_F": ("Schuko", "AC"),
    "IEC_62196_T1": ("Type1", "AC"),
    "IEC_62196_T3A": ("Type3 (Scame)", "AC"),
    "IEC_62196_T3C": ("Type3 (Scame)", "AC"),
    "IEC_60309_2_three_32": ("CEE 3-phasig 32A", "AC"),
    "IEC_60309_2_three_16": ("CEE 3-phasig 16A", "AC"),
    "IEC_60309_2_single_16": ("CEE 1-phasig 16A", "AC"),
    "TeslaConnectorEurope": ("Tesla (Type 2 DC)", "DC"),
    "DOMESTIC_A": ("Domestic Typ A (ES)", "AC"),
    "DOMESTIC_E": ("Domestic Typ E (ES)", "AC"),
    "DOMESTIC_L": ("Domestic Typ L (ES)", "AC"),
}

# IEC_62196_T2 wird je Zeile nach FORMATO unterschieden (Socket/Cable), siehe
# Moduldocstring -- deshalb kein fester Eintrag in STECKERTYP_MAP.
T2_STANDARD_BY_FORMATO = {"Socket": "Type2_Socket", "Cable": "Type2"}

# TIPO DE CARGA-Rohwert -> core.connector.current_type.
TIPO_CARGA_MAP = {"AC_3_PHASE": "AC", "AC_1_PHASE": "AC", "DC": "DC"}

# Gleiches Prinzip wie NEARBY_MANUAL_RADIUS_M in import_bnetza.py: ein neu
# importierter RIPREE-Punkt in der Naehe einer bereits bestehenden
# Nicht-RIPREE-Station (z. B. 'admin_manual') wird trotzdem angelegt, aber
# inaktiv, damit er nicht als sichtbare Dublette auftaucht. Bei GENAU EINEM
# eindeutigen Treffer wird zusaetzlich automatisch max_power_kw/
# connector_count/is_operational + Anschluesse uebernommen, wenn RIPREE
# hoeher priorisiert ist als die Quelle des Treffers (siehe ingest/common.py
# find_and_absorb_nearby_duplicate()). In der Praxis hat OCM aktuell KEINE
# spanischen Ladepunkte (ES nicht in der Cron-Laenderrotation, siehe
# Rueckfrage in dieser Session) -- der Check greift also derzeit selten,
# bleibt aber fuer Konsistenz/Zukunftssicherheit (z. B. gegen
# admin_manual-Eintraege) erhalten.
NEARBY_MANUAL_RADIUS_M = 40


def _strip_excel_text_wrapper(value: str | None) -> str | None:
    """Entfernt das Excel-Text-Escaping `="..."` (siehe Moduldocstring) von
    LATITUD/LONGITUD/CODIGO POSTAL/LOCALIZACION. Andere Spalten sind nicht
    betroffen (empirisch ueber Stichproben bestaetigt) -- fuer sie ist dies
    ein No-Op."""
    if value is None:
        return None
    value = value.strip()
    if value.startswith('="') and value.endswith('"'):
        return value[2:-1]
    return value


def _parse_decimal(value: str | None) -> float | None:
    """Spanisches Dezimalkomma -> float. Leerstring/None -> None (nicht 0 --
    keine Scheindaten)."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    return float(value.replace(",", "."))


def _parse_power_kw(value: str | None) -> float | None:
    """POTENCIA MAXIMA hat zusaetzlich zum Dezimalkomma einen ' kW'-Suffix
    (z. B. "350,00 kW") -- vor _parse_decimal() strippen."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    value = value.removesuffix("kW").strip()
    return _parse_decimal(value)


def _parse_fecha(value: str | None) -> str | None:
    """FECHA DE ULTIMA MODIFICACION: 'DD/MM/YYYY HH:MM:SS' -> ISO-String
    fuer core.upsert_charge_point() (das die Spalte per ::timestamptz
    castet). None bei leerem/nicht parsbarem Wert statt eines Fehlers --
    das Feld ist nicht kritisch fuer den Import."""
    if not value or not value.strip():
        return None
    try:
        return datetime.strptime(value.strip(), "%d/%m/%Y %H:%M:%S").isoformat()
    except ValueError:
        return None


def _connector_standard(row: dict[str, str], unknown_counter: Counter) -> tuple[str, str | None]:
    """(standard, current_type-Fallback) fuer eine Anschlusszeile, bevor
    TIPO DE CARGA (siehe parse_connector_row()) current_type ggf.
    ueberschreibt."""
    tipo = row["TIPO CONECTOR"].strip()
    if tipo == "IEC_62196_T2":
        formato = row["FORMATO"].strip()
        return T2_STANDARD_BY_FORMATO.get(formato, "Type2"), "AC"
    mapped = STECKERTYP_MAP.get(tipo)
    if mapped:
        return mapped
    unknown_counter[tipo] += 1
    return tipo, None


def parse_connector_row(row: dict[str, str], unknown_counter: Counter) -> dict[str, Any]:
    """Eine core.connector-Zeile aus einer rohen CSV-Zeile. TIPO DE CARGA
    (direkte Betreiberangabe) hat Vorrang vor dem aus TIPO CONECTOR
    abgeleiteten current_type -- siehe Moduldocstring."""
    standard, fallback_current_type = _connector_standard(row, unknown_counter)
    current_type = TIPO_CARGA_MAP.get(row["TIPO DE CARGA"].strip(), fallback_current_type)
    return {
        "standard": standard,
        "power_kw": _parse_power_kw(row["POTENCIA MAXIMA"]),
        "current_type": current_type,
        "quantity": 1,
    }


def parse_installation(
    cod_instalacion: str, rows: list[dict[str, str]], unknown_counter: Counter
) -> dict[str, Any] | None:
    """Baut das core.upsert_charge_point-Payload fuer EINE Installation aus
    all ihren Anschlusszeilen (siehe Moduldocstring, Granularitaets-
    entscheidung). None = Installation muss uebersprungen werden (keine
    Koordinaten)."""
    first = rows[0]
    lat = _parse_decimal(_strip_excel_text_wrapper(first["LATITUD"]))
    lon = _parse_decimal(_strip_excel_text_wrapper(first["LONGITUD"]))
    if lat is None or lon is None:
        return None

    strasse = (first.get("DIRECCIÓN") or "").strip()
    address = strasse or None
    name = (first.get("NOMBRE INSTALACION") or "").strip() or None

    connectors = [parse_connector_row(r, unknown_counter) for r in rows]
    max_power_kw = max((c["power_kw"] for c in connectors if c["power_kw"] is not None), default=None)
    connector_count = len({r["COD. PUNTO DE RECARGA"] for r in rows})
    source_updated_at = max(
        (d for d in (_parse_fecha(r.get("FECHA DE ULTIMA MODIFICACION")) for r in rows) if d is not None),
        default=None,
    )

    return {
        "external_key": f"ripree:{cod_instalacion}",
        "name": name,
        "operator": (first.get("NOMBRE OPERADOR") or "").strip() or None,
        "network": None,  # RIPREE kennt kein separates Roaming-/Netzwerkfeld
        "lat": lat,
        "lon": lon,
        "address": address,
        "postcode": _strip_excel_text_wrapper(first.get("CODIGO POSTAL")) or None,
        "city": (first.get("MUNICIPIO") or "").strip() or None,
        "country_code": "ES",
        "access_type": "public",  # siehe Moduldocstring: kein Zeilensignal, aus Registerzweck + METODOS DE PAGOS hergeleitet
        "is_operational": True,  # RIPREE kennt keinen Echtzeit-/Betriebsstatus, siehe Moduldocstring
        "max_power_kw": max_power_kw,
        "connector_count": connector_count,
        "source_updated_at": source_updated_at,
        "_connectors": connectors,
    }


def load_installations(path: str) -> dict[str, list[dict[str, str]]]:
    """Liest die RIPREE-Exportdatei ein und gruppiert die Zeilen nach
    COD.INSTALACION (Reihenfolge des ersten Auftretens bleibt erhalten,
    damit ein --limit die ersten N Installationen der Datei nimmt, nicht
    eine zufaellige Teilmenge). Siehe Moduldocstring zur Kodierung."""
    raw = Path(path).read_bytes()
    text = raw.decode("utf-16-le")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")

    installations: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in reader:
        # Leere/kurze Zeilen ueberspringen (z. B. die abschliessende
        # Leerzeile am Dateiende, siehe empirische Pruefung).
        if not row or not any((v or "").strip() for v in row.values()):
            continue
        cod = (row.get("COD.INSTALACION") or "").strip()
        if not cod:
            continue
        installations[cod].append(row)
    return installations


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
        description="Ladesaeulen-Ingest vom spanischen RIPREE-Register (MITECO)."
    )
    parser.add_argument("--file", required=True, metavar="PATH", help="CSV-Exportdatei von RIPREE (UTF-16LE)")
    parser.add_argument(
        "--limit", type=int, default=None, metavar="N",
        help="Nur die ersten N Installationen verarbeiten (zum Testen, ohne separate Sample-Datei zu bauen)",
    )
    args = parser.parse_args()

    logger = setup_logging()

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"Datei nicht gefunden: {path}")

    installations = load_installations(args.file)
    logger.info("%d Installationen (aus %d Anschlusszeilen) aus %s gelesen.",
                len(installations), sum(len(v) for v in installations.values()), args.file)

    items = list(installations.items())
    if args.limit is not None:
        items = items[: args.limit]
        logger.info("--limit %d aktiv: verarbeite nur die ersten %d Installationen.", args.limit, len(items))

    unknown_connection_types: Counter = Counter()
    skipped_no_coords = 0
    near_manual_duplicates = 0
    near_manual_same_operator = 0
    absorbed_count = 0

    conn = get_connection()
    try:
        with import_run(conn, source="ripree", scope=f"file:{args.file}") as (run_id, state):
            with conn.cursor() as cur:
                for cod_instalacion, rows in items:
                    parsed = parse_installation(cod_instalacion, rows, unknown_connection_types)
                    if parsed is None:
                        skipped_no_coords += 1
                        continue

                    # raw.charge_point: EIN Datensatz je Installation, Payload =
                    # JSON-Array aller Roh-Anschlusszeilen dieser Installation
                    # (siehe Moduldocstring, raw.charge_point-Granularitaet).
                    cur.execute(
                        """
                        insert into raw.charge_point (source, source_id, import_run_id, payload, lat, lon)
                        values ('ripree', %s, %s, %s, %s, %s)
                        on conflict (source, source_id) do update set
                            import_run_id = excluded.import_run_id,
                            payload = excluded.payload,
                            lat = excluded.lat,
                            lon = excluded.lon,
                            fetched_at = now()
                        """,
                        (cod_instalacion, run_id, Json(rows), parsed["lat"], parsed["lon"]),
                    )

                    dup = find_and_absorb_nearby_duplicate(
                        cur,
                        source="ripree",
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
                        "select id, manual_override from core.upsert_charge_point(%(payload)s, 'ripree')",
                        {"payload": Json(payload)},
                    )
                    charge_point_id, manual_override = cur.fetchone()

                    # Bei fixierten Stationen (Admin-Korrektur) auch die
                    # Anschluesse unangetastet lassen -- gleiches Prinzip wie
                    # in import_ocm.py/import_bnetza.py replace_connectors().
                    if not manual_override:
                        replace_connectors(cur, charge_point_id, parsed["_connectors"])

                    state["record_count"] += 1

                # Quellenuebergreifend (nicht nur 'ocm'), siehe
                # supabase/migrations/
                # 20261013000000_fill_missing_trailer_suitability_any_source.sql.
                cur.execute("select core.fill_missing_trailer_suitability()")

                # Zusammenfassung fuer den Log -- gleiches Prinzip wie
                # import_bnetza.py main(): started_at kommt aus raw.import_run,
                # nicht aus einem lokalen Zeitstempel, damit die Grenze exakt
                # mit dem in import_run() angelegten Lauf uebereinstimmt.
                cur.execute("select started_at from raw.import_run where id = %s", (run_id,))
                run_started_at = cur.fetchone()[0]

                cur.execute(
                    "select count(*) from core.charge_point where source = 'ripree' and created_at >= %s",
                    (run_started_at,),
                )
                new_charge_point_count = cur.fetchone()[0]

                # distinct charge_point_id: core.upsert_charge_point() kann pro
                # Installation mehrere Feld-Konflikte gleichzeitig loggen --
                # das soll hier als EIN veraenderter Ladepunkt zaehlen.
                cur.execute(
                    """
                    select count(distinct charge_point_id)
                    from core.field_change_log
                    where action = 'applied' and incoming_source = 'ripree' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                changed_charge_point_count = cur.fetchone()[0]

                cur.execute(
                    """
                    select count(*)
                    from core.field_change_log
                    where action = 'rejected_by_manual_override' and incoming_source = 'ripree' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                rejected_change_count = cur.fetchone()[0]
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Installationen.", state["record_count"])
    logger.info(
        "Davon %d neu angelegt, %d bestehende mit mindestens einer geaenderten Spalte.",
        new_charge_point_count,
        changed_charge_point_count,
    )
    if rejected_change_count:
        logger.warning(
            "%d Feldaenderungen durch manual_override abgelehnt (Admin-Korrektur bleibt bestehen) -- "
            "siehe core.field_change_log.",
            rejected_change_count,
        )
    if skipped_no_coords:
        logger.warning("%d Installationen ohne Koordinaten uebersprungen.", skipped_no_coords)
    if unknown_connection_types:
        logger.warning("Unbekannte TIPO-CONECTOR-Rohwerte (Anzahl je Wert): %s", dict(unknown_connection_types))
    if near_manual_duplicates:
        logger.warning(
            "%d Installationen lagen beim Import innerhalb von %dm einer bereits bestehenden "
            "Nicht-RIPREE-Station -- als is_active=false gespeichert, siehe Admin-Dashboard "
            "'Moegliche Dubletten (Ladepunkte)' zur manuellen Pruefung/Zusammenfuehrung.",
            near_manual_duplicates,
            NEARBY_MANUAL_RADIUS_M,
        )
        if near_manual_same_operator:
            logger.warning(
                "Davon %d mit identischem Betreiber wie die bestehende Nicht-RIPREE-Station -- "
                "starkes Dublettensignal.",
                near_manual_same_operator,
            )
        if absorbed_count:
            logger.info(
                "%d davon eindeutig zugeordnet: Anschluesse/Ladeleistung/Betriebsbereitschaft der "
                "bestehenden (niedriger priorisierten) Station automatisch von RIPREE uebernommen, "
                "siehe core.field_change_log (action='applied_absorb_higher_priority').",
                absorbed_count,
            )


if __name__ == "__main__":
    main()
