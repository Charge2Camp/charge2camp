"""Lizenzpruefung je Open-Charge-Map-Ladepunkt (harte Regel 3 in CLAUDE.md:
keine Daten mit kommerziellen Nutzungsbeschraenkungen).

Python-Gegenstueck zu src/lib/ocm-license.ts (dort die ausfuehrliche
Begruendung). Beide teilen sich die Testfaelle in ocm_license_cases.json
und muessen identisch entscheiden -- Aenderungen immer an beiden Stellen.

Fail-closed: nur "allowed" wird importiert, "restricted" und "unknown"
werden uebersprungen. Bewusst ohne Abhaengigkeiten (kein psycopg2/requests),
damit test_ocm_license.py auch in CI ohne Datenbank laeuft.
"""

from __future__ import annotations

import re
from typing import Any

# Vor den Erlaubt-Mustern pruefen: "creativecommons.org/licenses/by-nc-sa"
# enthaelt sonst auch "licenses/by".
RESTRICTED_PATTERNS = [
    re.compile(r"non-?commercial"),
    re.compile(r"nicht-?kommerziell"),
    re.compile(r"\bby-nc\b"),
    re.compile(r"\bnc\b"),
]

ALLOWED_PATTERNS = [
    re.compile(r"\bcc[- ]?by\b"),
    re.compile(r"creative commons attribution"),
    re.compile(r"creativecommons\.org/licenses/by(-sa)?/"),
    re.compile(r"\bcc[- ]?0\b"),
    re.compile(r"open government licen[cs]e"),
    re.compile(r"licence[ _]ouverte"),
    re.compile(r"etalab"),
    re.compile(r"may be used for any purpose"),
]


def classify_ocm_license(license_text: str | None, is_open_data_licensed: bool | None = None) -> str:
    if is_open_data_licensed is False:
        return "restricted"
    text = (license_text or "").strip().lower()
    if not text:
        return "unknown"
    if any(p.search(text) for p in RESTRICTED_PATTERNS):
        return "restricted"
    if any(p.search(text) for p in ALLOWED_PATTERNS):
        return "allowed"
    return "unknown"


def classify_ocm_poi(poi: dict[str, Any], providers_by_id: dict[int, dict[str, Any]] | None = None) -> str:
    """Live-API (compact=false) liefert das DataProvider-Objekt direkt mit.
    Das ocm-export-Format (--file) enthaelt nur DataProviderID -- dann wird
    ueber `providers_by_id` (aus /v3/referencedata) aufgeloest; ohne diese
    Zuordnung bleibt der Ladepunkt "unknown" und wird uebersprungen."""
    provider = poi.get("DataProvider")
    if not isinstance(provider, dict) and providers_by_id is not None:
        provider = providers_by_id.get(poi.get("DataProviderID"))
    if not isinstance(provider, dict):
        return "unknown"
    return classify_ocm_license(provider.get("License"), provider.get("IsOpenDataLicensed"))
