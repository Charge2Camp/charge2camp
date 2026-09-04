"use client";

import { useState } from "react";
import { addChargingReview } from "@/app/ladepunkte/[id]/actions";

export function ChargingReviewForm({
  stationId,
  defaultTrailerLengthM,
  defaultTrailerWidthM,
  defaultCaravanModel,
}: {
  stationId: string;
  defaultTrailerLengthM?: number;
  defaultTrailerWidthM?: number;
  defaultCaravanModel?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await addChargingReview(formData);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Bewertung konnte nicht gespeichert werden.");
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <input type="hidden" name="charging_station_id" value={stationId} />

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1 font-medium">
          Ist dieser Ladepunkt mit deinem Gespann nutzbar?
        </legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="suitable" value="yes" defaultChecked required />
          Ja
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="suitable" value="limited" />
          Mit Einschränkungen
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="suitable" value="no" />
          Nein
        </label>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Gespannlänge (m)
          <input
            name="trailer_length_m"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultTrailerLengthM}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Gespannbreite (m)
          <input
            name="trailer_width_m"
            type="number"
            step="0.01"
            min="0"
            defaultValue={defaultTrailerWidthM}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Wohnwagenmodell (optional)
        <input
          name="caravan_model"
          defaultValue={defaultCaravanModel}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Kommentar (optional)
        <textarea
          name="comment"
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="self-start rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Bewertung abschicken
      </button>
    </form>
  );
}
