"use client";

import { useState } from "react";
import { NameSuggestField } from "@/components/name-suggest-field";
import { FilterChip } from "@/components/charging-stations/filter-chip";
import type { ChargingStationFilters, ChargingStationOperatorOption } from "@/lib/charging-stations";
import { CONNECTOR_CATEGORIES } from "@/lib/connector-categories";
import { TRAILER_VERDICT_LABELS, TRAILER_VERDICT_VALUES } from "@/lib/trailer-verdict";
import type { TrailerVerdict } from "@/types/database";

/** Alle Filterfelder fuer die Ladepunkte-Suche als Sofort-anwendende Chips
 * (kein <form>/Submit mehr, siehe charging-station-map-explorer.tsx) -- jeder
 * Tap ruft `onChange` mit dem geaenderten Ausschnitt des Filterzustands auf,
 * der Aufrufer haelt den vollstaendigen State. Reihenfolge weiterhin nach
 * Relevanz fuer die Zielgruppe sortiert:
 *   1. Anhaengertauglichkeit  -- Kernfrage des Produkts (CLAUDE.md
 *      Entwicklungsprinzip 7 "Anhaengertauglichkeit hat Prioritaet"), immer
 *      sichtbar, nie hinter einem Aufklapp-Bereich versteckt.
 *   2. Ladeleistung (Schnelllader) -- zweite technische Kernfrage.
 *   3. Steckertyp / 4. Ladeanbieter -- weitere technische Kompatibilitaet,
 *      potenziell viele Optionen, deshalb aufklappbar (<details>).
 *   5. Suche -- Freitext, kein Chip (evcaravan.de-Vergleich: dort ebenfalls
 *      eigenes Suchfeld statt Chip-Muster).
 *   6. Favoriten -- persoenliche Praeferenz, deshalb zuletzt.
 */
export function ChargingStationFilterFields({
  filters,
  onChange,
  isLoggedIn,
  nameOptions,
  operatorOptions,
}: {
  filters: ChargingStationFilters;
  onChange: (patch: Partial<ChargingStationFilters>) => void;
  /** "Nur Favoriten" ist ohne Login wirkungslos (leeres Ergebnis) -- Checkbox
   * dann gar nicht erst anzeigen statt einer verwirrenden leeren Karte. */
  isLoggedIn: boolean;
  /** Alle Ladepunkt-Anzeigenamen, fuer Vorschlaege im Suchfeld ab drei Zeichen. */
  nameOptions: string[];
  /** Alle core.charge_point.operator-Werte mit mindestens 5 aktiven
   * Stationen (siehe fetchChargingStationOperatorOptions). */
  operatorOptions: ChargingStationOperatorOption[];
}) {
  // Nur fuers Offenhalten der beiden Aufklapp-Bereiche (rein optisch, kein
  // Filterzustand) -- initial offen, wenn dort bereits etwas ausgewaehlt ist.
  const [connectorOpen, setConnectorOpen] = useState(filters.connectorCategories.length > 0);
  const [operatorOpen, setOperatorOpen] = useState(filters.operators.length > 0);

  function toggleTrailerVerdict(value: TrailerVerdict) {
    const next = filters.trailerVerdict.includes(value)
      ? filters.trailerVerdict.filter((v) => v !== value)
      : [...filters.trailerVerdict, value];
    onChange({ trailerVerdict: next });
  }

  function toggleConnectorCategory(key: string) {
    const next = filters.connectorCategories.includes(key)
      ? filters.connectorCategories.filter((k) => k !== key)
      : [...filters.connectorCategories, key];
    onChange({ connectorCategories: next });
  }

  function toggleOperator(operator: string) {
    const next = filters.operators.includes(operator)
      ? filters.operators.filter((o) => o !== operator)
      : [...filters.operators, operator];
    onChange({ operators: next });
  }

  return (
    <div className="flex flex-col gap-6 text-sm">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">
          Anhängertauglichkeit — standardmäßig nur „tauglich“ &amp; „abkoppeln nötig“
        </legend>
        <div className="flex flex-wrap gap-2">
          {TRAILER_VERDICT_VALUES.map((value) => (
            <FilterChip
              key={value}
              label={TRAILER_VERDICT_LABELS[value]}
              active={filters.trailerVerdict.includes(value)}
              onClick={() => toggleTrailerVerdict(value)}
            />
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <span className="font-medium">Ladeleistung</span>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Nur Schnelllader (≥100 kW)"
            active={filters.fastChargersOnly}
            onClick={() => onChange({ fastChargersOnly: !filters.fastChargersOnly })}
          />
        </div>
      </div>

      {/* Aufklappbar statt dauerhaft ausgeklappt -- eigener State statt
          nativem <details>/<summary> (dort waere ein kontrollierter
          "open"-Zustand ohne <form> drumherum unnoetig umstaendlich). */}
      <div>
        <button
          type="button"
          onClick={() => setConnectorOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between text-left font-medium"
          aria-expanded={connectorOpen}
        >
          <span>
            Steckertyp
            {filters.connectorCategories.length > 0 ? ` (${filters.connectorCategories.length} ausgewählt)` : ""}
          </span>
          <span aria-hidden="true">{connectorOpen ? "▲" : "▼"}</span>
        </button>
        {connectorOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            {CONNECTOR_CATEGORIES.map((category) => (
              <FilterChip
                key={category.key}
                label={category.label}
                active={filters.connectorCategories.includes(category.key)}
                onClick={() => toggleConnectorCategory(category.key)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setOperatorOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between text-left font-medium"
          aria-expanded={operatorOpen}
        >
          <span>
            Ladeanbieter
            {filters.operators.length > 0 ? ` (${filters.operators.length} ausgewählt)` : ""}
          </span>
          <span aria-hidden="true">{operatorOpen ? "▲" : "▼"}</span>
        </button>
        {operatorOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            {operatorOptions.map((option) => (
              <FilterChip
                key={option.operator}
                label={`${option.operator} (${option.stationCount})`}
                active={filters.operators.includes(option.operator)}
                onClick={() => toggleOperator(option.operator)}
              />
            ))}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1">
        Suche
        <NameSuggestField
          value={filters.q ?? ""}
          onCommit={(value) => onChange({ q: value || undefined })}
          placeholder="Name des Ladepunkts"
          options={nameOptions}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
      </label>

      {isLoggedIn && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Nur meine Favoriten"
            active={filters.favoritesOnly}
            onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          />
        </div>
      )}
    </div>
  );
}
