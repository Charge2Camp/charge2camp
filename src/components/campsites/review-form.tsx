"use client";

import { useState } from "react";
import { addCampsiteReview } from "@/app/campingplaetze/[id]/actions";

/** Campingplatz-Bewertungen fragen bewusst nur die Lademoeglichkeit ab
 * (kein freier Sterne-Picker) -- die daraus abgeleitete Sternebewertung
 * (siehe deriveCampsiteRating() in ev-camping-score.ts) fliesst als
 * Community-Bewertungsfaktor in den EV-Camping-Score ein. */
export function CampsiteReviewForm({ campsiteId }: { campsiteId: string }) {
  const [chargingOnSite, setChargingOnSite] = useState<"yes" | "no" | "">("");
  const [chargingWalkable, setChargingWalkable] = useState<"yes" | "no" | "">("");
  const [error, setError] = useState<string | null>(null);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte.
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setPending(true);
        try {
          const result = await addCampsiteReview(formData);
          if (!result.ok) setError(result.error);
        } finally {
          setPending(false);
        }
      }}
      className="flex flex-col gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <input type="hidden" name="campsite_id" value={campsiteId} />

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Laden auf dem Platz möglich?</legend>
        <div className="flex gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_on_site"
              value="yes"
              checked={chargingOnSite === "yes"}
              onChange={() => setChargingOnSite("yes")}
              required
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_on_site"
              value="no"
              checked={chargingOnSite === "no"}
              onChange={() => setChargingOnSite("no")}
            />
            Nein
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="mb-1">Nutzbare Ladelösung fußläufig erreichbar?</legend>
        <div className="flex gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_walkable"
              value="yes"
              checked={chargingWalkable === "yes"}
              onChange={() => setChargingWalkable("yes")}
              required
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_walkable"
              value="no"
              checked={chargingWalkable === "no"}
              onChange={() => setChargingWalkable("no")}
            />
            Nein
          </label>
        </div>
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Kommentar (optional)
        <textarea
          name="comment"
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      {error && <p className="text-sm text-error">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="min-h-12 self-start rounded-md bg-action px-4 py-3 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Wird gesendet…" : "Bewertung abschicken"}
      </button>
    </form>
  );
}
