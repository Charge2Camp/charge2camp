/**
 * Kuratierte, fuer Camper/E-Auto-Fahrer tatsaechlich relevante
 * Steckertyp-Kategorien fuer den Ladepunkte-Filter. core.connector.standard
 * kommt roh aus OCM (ConnectionType-Titel) und enthaelt neben den gaengigen
 * Typen viele seltene/industrielle Sonderformen (z. B. "SCAME Type 3A (Low
 * Power)", "XLR Plug (4 pin)") sowie mehrere rohe Varianten desselben
 * realen Steckers (z. B. "Type2" vs. "Type2_Socket") -- eine direkte
 * 1:1-Anzeige (vorherige fetchConnectorTypeOptions, ungeordnet/auf 5000
 * Zeilen begrenzt abgefragt) war weder vollstaendig (Type 2 fehlte je nach
 * Datenreihenfolge) noch eine sinnvolle Auswahl (Nutzerfeedback: "Das sind
 * nicht die gängigen Stecker"). Gleiches Muster wie CHARGING_PROVIDERS
 * (charging-providers.ts): feste, verstaendliche Kategorien statt roher
 * DB-Werte -- hier aber per exaktem Wert-Abgleich statt Keyword-Suche, da
 * core.connector.standard (anders als operator) ein enger, bekannter
 * Wertevorrat ist.
 */
export interface ConnectorCategoryOption {
  /** Stabiler Schluessel fuer Formularfelder (`connector_<key>`). */
  key: string;
  label: string;
  /** Exakte core.connector.standard-Werte, die dieser Kategorie zugeordnet sind. */
  matchStandards: string[];
}

export const CONNECTOR_CATEGORIES: ConnectorCategoryOption[] = [
  { key: "type2", label: "Type 2", matchStandards: ["Type2", "Type2_Socket"] },
  { key: "ccs", label: "CCS (Combo)", matchStandards: ["CCS1", "CCS2"] },
  { key: "chademo", label: "CHAdeMO", matchStandards: ["CHAdeMO"] },
  {
    key: "tesla",
    label: "Tesla / NACS",
    matchStandards: ["Tesla (Model S/X)", "Tesla (Roadster)", "NACS / Tesla Supercharger"],
  },
  { key: "type1", label: "Type 1", matchStandards: ["Type1"] },
  { key: "schuko", label: "Schuko (Haushaltssteckdose)", matchStandards: ["Schuko"] },
  {
    key: "cee",
    label: "CEE (Camping-/Industriesteckdose)",
    matchStandards: ["CEE 3 Pin", "CEE 5 Pin", "CEE 7/5", "CEE+ 7 Pin", "Europlug 2-Pin (CEE 7/16)"],
  },
];

const CATEGORY_BY_KEY = new Map(CONNECTOR_CATEGORIES.map((c) => [c.key, c]));

export function connectorStandardMatchesCategory(standard: string | null | undefined, categoryKey: string): boolean {
  if (!standard) return false;
  const category = CATEGORY_BY_KEY.get(categoryKey);
  if (!category) return false;
  return category.matchStandards.includes(standard);
}

export function connectorStandardMatchesAnyCategory(
  standard: string | null | undefined,
  categoryKeys: string[]
): boolean {
  return categoryKeys.some((key) => connectorStandardMatchesCategory(standard, key));
}
