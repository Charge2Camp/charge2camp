import Link from "next/link";
import { NameSuggestField } from "@/components/name-suggest-field";
import type { ChargingStationFilters } from "@/lib/charging-stations";
import { TRAILER_VERDICT_LABELS, TRAILER_VERDICT_VALUES } from "@/lib/trailer-verdict";

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
    <form className="flex flex-col gap-5 text-sm" action="/ladepunkte">
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
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="fast" value="1" defaultChecked={filters.fastChargersOnly} />
        Nur Schnelllader (≥100 kW)
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Anhängertauglichkeit</legend>
        {TRAILER_VERDICT_VALUES.map((value) => (
          <label key={value} className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              name={`trailer_${value}`}
              value="1"
              defaultChecked={filters.trailerVerdict.includes(value)}
            />
            {TRAILER_VERDICT_LABELS[value]}
          </label>
        ))}
      </fieldset>

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-12 rounded-md bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Filtern
        </button>
        <Link
          href="/ladepunkte"
          className="flex min-h-12 items-center rounded-md border border-black/10 px-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Zurücksetzen
        </Link>
      </div>
    </form>
  );
}
