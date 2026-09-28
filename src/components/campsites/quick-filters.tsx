"use client";

import { FilterChip } from "@/components/charging-stations/filter-chip";
import { WheelPickerField, type WheelPickerOption } from "@/components/ui/wheel-picker";
import { EV_SCORE_MIN_OPTIONS } from "@/lib/campsite-filters";
import type { CampsiteFilters } from "@/lib/campsites";
import type { CoreAmenity } from "@/types/database";

/** Die Elektromobilitaets-Merkmale aus core.amenity (Kategorie "laden") --
 * fuer diese Zielgruppe (Camper mit E-Auto) die wichtigste Frage ueberhaupt,
 * deshalb bewusst nicht im "Weitere Filter"-Pop-up versteckt, sondern direkt
 * sichtbar (siehe Kommentar in campingplaetze/page.tsx). */
const EV_AMENITY_CATEGORY = "laden";

const EV_SCORE_OPTIONS: WheelPickerOption<number>[] = EV_SCORE_MIN_OPTIONS.map((v) => ({
  label: v === 0 ? "Kein Minimum" : `≥ ${v}`,
  value: v,
}));

/** Stufen fuer die EV-Camping-Tauglichkeit (Community-Bewertung, core.
 * campsite_search.rating_avg) -- deriveCampsiteRating() liefert nur 1, 3, 4
 * oder 5 Sterne (nie 2), die Stufen orientieren sich daran. */
const RATING_MIN_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: "≥ 3 ★" },
  { value: 4, label: "≥ 4 ★" },
  { value: 5, label: "5 ★" },
];

/** Kernfilter der Campingplatzsuche, direkt auf der Seite sichtbar (kein
 * Formular-Submit mehr, siehe campsite-search-client.tsx applyFilters) --
 * jede Aenderung wirkt sofort, Karte/Liste passen sich live an, wie in der
 * Routenplanung/Ladepunkte-Suche. Reihenfolge nach Nutzeranfrage: Land,
 * Lademoeglichkeit, EV-Score, EV-Camping-Tauglichkeit, dann die uebrigen
 * Elektromobilitaets-Merkmale. */
export function CampsiteQuickFilters({
  filters,
  onChange,
  countries,
  amenityCatalog,
}: {
  filters: CampsiteFilters;
  onChange: (patch: Partial<CampsiteFilters>) => void;
  countries: string[];
  amenityCatalog: CoreAmenity[];
}) {
  const evAmenities = amenityCatalog.filter((a) => a.category === EV_AMENITY_CATEGORY && a.value_type === "bool");

  function toggleAmenity(key: string) {
    const next = filters.amenities.includes(key)
      ? filters.amenities.filter((k) => k !== key)
      : [...filters.amenities, key];
    onChange({ amenities: next });
  }

  function toggleCharging(value: NonNullable<CampsiteFilters["charging"]>) {
    onChange({ charging: filters.charging === value ? undefined : value });
  }

  function toggleRatingMin(value: number) {
    onChange({ ratingMin: filters.ratingMin === value ? undefined : value });
  }

  return (
    <div className="flex flex-col gap-5 text-sm">
      <label className="flex flex-col gap-1 sm:max-w-xs">
        Land
        <select
          value={filters.country ?? ""}
          onChange={(e) => onChange({ country: e.target.value || undefined })}
          className="min-h-12 rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        >
          <option value="">Alle</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-medium">Lademöglichkeit</legend>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="Auf dem Platz"
            active={filters.charging === "on_site"}
            onClick={() => toggleCharging("on_site")}
          />
          <FilterChip
            label="AC fußläufig"
            active={filters.charging === "ac_walk"}
            onClick={() => toggleCharging("ac_walk")}
          />
          <FilterChip
            label="DC fußläufig"
            active={filters.charging === "dc_walk"}
            onClick={() => toggleCharging("dc_walk")}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="max-w-[14rem]">
          <WheelPickerField
            label="Mindest-EV-Score"
            options={EV_SCORE_OPTIONS}
            value={filters.evScoreMin ?? 0}
            onChange={(v) => onChange({ evScoreMin: v || undefined })}
          />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">EV-Camping-Tauglichkeit</legend>
          <div className="flex flex-wrap gap-2">
            {RATING_MIN_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                label={option.label}
                active={filters.ratingMin === option.value}
                onClick={() => toggleRatingMin(option.value)}
              />
            ))}
          </div>
        </fieldset>
      </div>

      {evAmenities.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">Elektromobilität</legend>
          <div className="flex flex-wrap gap-2">
            {evAmenities.map((amenity) => (
              <FilterChip
                key={amenity.key}
                label={amenity.label_de}
                active={filters.amenities.includes(amenity.key)}
                onClick={() => toggleAmenity(amenity.key)}
              />
            ))}
          </div>
        </fieldset>
      )}
    </div>
  );
}
