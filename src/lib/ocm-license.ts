/** Lizenzpruefung je Open-Charge-Map-Ladepunkt (harte Regel 3 in CLAUDE.md:
 * keine Daten mit kommerziellen Nutzungsbeschraenkungen). OCM selbst
 * lizenziert nur die Beitraege seiner Community unter CC BY 4.0; importierte
 * Ladepunkte behalten die Lizenz ihres Datenanbieters (DataProvider.License),
 * und OCM verlangt ausdruecklich, dass der Nutzer diese pro Ladepunkt prueft.
 * Recherche und Zahlen: OPTIMIERUNG.md, Abschnitt "D-1 Lizenzrecherche".
 *
 * Fail-closed: nur "allowed" wird importiert. "unknown" (leerer oder nicht
 * eindeutiger Lizenztext wie "Public Data redistributed by agreement")
 * wird genauso uebersprungen wie "restricted" -- ein neuer OCM-Anbieter mit
 * unklarer Lizenz landet so nie ungeprueft in der Datenbank.
 *
 * Python-Gegenstueck: ingest/ocm_license.py. Beide teilen sich die
 * Testfaelle in ingest/ocm_license_cases.json und muessen identisch
 * entscheiden -- Aenderungen immer an beiden Stellen. */

export type OcmLicenseClass = "allowed" | "restricted" | "unknown";

// Vor den Erlaubt-Mustern pruefen: "creativecommons.org/licenses/by-nc-sa"
// enthaelt sonst auch "licenses/by".
const RESTRICTED_PATTERNS = [/non-?commercial/, /nicht-?kommerziell/, /\bby-nc\b/, /\bnc\b/];

const ALLOWED_PATTERNS = [
  /\bcc[- ]?by\b/, // CC BY, CC-BY, CC BY-SA
  /creative commons attribution/,
  /creativecommons\.org\/licenses\/by(-sa)?\//,
  /\bcc[- ]?0\b/,
  /open government licen[cs]e/,
  /licence[ _]ouverte/,
  /etalab/,
  /may be used for any purpose/,
];

export function classifyOcmLicense(
  license: string | null | undefined,
  isOpenDataLicensed?: boolean | null,
): OcmLicenseClass {
  if (isOpenDataLicensed === false) return "restricted";
  const text = (license ?? "").trim().toLowerCase();
  if (!text) return "unknown";
  if (RESTRICTED_PATTERNS.some((p) => p.test(text))) return "restricted";
  if (ALLOWED_PATTERNS.some((p) => p.test(text))) return "allowed";
  return "unknown";
}

export interface OcmPoiLicenseInfo {
  DataProvider?: { License?: string | null; IsOpenDataLicensed?: boolean | null } | null;
}

export function classifyOcmPoi(poi: OcmPoiLicenseInfo): OcmLicenseClass {
  if (!poi.DataProvider) return "unknown";
  return classifyOcmLicense(poi.DataProvider.License, poi.DataProvider.IsOpenDataLicensed);
}
