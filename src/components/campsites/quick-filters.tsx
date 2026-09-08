import Link from "next/link";
import type { CampsiteFilters } from "@/lib/campsites";
import type { CoreAmenity } from "@/types/database";

/** Die Elektromobilitaets-Merkmale aus core.amenity (Kategorie "laden") --
 * fuer diese Zielgruppe (Camper mit E-Auto) die wichtigste Frage ueberhaupt,
 * deshalb bewusst nicht im "Weitere Filter"-Pop-up versteckt, sondern direkt
 * sichtbar (siehe Kommentar in campingplaetze/page.tsx). */
const EV_AMENITY_CATEGORY = "laden";

/** Land + Elektromobilitaet direkt auf der Seite -- kein eigenes <form>,
 * die Felder gehoeren zum umschliessenden <form> in campingplaetze/page.tsx
 * (zusammen mit den "weiteren Filtern" aus filter-form.tsx), damit ein
 * einziger Submit alle aktiven Filter gemeinsam anwendet. */
export function CampsiteQuickFilters({
  filters,
  countries,
  amenityCatalog,
}: {
  filters: CampsiteFilters;
  countries: string[];
  amenityCatalog: CoreAmenity[];
}) {
  const evAmenities = amenityCatalog.filter((a) => a.category === EV_AMENITY_CATEGORY && a.value_type === "bool");

  return (
    <div className="flex flex-col gap-5 text-sm">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          Land
          <select
            name="country"
            defaultValue={filters.country ?? ""}
            className="min-h-12 rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Alle</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          Lademöglichkeit
          <select
            name="charging"
            defaultValue={filters.charging ?? ""}
            className="min-h-12 rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Egal</option>
            <option value="on_site">Auf dem Platz</option>
            <option value="walking">Fußläufig erreichbar</option>
          </select>
        </label>
      </div>

      {evAmenities.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Elektromobilität</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {evAmenities.map((amenity) => (
              <label key={amenity.key} className="flex min-h-11 items-center gap-2">
                <input
                  type="checkbox"
                  name={amenity.key}
                  value="1"
                  defaultChecked={filters.amenities.includes(amenity.key)}
                />
                {amenity.label_de}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover"
        >
          Filtern
        </button>
        <Link
          href="/campingplaetze"
          className="flex min-h-12 items-center rounded-md border border-black/10 px-4 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Zurücksetzen
        </Link>
      </div>
    </div>
  );
}
