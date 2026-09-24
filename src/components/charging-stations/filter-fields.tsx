import { NameSuggestField } from "@/components/name-suggest-field";
import type { ChargingStationFilters, ChargingStationOperatorOption } from "@/lib/charging-stations";
import { CONNECTOR_CATEGORIES } from "@/lib/connector-categories";
import { TRAILER_VERDICT_LABELS, TRAILER_VERDICT_VALUES } from "@/lib/trailer-verdict";

/** Alle Filterfelder fuer die Ladepunkte-Suche, EIN Ablauf statt der
 * vorherigen kuenstlichen Trennung "Quick-Filter"/"weitere Filter" (beide
 * lagen ohnehin im selben Panel, nur durch eine <hr> getrennt) -- Reihenfolge
 * ist bewusst nach Relevanz fuer die Zielgruppe sortiert:
 *   1. Anhaengertauglichkeit  -- Kernfrage des Produkts (CLAUDE.md
 *      Entwicklungsprinzip 7 "Anhaengertauglichkeit hat Prioritaet"), immer
 *      sichtbar, nie hinter einem Aufklapp-Bereich versteckt.
 *   2. Ladeleistung (Schnelllader) -- zweite technische Kernfrage.
 *   3. Steckertyp / 4. Ladeanbieter -- weitere technische Kompatibilitaet,
 *      potenziell viele Optionen, deshalb aufklappbar (<details>).
 *   5. Suche -- Freitext, kein Kompatibilitaetsfilter.
 *   6. Favoriten -- persoenliche Praeferenz, deshalb zuletzt (vorher an
 *      erster Stelle).
 * Kein eigenes <form>/keine Submit-Buttons hier: das umschliessende <form>
 * samt der jetzt fest am unteren Rand des Filter-Panels stehenden
 * "Filtern"/"Zuruecksetzen"-Buttons lebt in charging-station-map-explorer.tsx
 * (Nutzerwunsch: Buttons "ganz nach unten", nicht mitten im scrollbaren
 * Inhalt). */
export function ChargingStationFilterFields({
  filters,
  isLoggedIn,
  nameOptions,
  operatorOptions,
}: {
  filters: ChargingStationFilters;
  /** "Nur Favoriten" ist ohne Login wirkungslos (leeres Ergebnis) -- Checkbox
   * dann gar nicht erst anzeigen statt einer verwirrenden leeren Karte. */
  isLoggedIn: boolean;
  /** Alle Ladepunkt-Anzeigenamen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
  /** Alle core.charge_point.operator-Werte mit mindestens 5 aktiven
   * Stationen (siehe fetchChargingStationOperatorOptions). */
  operatorOptions: ChargingStationOperatorOption[];
}) {
  return (
    <div className="flex flex-col gap-6 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">
          Anhängertauglichkeit — standardmäßig nur „tauglich“ &amp; „abkoppeln nötig“
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
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
        </div>
      </fieldset>

      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="fast" value="1" defaultChecked={filters.fastChargersOnly} />
        Nur Schnelllader (≥100 kW) — standardmäßig aktiv
      </label>

      {/* Aufklappbar statt dauerhaft ausgeklappt -- nativ per <details>, kein
          Client-Component/State noetig: die Checkboxen bleiben beim
          Einklappen im DOM und werden beim Absenden des umschliessenden
          <form> trotzdem mitgeschickt. Bereits aktive Auswahl haelt den
          Bereich offen, damit sie nicht "versteckt" wirkt. */}
      <details className="group" open={filters.connectorCategories.length > 0}>
        <summary className="min-h-11 cursor-pointer select-none py-1 font-medium">
          Steckertyp
          {filters.connectorCategories.length > 0 ? ` (${filters.connectorCategories.length} ausgewählt)` : ""}
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
          {CONNECTOR_CATEGORIES.map((category) => (
            <label key={category.key} className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                name={`connector_${category.key}`}
                value="1"
                defaultChecked={filters.connectorCategories.includes(category.key)}
              />
              {category.label}
            </label>
          ))}
        </div>
      </details>

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

      {isLoggedIn && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="favorites" value="1" defaultChecked={filters.favoritesOnly} />
          Nur meine Favoriten
        </label>
      )}
    </div>
  );
}
