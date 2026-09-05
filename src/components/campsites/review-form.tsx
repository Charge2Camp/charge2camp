"use client";

import { useState } from "react";
import { addCampsiteReview } from "@/app/campingplaetze/[id]/actions";

export function CampsiteReviewForm({ campsiteId }: { campsiteId: string }) {
  const [rating, setRating] = useState(5);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        try {
          await addCampsiteReview(formData);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Bewertung konnte nicht gespeichert werden.");
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
    >
      <input type="hidden" name="campsite_id" value={campsiteId} />

      <label className="flex flex-col gap-1 text-sm">
        Bewertung
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              aria-label={`${value} Sterne`}
              className={`flex h-11 w-11 items-center justify-center text-2xl ${value <= rating ? "text-amber-500" : "text-black/20 dark:text-white/20"}`}
            >
              ★
            </button>
          ))}
        </div>
        <input type="hidden" name="rating" value={rating} />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Kommentar (optional)
        <textarea
          name="comment"
          rows={3}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        className="min-h-12 self-start rounded-md bg-emerald-600 px-4 py-3 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Bewertung abschicken
      </button>
    </form>
  );
}
