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

export interface GroupedConnector {
  label: string;
  powerKw: number | null;
  quantity: number;
}

/** Fasst mehrere core.connector-Zeilen mit gleichem Anzeigenamen + gleicher
 * Ladeleistung zu einer Anzeigezeile zusammen (Anzahl summiert). OCM liefert
 * fuer manche Stationen jeden Anschluss als eigene Zeile mit quantity=1 statt
 * einer Zeile mit quantity=N (siehe ingest/import_ocm.py parse_connection())
 * -- das fuehrt ungefiltert zu unuebersichtlichen Wiederholungen wie
 * "1x CCS2 (150 kW), 1x CCS2 (150 kW), 1x CCS2 (150 kW)" statt "3x CCS2
 * (150 kW)". Rein fuer die Anzeige -- core.connector selbst bleibt
 * unveraendert (bewusst, fuer Admin-Dubletten-Abgleich/Audit weiterhin
 * zeilenscharf). Gruppiert nach dem bereits formatierten Anzeigenamen, damit
 * z. B. "Unknown" und "unknown:5" (beide "Unbekannter Steckertyp") ebenfalls
 * zusammenfallen. */
export function groupConnectorsForDisplay(
  connectors: { standard: string | null; power_kw: number | null; quantity: number }[]
): GroupedConnector[] {
  const grouped = new Map<string, GroupedConnector>();
  for (const c of connectors) {
    const label = formatConnectorStandard(c.standard);
    const key = `${label}|${c.power_kw ?? ""}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += c.quantity;
    else grouped.set(key, { label, powerKw: c.power_kw, quantity: c.quantity });
  }
  return Array.from(grouped.values());
}
