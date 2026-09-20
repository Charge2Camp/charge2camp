"""Ladesaeulen-Ingest von der franzoesischen Base Nationale des IRVE
(Infrastructures de Recharge pour Vehicules Electriques),
siehe \\MyCloud\\work\\charge2camp\\LAdesäule_Schnittstellen.rtf Abschnitt 1
(PRIORITAET 2 -- offizielle nationale Ladeinfrastrukturquelle) und
docs/data-sources.md.

Im Gegensatz zu BNetzA (siehe import_bnetza.py) ist diese Quelle sehr gut
dokumentiert: offizielles Schema unter
https://schema.data.gouv.fr/etalab/schema-irve-statique/2.3.1/. Trotzdem
weicht die REALE Exportdatei (223.126 Zeilen, empirisch geprueft, siehe
Kommentare unten -- KEINE geratenen Spalten) an mehreren Stellen vom
sauberen Idealbild des Schemas ab:

  - CSV, Trennzeichen ',', UTF-8 OHNE BOM, eine echte Kopfzeile (Zeile 1),
    keine Praeambel wie bei BNetzA.
  - Die Datei enthaelt zusaetzlich 12 vom Aggregator (transport.data.gouv.fr)
    angehaengte "consolidated_*"/Metadaten-Spalten, die NICHT Teil des
    Basisschemas sind (last_modified, datagouv_dataset_id,
    datagouv_resource_id, datagouv_organization_or_owner, created_at,
    consolidated_longitude, consolidated_latitude, consolidated_code_postal,
    consolidated_commune, consolidated_is_lon_lat_correct,
    consolidated_is_code_insee_verified, consolidated_is_code_insee_modified).
    consolidated_longitude/latitude weichen empirisch NIE (>0,01 Grad) von
    coordonneesXY ab -- deshalb wird bewusst weiterhin coordonneesXY (das
    Basisschema-Feld, garantiert auch in kuenftigen/anderen Exports vorhanden)
    als primaere Koordinatenquelle verwendet, nicht die aggregatorspezifische
    Zusatzspalte.
  - EINE CSV-Zeile = EIN Ladepunkt (id_pdc_itinerance), NICHT eine Station.
    Mehrere Zeilen teilen sich dieselbe id_station_itinerance/nom_station/
    coordonneesXY -- das ist unsere core.charge_point-Ebene, jede Zeile wird
    zu einer core.connector-Zeile darunter (kein Un-Nesting noetig wie bei
    BNetzA, IRVE liefert bereits einen flachen Ladepunkt pro Zeile).
  - Die booleschen prise_type_*-Spalten sind UNEINHEITLICH geschrieben:
    "True"/"true"/"TRUE" bzw. "False"/"false"/"FALSE" UND vereinzelt "1"/"0"
    (numerisch) kommen alle im selben Datensatz vor -- Parsing MUSS
    case-insensitiv sein und "1" als wahr akzeptieren, ein reiner
    strip()=="TRUE"-Vergleich (wie bei BNetzA unnoetig, dort sauber "; "-
    getrennt) wuerde ca. zwei Drittel der wahren Werte verschlucken.
  - condition_acces enthaelt bei ca. 0,8% der Zeilen (1.797 von 223.125,
    empirisch gezaehlt) kaputt kodierte Varianten von "Accès libre"/"Accès
    réservé" (z. B. "Accčs libre", "Acc\x8fs libre", "AccĶs libre") -- die
    Datei selbst dekodiert sauber und vollstaendig als UTF-8 (kein
    Decode-Fehler), das ist also KEIN Encoding-Bug dieses Skripts (anders als
    der cp1252-vs-UTF-8-Fall bei BNetzA), sondern ein Datenqualitaetsproblem
    beim Aggregator (vermutlich aus verschieden falsch dekodierten
    Rohdaten mehrerer Betreiber zusammengefuehrt). Robuste Erkennung deshalb
    NICHT per exaktem String-Vergleich, sondern per ASCII-sicherem
    Teilstring ("libre" bzw. "serv" -- beide Fragmente sind in JEDER
    beobachteten kaputten Variante intakt, nur die accentuierten Zeichen
    sind betroffen).
  - puissance_nominale nutzt (anders als BNetzA) einen Punkt als
    Dezimaltrennzeichen, keine Lokalisierung noetig -- ABER enthaelt bei 92
    von 223.125 Zeilen (0,04%) eindeutig unplausible Werte (1200 bis 160.000
    kW -- kein realer Ladepunkt, Dateneingabefehler in der Quelle). Ohne
    Pruefung wuerde EINER dieser Werte (>9999,99) den GESAMTEN Lauf mit einem
    numeric(6,2)-Overflow abbrechen (core.connector.power_kw UND
    core.charge_point.max_power_kw sind numeric(6,2), siehe
    supabase/migrations/20260909011000_data_layer_schema.sql) -- deshalb
    filtert _sane_power_kw() Werte ueber PLAUSIBLE_MAX_POWER_KW (1000 kW,
    grosszuegig ueber allen real verbauten Ladepunkten) heraus und speichert
    NULL statt eines erfundenen/gekappten Ersatzwerts, gezaehlt und geloggt.
  - coordonneesXY ist ein String "[lon, lat]" (JSON-Array, empirisch: IMMER
    wohlgeformt, 0 von 223.125 Zeilen ohne eckige Klammern) -- per
    json.loads geparst.
  - id_station_itinerance ist laut Schema bei Stationen aus der Zeit vor der
    ID-Vergabeverordnung "Non concerné" (kein Platzhalter-Sonderfall,
    sondern dokumentiertes Verhalten) -- empirisch 1.192 von 223.125 Zeilen
    (0,53%). Davon haben 1.063 Zeilen AUCH ein leeres id_station_local,
    d. h. der im Auftrag vorgeschlagene Fallback auf id_station_local greift
    nur bei einer Minderheit (129 Zeilen, 112 verschiedene Werte). Fuer den
    Rest wird der Stationsschluessel aus gerundeten Koordinaten + Stations-
    name gebildet (siehe compute_station_key()) -- ein bewusster Kompromiss:
    Kollisionsrisiko ist vernachlaessigbar (Koordinaten auf 6 Nachkommastellen
    = sub-Meter-Genauigkeit UND identischer Name muessten zusammentreffen),
    besser als leere/kollidierende external_keys oder ein stillschweigendes
    Verwerfen von 0,5% echter Ladepunkte.
  - nbre_pdc (deklarierte Ladepunktzahl der Station) stimmt bei 2.742 von
    54.352 Stationen (5,0%) NICHT zwischen allen Zeilen derselben Station
    ueberein -- kein Einzelfall. Ebenso variieren Namens-/Adress-/
    Zufahrtsfelder innerhalb einer Station haeufiger als erwartet
    (nom_station bei 2.056, coordonneesXY bei 5.923, adresse_station bei
    5.422, condition_acces bei 594 von 54.352 Stationen). Deshalb NICHT "erste
    Zeile gewinnt", sondern: die Zeile mit dem juengsten date_maj innerhalb
    der Stationsgruppe gilt als massgeblich fuer alle Stations-Skalarfelder
    (name/operator/address/city/coords/access_type/nbre_pdc/
    source_updated_at) -- das ist die einzige in den Daten selbst vorhandene
    Information darueber, welche Zeile "aktueller" ist. Abweichende Werte in
    anderen Zeilen der Gruppe werden gezaehlt und geloggt, nicht gemittelt
    oder geraten.
  - id_pdc_itinerance ist NICHT eindeutig ueber die gesamte Datei (166.915
    distinkte Werte bei 223.125 Zeilen) -- 55.952 IDs kommen mehrfach vor,
    davon 20.079 sogar unter verschiedenen id_station_itinerance-Werten
    (Hinweis auf Historisierung/Neu-Nummerierung von Stationen im
    Aggregator-Export). Innerhalb EINER Stationsgruppe wird deshalb vor dem
    Aufbau der Anschluesse nach id_pdc_itinerance dedupliziert (letztes
    Vorkommen gewinnt) -- sonst wuerden doppelt exportierte Ladepunkte auch
    doppelte core.connector-Zeilen erzeugen.
  - prise_type_autre ist ein reines "es gibt noch einen weiteren,
    unspezifizierten Anschluss"-Flag OHNE current_type-Information -- wird
    als eigener, sprechender standard-String ("IRVE: Autre (nicht
    spezifiziert)") mit current_type=None gespeichert (kein Raten von AC/DC),
    analog zum unknown:<id>-Fallback in import_ocm.py. Empirisch 4.775 von
    223.125 Zeilen (2,1%) gesetzt, IMMER zusammen mit mindestens einem
    anderen prise_type_*-Flag (kein einziger Ladepunkt hat NUR "Autre" ohne
    weitere Information -- die Kategorie liefert also nie den einzigen
    Anschluss eines Punktes).
  - 1.395 von 223.125 Zeilen (0,63%) haben KEIN einziges prise_type_*-Flag
    auf wahr -- fuer diese physischen Ladepunkte kann kein core.connector
    abgeleitet werden. Die Station (core.charge_point) wird trotzdem
    angelegt/aktualisiert, nur dieser eine Ladepunkt bleibt ohne
    Anschlusszeile (gezaehlt, nicht erfunden).
  - is_operational: dieses Schema hat KEIN Echtzeit-Statusfeld (statische,
    deklarative Stammdaten wie bei BNetzA "Anzahl Ladepunkte" o.ae., anders
    als OCMs StatusType/IsOperational) -- wird deshalb IMMER auf true
    gesetzt, analog zur Begruendung in import_ocm.py Zeile 165 fuer
    fehlende Statusinformation.
  - access_type wird aus condition_acces abgeleitet ("Accès libre" ->
    'public', "Accès réservé" -> 'restricted', leer/unbekannt -> NULL, kein
    Raten).
  - country_code ist fest 'FR' -- ABER: entgegen der urspruenglichen Annahme
    ("Frankreich-only, sollte sich sicher hardcoden lassen") ist diese Datei
    NICHT ausschliesslich Frankreich. 1.662 von 223.125 Zeilen (0,74%) haben
    ein id_station_itinerance-Praefix ungleich "FR" (ES: 327, ME: 44, BE: 40,
    DK: 36, NL: 10, IT: 10, RE: 3 -- Rest "Non concerné"). Stichprobe der
    Adressen zeigt aber: dieses Praefix ist KEIN verlaessliches
    Laenderkennzeichen -- "ES"/"IT" waren in der Stichprobe tatsaechlich
    Spanien/Italien (Adresse + leeres code_insee_commune), aber "DK"/"ME"/
    einige "NL"-Zeilen hatten Adressen UND ein gueltiges franzoesisches
    code_insee_commune mitten in Frankreich (z. B. "DKMONE3785539" ->
    "5 Allee Charles Gandia 31100 Toulouse", INSEE 31555) -- das Praefix ist
    offensichtlich teils eine interne Betreiber-Codierung, die zufaellig wie
    ein ISO-Laendercode aussieht, kein zuverlaessiges Signal. Ein
    Laendercode-Rateversuch anhand des Praefix wuerde also mehr echte
    franzoesische Stationen falsch als "auslaendisch" labeln, als er
    tatsaechlich auslaendische Stationen korrekt erkennt -- deshalb bewusst
    country_code='FR' fuer ALLE Zeilen beibehalten (der Datensatz heisst
    "Base Nationale des IRVE" und ist zu >99,2% verifiziert franzoesisch),
    die betroffenen Zeilen werden aber gezaehlt und geloggt (siehe
    `foreign_prefix_counter` in main()), damit diese bekannte Einschraenkung
    sichtbar bleibt statt stillschweigend uebergangen zu werden.
  - postcode/city kommen NICHT aus dem Basisschema (das kennt nur
    adresse_station als Freitext-Gesamtadresse + code_insee_commune), aber
    aus den Aggregator-Zusatzspalten consolidated_code_postal/
    consolidated_commune, wenn vorhanden (62%/69% der Zeilen befuellt) --
    KEIN Regex-Rateversuch auf adresse_station, wenn diese leer sind (keine
    Scheindaten).
  - restriction_gabarit (Fahrzeuggroessen-Beschraenkung, fuer Charge2Camps
    Anhaenger-Tauglichkeits-Mission interessant) wird in dieser Aufgabe
    bewusst NICHT in core.charge_point/core.connector abgebildet -- es gibt
    keine passende Spalte, und eine automatische Ableitung von
    caravan_suitability ist explizit out of scope (siehe Auftrag). Der
    Rohwert bleibt ueber raw.charge_point.payload weiterhin auditierbar,
    geht also nicht verloren, nur ungenutzt fuer diesen Importlauf.

Nutzt DENSELBEN zentralen Resolver wie OCM/BNetzA (core.upsert_charge_point(),
siehe supabase/migrations/20261012000000_field_provenance_and_source_registry.sql)
-- keine eigene Merge-Logik.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from psycopg2.extras import Json, execute_batch

from common import find_and_absorb_nearby_duplicate, get_connection, import_run, setup_logging

# prise_type_<spalte> -> (core.connector.standard, current_type). Siehe
# Moduldocstring fuer die Begruendung jeder Zuordnung.
#
# prise_type_2 -> "Type2" (nicht "Type2_Socket"): das IRVE-Schema
# unterscheidet an dieser Stelle NICHT zwischen Steckdose und fest
# angeschlagenem Kabel (anders als BNetzA mit getrennten Rohwerten "AC Typ 2
# Steckdose"/"AC Typ 2 Fahrzeugkupplung") -- eine der beiden Kategorien zu
# erzwingen waere geraten. In Frankreich sind "Type 2"-Ladepunkte zwar
# haeufig Steckdosen, aber das ist keine dokumentierte Tatsache dieses
# Schemas, deshalb bewusst der neutralere/haeufigere Wert "Type2" statt
# "Type2_Socket" -- explizite Entscheidung, kein stiller Default.
PRISE_TYPE_MAP: dict[str, tuple[str, str | None]] = {
    "prise_type_2": ("Type2", "AC"),
    "prise_type_combo_ccs": ("CCS2", "DC"),  # Frankreich nutzt CCS2/Combo2, nicht CCS1
    "prise_type_chademo": ("CHAdeMO", "DC"),
    "prise_type_ef": ("Schuko", "AC"),  # Typ E/F Haushaltssteckdose = Schuko
    "prise_type_autre": ("IRVE: Autre (nicht spezifiziert)", None),
}

# Werte, die in der Praxis fuer "wahr" beobachtet wurden (case-insensitiv
# geprueft) -- siehe Moduldocstring, "True"/"true"/"TRUE"/"1" kommen alle vor.
_TRUE_VALUES = {"true", "1"}

# Gleiches Prinzip wie NEARBY_MANUAL_RADIUS_M in import_ocm.py/import_bnetza.py
# -- plus automatische Uebernahme von max_power_kw/connector_count/
# is_operational bei einem eindeutigen Treffer, siehe ingest/common.py
# find_and_absorb_nearby_duplicate() und supabase/migrations/
# 20261019000000_absorb_technical_fields_from_higher_priority.sql.
NEARBY_MANUAL_RADIUS_M = 40

# Plausibilitaetsgrenze fuer puissance_nominale, siehe Moduldocstring
# "unplausible Nennleistungen": core.connector.power_kw UND
# core.charge_point.max_power_kw sind numeric(6,2) (max. 9999,99) -- ohne
# diese Grenze bricht ein einzelner kaputter Wert (empirisch bis zu
# 160.000 kW gefunden) den GESAMTEN Importlauf mit einem
# NumericValueOutOfRange-Fehler ab, weil core.upsert_charge_point() den Wert
# ungeprueft in eine numeric(6,2)-Spalte schreibt. 1000 kW liegt bewusst
# grosszuegig ueber allen aktuell (2026) real verbauten Ladepunkten
# (handelsuebliche HPC-Lader bis ca. 400 kW, angekuendigte LKW-/Bus-MCS-Lader
# bis ca. 1000 kW) -- alles darueber ist mit ueberwiegender Wahrscheinlichkeit
# ein Dateneingabefehler, keine echte Anlage.
PLAUSIBLE_MAX_POWER_KW = 1000.0

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def _slug(value: str) -> str:
    return _SLUG_RE.sub("-", value.strip().lower()).strip("-") or "unbekannt"


def _parse_bool(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in _TRUE_VALUES


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _sane_power_kw(value: float | None, implausible_counter: Counter) -> float | None:
    """Siehe PLAUSIBLE_MAX_POWER_KW: filtert unplausible puissance_nominale-
    Werte heraus, BEVOR sie core.upsert_charge_point()/core.connector
    erreichen (sonst numeric(6,2)-Overflow -> ganzer Lauf bricht ab)."""
    if value is None:
        return None
    if value < 0 or value > PLAUSIBLE_MAX_POWER_KW:
        implausible_counter["verworfen"] += 1
        implausible_counter["max_gesehen"] = max(implausible_counter["max_gesehen"], value)
        return None
    return value


def _parse_coords(value: str | None) -> tuple[float, float] | None:
    """coordonneesXY ist ein "[lon, lat]"-JSON-Array (siehe Moduldocstring,
    empirisch immer wohlgeformt) -- ein einzelner Parsingfehler wird trotzdem
    NICHT hart abgebrochen, sondern wie eine fehlende Koordinate behandelt
    (Zeile wird uebersprungen, gezaehlt)."""
    if not value:
        return None
    try:
        parsed = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(parsed, list) or len(parsed) != 2:
        return None
    lon, lat = parsed
    if not isinstance(lon, (int, float)) or not isinstance(lat, (int, float)):
        return None
    return float(lon), float(lat)


def _parse_access_type(condition_acces: str | None) -> str | None:
    """Siehe Moduldocstring: ca. 0,8% der Werte sind kaputt kodierte
    Varianten von "Accès libre"/"Accès réservé" -- robust per ASCII-
    sicherem Teilstring statt exaktem Vergleich erkannt."""
    if not condition_acces:
        return None
    lowered = condition_acces.strip().lower()
    if "libre" in lowered:
        return "public"
    if "serv" in lowered:  # "réservé"/kaputte Varianten enthalten immer "serv"
        return "restricted"
    return None


def compute_station_key(
    id_station_itinerance: str, id_station_local: str, nom_station: str, lon: float, lat: float
) -> tuple[str, str]:
    """Baut den core.charge_point.external_key fuer eine Station und gibt
    zusaetzlich zurueck, welcher Fallback-Zweig genutzt wurde (fuer die
    Lauf-Zusammenfassung). Siehe Moduldocstring zu "Non concerné"."""
    id_station_itinerance = (id_station_itinerance or "").strip()
    if id_station_itinerance and id_station_itinerance != "Non concerné":
        return f"irve:{id_station_itinerance}", "normal"

    id_station_local = (id_station_local or "").strip()
    if id_station_local:
        return f"irve:local:{id_station_local}", "fallback_local_id"

    return f"irve:geo:{lon:.6f}:{lat:.6f}:{_slug(nom_station or '')}", "fallback_geo_name"


def parse_pdc_row(row: dict[str, str], implausible_power_counter: Counter) -> dict[str, Any] | None:
    """Parst EINE CSV-Zeile (= ein Ladepunkt). None = Zeile muss
    uebersprungen werden (keine Ladepunkt-ID oder keine Koordinaten)."""
    pdc_id = (row.get("id_pdc_itinerance") or "").strip()
    coords = _parse_coords(row.get("coordonneesXY"))
    if not pdc_id or coords is None:
        return None
    lon, lat = coords

    external_key, key_kind = compute_station_key(
        row.get("id_station_itinerance", ""),
        row.get("id_station_local", ""),
        row.get("nom_station", ""),
        lon,
        lat,
    )

    return {
        "pdc_id": pdc_id,
        "id_station_itinerance": (row.get("id_station_itinerance") or "").strip(),
        "station_key": external_key,
        "station_key_kind": key_kind,
        "lon": lon,
        "lat": lat,
        "nom_station": (row.get("nom_station") or "").strip() or None,
        "nom_enseigne": (row.get("nom_enseigne") or "").strip() or None,
        "nom_operateur": (row.get("nom_operateur") or "").strip() or None,
        "nom_amenageur": (row.get("nom_amenageur") or "").strip() or None,
        "adresse_station": (row.get("adresse_station") or "").strip() or None,
        "consolidated_code_postal": (row.get("consolidated_code_postal") or "").strip() or None,
        "consolidated_commune": (row.get("consolidated_commune") or "").strip() or None,
        "condition_acces": (row.get("condition_acces") or "").strip() or None,
        "nbre_pdc": int(row["nbre_pdc"]) if (row.get("nbre_pdc") or "").strip().isdigit() else None,
        "date_maj": (row.get("date_maj") or "").strip() or None,
        "puissance_nominale": _sane_power_kw(_parse_float(row.get("puissance_nominale")), implausible_power_counter),
        "_flags": {col: _parse_bool(row.get(col)) for col in PRISE_TYPE_MAP},
        "_raw": row,
    }


def build_connectors(deduped_pdc_rows: list[dict[str, Any]], autre_counter: Counter, no_flag_counter: Counter) -> list[dict[str, Any]]:
    """Ein Ladepunkt (deduplizierte Zeile) kann MEHRERE prise_type_*-Flags
    gleichzeitig gesetzt haben (physischer Punkt mit mehreren Steckern) --
    jedes wahre Flag wird eine eigene core.connector-Zeile, mit der
    Nennleistung DIESER Zeile (nicht des Stationsmaximums)."""
    connectors: list[dict[str, Any]] = []
    for pdc in deduped_pdc_rows:
        any_flag = False
        for col, (standard, current_type) in PRISE_TYPE_MAP.items():
            if pdc["_flags"].get(col):
                any_flag = True
                if col == "prise_type_autre":
                    autre_counter["gesetzt"] += 1
                connectors.append({
                    "standard": standard,
                    "power_kw": pdc["puissance_nominale"],
                    "current_type": current_type,
                    "quantity": 1,
                })
        if not any_flag:
            no_flag_counter["ohne_steckertyp"] += 1
    return connectors


def build_station_payload(
    station_key: str, pdc_rows: list[dict[str, Any]], nbre_pdc_conflicts: Counter, autre_counter: Counter, no_flag_counter: Counter
) -> dict[str, Any]:
    """Fasst alle Zeilen einer Station zu EINEM
    core.upsert_charge_point-Payload zusammen. Siehe Moduldocstring:
    Stations-Skalarfelder kommen von der Zeile mit dem juengsten date_maj,
    max_power_kw wird ueber ALLE (deduplizierten) Zeilen aggregiert."""
    # Nach id_pdc_itinerance deduplizieren (letztes Vorkommen gewinnt) --
    # siehe Moduldocstring zu doppelt exportierten Ladepunkt-IDs.
    deduped_by_pdc: dict[str, dict[str, Any]] = {}
    for pdc in pdc_rows:
        deduped_by_pdc[pdc["pdc_id"]] = pdc
    deduped_pdc_rows = list(deduped_by_pdc.values())

    # date_maj ist "YYYY-MM-DD" (bis auf eine einzelne empirisch gefundene
    # Ausnahme ohne Zero-Padding, siehe Moduldocstring) -- als String
    # sortierbar genug, um die juengste Zeile zu bestimmen; None sortiert
    # als kleinster Wert (nie massgeblich, wenn eine andere Zeile ein Datum
    # hat).
    representative = max(deduped_pdc_rows, key=lambda p: p["date_maj"] or "")

    nbre_pdc_values = {p["nbre_pdc"] for p in deduped_pdc_rows if p["nbre_pdc"] is not None}
    if len(nbre_pdc_values) > 1:
        nbre_pdc_conflicts["stationen"] += 1

    max_power_kw = max(
        (p["puissance_nominale"] for p in deduped_pdc_rows if p["puissance_nominale"] is not None),
        default=None,
    )

    name = representative["nom_station"] or representative["nom_enseigne"]
    operator = representative["nom_operateur"] or representative["nom_amenageur"]

    connectors = build_connectors(deduped_pdc_rows, autre_counter, no_flag_counter)

    return {
        "external_key": station_key,
        "name": name,
        "operator": operator,
        "network": None,  # IRVE kennt kein separates Roaming-/Netzwerkfeld
        "lat": representative["lat"],
        "lon": representative["lon"],
        "address": representative["adresse_station"],
        "postcode": representative["consolidated_code_postal"],
        "city": representative["consolidated_commune"],
        "country_code": "FR",  # siehe Moduldocstring: id_station_itinerance-Praefix ist KEIN verlaessliches Laendersignal
        "access_type": _parse_access_type(representative["condition_acces"]),
        "is_operational": True,  # siehe Moduldocstring: keine Statusspalte in diesem Schema
        "max_power_kw": max_power_kw,
        "connector_count": representative["nbre_pdc"],
        "source_updated_at": representative["date_maj"],
        "_connectors": connectors,
        "_pdc_rows": deduped_pdc_rows,
    }


def load_stations(path: str, implausible_power_counter: Counter) -> tuple[dict[str, list[dict[str, Any]]], int]:
    """Liest die IRVE-Exportdatei ein und gruppiert die Zeilen nach
    Stationsschluessel. Gibt (Gruppen, Anzahl uebersprungener Zeilen ohne
    Ladepunkt-ID/Koordinaten) zurueck."""
    stations: dict[str, list[dict[str, Any]]] = defaultdict(list)
    skipped = 0
    with open(path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            parsed = parse_pdc_row(row, implausible_power_counter)
            if parsed is None:
                skipped += 1
                continue
            stations[parsed["station_key"]].append(parsed)
    return stations, skipped


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
        description="Ladesaeulen-Ingest von der franzoesischen Base Nationale des IRVE."
    )
    parser.add_argument("--file", required=True, metavar="PATH", help="CSV-Exportdatei der Base Nationale des IRVE")
    args = parser.parse_args()

    logger = setup_logging()

    path = Path(args.file)
    if not path.exists():
        raise SystemExit(f"Datei nicht gefunden: {path}")

    implausible_power_counter: Counter = Counter()
    stations, skipped_no_pdc_id_or_coords = load_stations(args.file, implausible_power_counter)
    total_rows = sum(len(rows) for rows in stations.values()) + skipped_no_pdc_id_or_coords
    logger.info(
        "%d Zeilen aus %s gelesen, zu %d Stationen gruppiert (%d Zeilen ohne Ladepunkt-ID/Koordinaten uebersprungen).",
        total_rows, args.file, len(stations), skipped_no_pdc_id_or_coords,
    )

    autre_counter: Counter = Counter()
    no_flag_counter: Counter = Counter()
    nbre_pdc_conflicts: Counter = Counter()
    near_manual_duplicates = 0
    near_manual_same_operator = 0
    absorbed_count = 0
    station_key_kinds: Counter = Counter()
    # Siehe Moduldocstring "country_code ist fest 'FR'": Zeilen, deren
    # id_station_itinerance NICHT mit "FR" beginnt (und kein "Non concerné"-
    # Platzhalter ist) -- country_code wird TROTZDEM 'FR' gespeichert (das
    # Praefix ist empirisch kein verlaessliches Laendersignal), aber gezaehlt,
    # damit diese bekannte Einschraenkung sichtbar bleibt.
    non_fr_prefix_counter: Counter = Counter()

    conn = get_connection()
    try:
        with import_run(conn, source="irve", scope=f"file:{args.file}") as (run_id, state):
            with conn.cursor() as cur:
                for station_key, pdc_rows in stations.items():
                    for pdc in pdc_rows:
                        station_key_kinds[pdc["station_key_kind"]] += 1
                        sid = pdc["id_station_itinerance"]
                        if sid and sid != "Non concerné" and not sid.startswith("FR"):
                            non_fr_prefix_counter[sid[:2]] += 1

                    payload = build_station_payload(
                        station_key, pdc_rows, nbre_pdc_conflicts, autre_counter, no_flag_counter
                    )

                    # Rohdaten-Audit-Trail: eine raw.charge_point-Zeile PRO
                    # CSV-Zeile (id_pdc_itinerance), nicht pro Station --
                    # siehe Moduldocstring "eine Zeile = ein Ladepunkt".
                    for pdc in payload["_pdc_rows"]:
                        cur.execute(
                            """
                            insert into raw.charge_point (source, source_id, import_run_id, payload, lat, lon)
                            values ('irve', %s, %s, %s, %s, %s)
                            on conflict (source, source_id) do update set
                                import_run_id = excluded.import_run_id,
                                payload = excluded.payload,
                                lat = excluded.lat,
                                lon = excluded.lon,
                                fetched_at = now()
                            """,
                            (pdc["pdc_id"], run_id, Json(pdc["_raw"]), pdc["lat"], pdc["lon"]),
                        )

                    dup = find_and_absorb_nearby_duplicate(
                        cur,
                        source="irve",
                        lat=payload["lat"],
                        lon=payload["lon"],
                        operator=payload["operator"],
                        max_power_kw=payload["max_power_kw"],
                        connector_count=payload["connector_count"],
                        is_operational=payload["is_operational"],
                        connectors=payload["_connectors"],
                        replace_connectors=replace_connectors,
                        radius=NEARBY_MANUAL_RADIUS_M,
                    )
                    if dup["duplicate"]:
                        near_manual_duplicates += 1
                        if dup["same_operator"]:
                            near_manual_same_operator += 1
                        if dup["absorbed"]:
                            absorbed_count += 1
                    payload["initial_is_active"] = dup["initial_is_active"]

                    upsert_payload = {k: v for k, v in payload.items() if not k.startswith("_")}
                    cur.execute(
                        "select id, manual_override from core.upsert_charge_point(%(payload)s, 'irve')",
                        {"payload": Json(upsert_payload)},
                    )
                    charge_point_id, manual_override = cur.fetchone()

                    # Bei fixierten Stationen (Admin-Korrektur) auch die
                    # Anschluesse unangetastet lassen -- gleiches Prinzip wie
                    # in import_ocm.py/import_bnetza.py replace_connectors().
                    if not manual_override:
                        replace_connectors(cur, charge_point_id, payload["_connectors"])

                    state["record_count"] += 1

                # Quellenuebergreifend (nicht nur 'ocm'), siehe
                # supabase/migrations/
                # 20261013000000_fill_missing_trailer_suitability_any_source.sql.
                cur.execute("select core.fill_missing_trailer_suitability()")

                # Gleiches Zusammenfassungsmuster wie import_bnetza.py: "Verarbeitet"
                # zaehlt nur Stationen dieses Laufs, sagt nichts darueber aus, ob
                # sich etwas geaendert hat (core.upsert_charge_point() ist
                # idempotent) -- deshalb zusaetzlich neu/geaendert/abgelehnt separat
                # ermitteln, relativ zum Startzeitpunkt DIESES Laufs.
                cur.execute("select started_at from raw.import_run where id = %s", (run_id,))
                run_started_at = cur.fetchone()[0]

                cur.execute(
                    "select count(*) from core.charge_point where source = 'irve' and created_at >= %s",
                    (run_started_at,),
                )
                new_charge_point_count = cur.fetchone()[0]

                cur.execute(
                    """
                    select count(distinct charge_point_id)
                    from core.field_change_log
                    where action = 'applied' and incoming_source = 'irve' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                changed_charge_point_count = cur.fetchone()[0]

                cur.execute(
                    """
                    select count(*)
                    from core.field_change_log
                    where action = 'rejected_by_manual_override' and incoming_source = 'irve' and created_at >= %s
                    """,
                    (run_started_at,),
                )
                rejected_change_count = cur.fetchone()[0]
    finally:
        conn.close()

    logger.info("Verarbeitet: %d Stationen.", state["record_count"])
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
    if skipped_no_pdc_id_or_coords:
        logger.warning("%d Zeilen ohne Ladepunkt-ID/Koordinaten uebersprungen.", skipped_no_pdc_id_or_coords)
    if station_key_kinds["fallback_local_id"] or station_key_kinds["fallback_geo_name"]:
        logger.warning(
            "%d Zeilen ohne id_station_itinerance ('Non concerné'): %d ueber id_station_local, "
            "%d ueber Koordinaten+Name als Ersatzschluessel gruppiert -- siehe Moduldocstring.",
            station_key_kinds["fallback_local_id"] + station_key_kinds["fallback_geo_name"],
            station_key_kinds["fallback_local_id"],
            station_key_kinds["fallback_geo_name"],
        )
    if implausible_power_counter["verworfen"]:
        logger.warning(
            "%d puissance_nominale-Werte ueber der Plausibilitaetsgrenze von %.0f kW verworfen "
            "(power_kw=NULL statt Wert, hoechster gesehener Wert: %.0f kW) -- vermutlich "
            "Dateneingabefehler in der Quelle, siehe PLAUSIBLE_MAX_POWER_KW im Modul.",
            implausible_power_counter["verworfen"],
            PLAUSIBLE_MAX_POWER_KW,
            implausible_power_counter["max_gesehen"],
        )
    if non_fr_prefix_counter:
        logger.warning(
            "%d Zeilen mit id_station_itinerance-Praefix ungleich 'FR' (Anzahl je Praefix: %s) -- "
            "country_code wurde trotzdem 'FR' gespeichert, das Praefix ist empirisch KEIN "
            "verlaessliches Laendersignal (siehe Moduldocstring), diese Zeilen sind aber ein "
            "Kandidat fuer eine manuelle Pruefung/kuenftige Verbesserung.",
            sum(non_fr_prefix_counter.values()),
            dict(non_fr_prefix_counter),
        )
    if nbre_pdc_conflicts["stationen"]:
        logger.warning(
            "%d Stationen mit widerspruechlicher nbre_pdc-Angabe zwischen ihren eigenen Zeilen -- "
            "Wert der Zeile mit dem juengsten date_maj uebernommen, siehe Moduldocstring.",
            nbre_pdc_conflicts["stationen"],
        )
    if autre_counter["gesetzt"]:
        logger.info(
            "%d Ladepunkte mit prise_type_autre=true -- als 'IRVE: Autre (nicht spezifiziert)' "
            "ohne current_type gespeichert (keine AC/DC-Annahme).",
            autre_counter["gesetzt"],
        )
    if no_flag_counter["ohne_steckertyp"]:
        logger.warning(
            "%d Ladepunkte ganz ohne gesetztes prise_type_*-Flag -- Station angelegt/aktualisiert, "
            "aber ohne core.connector-Zeile fuer diesen Punkt.",
            no_flag_counter["ohne_steckertyp"],
        )
    if near_manual_duplicates:
        logger.warning(
            "%d Stationen lagen beim Import innerhalb von %dm einer bereits bestehenden "
            "Nicht-IRVE-Station -- als is_active=false gespeichert, siehe Admin-Dashboard "
            "'Moegliche Dubletten (Ladepunkte)' zur manuellen Pruefung/Zusammenfuehrung.",
            near_manual_duplicates,
            NEARBY_MANUAL_RADIUS_M,
        )
        if near_manual_same_operator:
            logger.warning(
                "Davon %d mit identischem Betreiber wie die bestehende Nicht-IRVE-Station -- "
                "starkes Dublettensignal.",
                near_manual_same_operator,
            )
        if absorbed_count:
            logger.info(
                "%d davon eindeutig zugeordnet: Anschluesse/Ladeleistung/Betriebsbereitschaft der "
                "bestehenden (niedriger priorisierten) Station automatisch von IRVE uebernommen, "
                "siehe core.field_change_log (action='applied_absorb_higher_priority').",
                absorbed_count,
            )


if __name__ == "__main__":
    main()
