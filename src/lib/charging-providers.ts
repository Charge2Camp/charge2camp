/**
 * Feste Auswahl der zehn größten/verbreitetsten Lade-Anbieter (Nutzerwunsch)
 * -- als Checkbox-Auswahl sowohl im Profil ("Mein Gespann", bevorzugte
 * Anbieter) als auch im Routenplaner nutzbar. core.charge_point.operator
 * kommt roh aus OCM und variiert stark je nach Land/Rechtsform (z. B.
 * "Shell Recharge Solutions (DE)" vs. "(BE)", "EnBW (D)", "Enel X"
 * mehrfach ohne Zusatz) -- ein exakter String-Vergleich wuerde die meisten
 * Treffer verpassen, deshalb Zuordnung ueber Keyword-Teilstrings
 * (case-insensitive), siehe operatorMatchesProvider.
 */
export interface ChargingProviderOption {
  /** Stabiler Schluessel -- wird in profiles.preferred_charging_providers
   * und saved_routes.preferred_providers gespeichert (nicht der Label-Text,
   * der sich aendern kann). */
  key: string;
  label: string;
  matchKeywords: string[];
}

export const CHARGING_PROVIDERS: ChargingProviderOption[] = [
  { key: "tesla", label: "Tesla Supercharger", matchKeywords: ["tesla"] },
  { key: "ionity", label: "IONITY", matchKeywords: ["ionity"] },
  { key: "enbw", label: "EnBW", matchKeywords: ["enbw"] },
  { key: "enel_x", label: "Enel X", matchKeywords: ["enel x", "enel"] },
  { key: "shell_recharge", label: "Shell Recharge", matchKeywords: ["shell recharge", "shell"] },
  { key: "eon_drive", label: "E.ON Drive", matchKeywords: ["e.on", "eon drive"] },
  { key: "allego", label: "Allego", matchKeywords: ["allego"] },
  { key: "fastned", label: "Fastned", matchKeywords: ["fastned"] },
  { key: "aral_pulse", label: "Aral pulse", matchKeywords: ["aral"] },
  { key: "ewe_go", label: "EWE Go", matchKeywords: ["ewe"] },
];

const PROVIDER_BY_KEY = new Map(CHARGING_PROVIDERS.map((p) => [p.key, p]));

export function operatorMatchesProvider(operator: string | null | undefined, providerKey: string): boolean {
  if (!operator) return false;
  const provider = PROVIDER_BY_KEY.get(providerKey);
  if (!provider) return false;
  const lower = operator.toLowerCase();
  return provider.matchKeywords.some((kw) => lower.includes(kw));
}

export function operatorMatchesAnyProvider(operator: string | null | undefined, providerKeys: string[]): boolean {
  return providerKeys.some((key) => operatorMatchesProvider(operator, key));
}

/** Nur bekannte Schluessel durchlassen -- verhindert, dass manipulierte
 * Formulardaten (oder veraltete, inzwischen entfernte Schluessel aus der
 * DB) unbemerkt als gueltiger Filter landen. */
export function sanitizeProviderKeys(keys: string[]): string[] {
  return keys.filter((k) => PROVIDER_BY_KEY.has(k));
}
