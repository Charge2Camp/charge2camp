import { NameSuggestField } from "@/components/name-suggest-field";
import type { ChargingStationFilters } from "@/lib/charging-stations";
import { formatConnectorStandard } from "@/lib/connector-standard";
import { CHARGING_PROVIDERS } from "@/lib/charging-providers";

/** "Weitere Filter" -- Suche + Steckertyp. Anhaengertauglichkeit, Schnelllader
 * und Favoriten stehen als Quick-Filter im selben Panel (siehe
 * quick-filters.tsx, das auch den einzigen Submit/Zuruecksetzen-Button
 * traegt). Kein eigenes <form>/kein eigener Submit-Button hier: die Felder
 * gehoeren zum umschliessenden <form> im Filter-Panel der Ladepunkte-Seite. */
export function ChargingStationFilterForm({
  filters,
  connectorTypes,
  nameOptions,
}: {
  filters: ChargingStationFilters;
  connectorTypes: string[];
  /** Alle Ladepunkt-Anzeigenamen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
}) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      <label className="flex flex-col gap-1">
        Suche
        <NameSuggestField
          name="q"
          defaultValue={filters.q}
          placeholder="Name des Ladepunkts"
          options={nameOptions}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1">
        Steckertyp
        <select
          name="connector"
          defaultValue={filters.connectorType ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        >
          <option value="">Alle</option>
          {connectorTypes.map((c) => (
            <option key={c} value={c}>
              {formatConnectorStandard(c)}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Ladeanbieter</legend>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {CHARGING_PROVIDERS.map((provider) => (
            <label key={provider.key} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name={`provider_${provider.key}`}
                value="1"
                defaultChecked={filters.operatorKeys.includes(provider.key)}
              />
              {provider.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
