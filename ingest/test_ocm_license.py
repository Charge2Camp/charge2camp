"""Prueft ocm_license.py gegen die gemeinsamen Testfaelle in
ocm_license_cases.json (dieselben wie src/lib/ocm-license.test.ts).
Braucht keine Datenbank, laeuft auch in CI (.github/workflows/ci.yml).

Aufruf:
    .venv/Scripts/python.exe test_ocm_license.py

Exit-Code 0 = bestanden, 1 = fehlgeschlagen.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from ocm_license import classify_ocm_license, classify_ocm_poi


def main() -> int:
    cases = json.loads((Path(__file__).parent / "ocm_license_cases.json").read_text(encoding="utf-8"))["cases"]
    failures = []
    for c in cases:
        actual = classify_ocm_license(c["license"], c["isOpenDataLicensed"])
        if actual != c["expected"]:
            failures.append(f"{c['provider']}: erwartet {c['expected']}, erhalten {actual}")

    providers = {26: {"License": cases[9]["license"], "IsOpenDataLicensed": True}}
    poi_checks = [
        (classify_ocm_poi({"DataProvider": {"License": "CC0", "IsOpenDataLicensed": True}}), "allowed"),
        (classify_ocm_poi({}), "unknown"),
        (classify_ocm_poi({"DataProviderID": 26}), "unknown"),
        (classify_ocm_poi({"DataProviderID": 26}, providers), "restricted"),
        (classify_ocm_poi({"DataProviderID": 999}, providers), "unknown"),
    ]
    for i, (actual, expected) in enumerate(poi_checks):
        if actual != expected:
            failures.append(f"classify_ocm_poi Fall {i}: erwartet {expected}, erhalten {actual}")

    for f in failures:
        print("FEHLER:", f)
    print(f"{len(cases) + len(poi_checks) - len(failures)}/{len(cases) + len(poi_checks)} bestanden")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
