/** Formatiert core.connector.standard fuer die Anzeige. Die meisten Werte
 * kommen bereits als gut lesbarer OCM-ConnectionType-Titel (z. B. "CCS2",
 * "SCAME Type 3A (Low Power)", siehe echte Daten in core.connector) und
 * werden unveraendert durchgereicht -- nur die Faelle, die als interner
 * Code/Platzhalter durchschlagen, bekommen eine sprechende Bezeichnung
 * (siehe ingest/import_ocm.py CONNECTION_TYPE_MAP bzw. der
 * parse_connection()-Fallback fuer unbekannte ConnectionType-IDs). */
export function formatConnectorStandard(standard: string | null | undefined): string {
  if (!standard) return "Unbekannter Steckertyp";
  if (standard === "Type2_Socket") return "Type2 (Steckdose)";
  if (standard === "Unknown" || standard.startsWith("unknown:")) return "Unbekannter Steckertyp";
  return standard;
}
