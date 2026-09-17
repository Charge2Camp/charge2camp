import { NameSuggestField } from "@/components/name-suggest-field";
import type { ChargingStationFilters, ChargingStationOperatorOption } from "@/lib/charging-stations";
import { formatConnectorStandard } from "@/lib/connector-standard";

/** "Weitere Filter" -- Suche + Steckertyp + Ladeanbieter. Anhaengertauglichkeit,
 * Schnelllader und Favoriten stehen als Quick-Filter im selben Panel (siehe
 * quick-filters.tsx, das auch den einzigen Submit/Zuruecksetzen-Button
 * traegt). Kein eigenes <form>/kein eigener Submit-Button hier: die Felder
 * gehoeren zum umschliessenden <form> im Filter-Panel der Ladepunkte-Seite. */
export function ChargingStationFilterForm({
  filters,
  connectorTypes,
  nameOptions,
  operatorOptions,
}: {
  filters: ChargingStationFilters;
  connectorTypes: string[];
  /** Alle Ladepunkt-Anzeigenamen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
  /** Alle core.charge_point.operator-Werte mit mindestens 5 aktiven
   * Stationen (siehe fetchChargingStationOperatorOptions) -- potenziell
   * viele Eintraege, deshalb als <details> aufklappbar statt die "weiteren
   * Filter" dauerhaft zu verlaengern (Uebersichtlichkeit). */
  operatorOptions: ChargingStationOperatorOption[];
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

      {/* Aufklappbar statt dauerhaft ausgeklappt (Nutzerwunsch: "bessere
          Uebersicht des Filterbereichs") -- bei potenziell Dutzenden
          Anbietern wuerde eine immer offene Liste das Panel unuebersichtlich
          verlaengern. Nativ per <details>, kein Client-Component/State
          noetig: die Checkboxen bleiben beim Einklappen im DOM und werden
          beim Absenden des umschliessenden <form> trotzdem mitgeschickt.
          Bereits aktive Auswahl haelt den Bereich offen, damit sie nicht
          "versteckt" wirkt. */}
      <details className="group" open={filters.operators.length > 0}>
        <summary className="min-h-11 cursor-pointer select-none py-1 font-medium">
          Ladeanbieter
          {filters.operators.length > 0 ? ` (${filters.operators.length} ausgewählt)` : ""}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {operatorOptions.map((option) => (
            <label key={option.operator} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name="operator"
                value={option.operator}
                defaultChecked={filters.operators.includes(option.operator)}
              />
              <span className="truncate" title={option.operator}>
                {option.operator} ({option.stationCount})
              </span>
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
