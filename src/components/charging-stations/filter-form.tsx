import { NameSuggestField } from "@/components/name-suggest-field";
import type { ChargingStationFilters } from "@/lib/charging-stations";
import { formatConnectorStandard } from "@/lib/connector-standard";

/** "Weitere Filter" -- Suche + Steckertyp. Anhaengertauglichkeit und
 * Schnelllader stehen als Quick-Filter direkt auf der Seite (siehe
 * quick-filters.tsx). Kein eigenes <form>: die Felder gehoeren zum
 * umschliessenden <form> in ladepunkte/page.tsx, damit ein Submit
 * Quick-Filter und "weitere Filter" gemeinsam anwendet, egal ob er aus dem
 * Pop-up oder von den Quick-Filtern ausgeloest wird. */
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

      <button
        type="submit"
        className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover"
      >
        Filtern
      </button>
    </div>
  );
}
