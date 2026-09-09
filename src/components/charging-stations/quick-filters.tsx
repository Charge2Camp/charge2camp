import Link from "next/link";
import type { ChargingStationFilters } from "@/lib/charging-stations";
import { TRAILER_VERDICT_LABELS, TRAILER_VERDICT_VALUES } from "@/lib/trailer-verdict";

/** Anhaengertauglichkeit + Schnelllader direkt auf der Seite -- fuer diese
 * Zielgruppe (Camper mit Wohnwagen/E-Auto) die wichtigste Frage ueberhaupt
 * (§ Entwicklungsprinzip 7 "Anhaengertauglichkeit hat Prioritaet", siehe
 * CLAUDE.md), deshalb bewusst nicht im "Weitere Filter"-Pop-up versteckt
 * (gleiches Muster wie quick-filters.tsx bei den Campingplaetzen). Kein
 * eigenes <form> -- die Felder gehoeren zum umschliessenden <form> in
 * ladepunkte/page.tsx (zusammen mit den "weiteren Filtern" aus
 * filter-form.tsx), damit ein einziger Submit alle aktiven Filter
 * gemeinsam anwendet. */
export function ChargingStationQuickFilters({
  filters,
  isLoggedIn,
}: {
  filters: ChargingStationFilters;
  /** "Nur Favoriten" ist ohne Login wirkungslos (leeres Ergebnis) -- Checkbox
   * dann gar nicht erst anzeigen statt einer verwirrenden leeren Karte. */
  isLoggedIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 text-sm">
      {isLoggedIn && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" name="favorites" value="1" defaultChecked={filters.favoritesOnly} />
          Nur meine Favoriten
        </label>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Anhängertauglichkeit</legend>
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
        Nur Schnelllader (≥100 kW)
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover"
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
    </div>
  );
}
