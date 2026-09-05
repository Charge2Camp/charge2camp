"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteCampsiteReview, updateCampsiteReview } from "@/app/profil/actions";
import type { CampsiteReview } from "@/types/database";

export type CampsiteReviewWithCampsite = CampsiteReview & {
  campsites: { id: string; name: string } | null;
};

function EditForm({ review, onCancel }: { review: CampsiteReviewWithCampsite; onCancel: () => void }) {
  const [rating, setRating] = useState(review.rating);

  return (
    <form
      action={async (formData) => {
        await updateCampsiteReview(formData);
        onCancel();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={review.id} />
      <input type="hidden" name="campsite_id" value={review.campsite_id} />

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            aria-label={`${value} Sterne`}
            className={`flex h-11 w-11 items-center justify-center text-xl ${value <= rating ? "text-amber-500" : "text-black/20 dark:text-white/20"}`}
          >
            ★
          </button>
        ))}
      </div>
      <input type="hidden" name="rating" value={rating} />

      <textarea
        name="comment"
        rows={2}
        defaultValue={review.comment ?? ""}
        className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-md border border-black/10 px-4 py-2 text-sm dark:border-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export function CampsiteReviewList({ reviews }: { reviews: CampsiteReviewWithCampsite[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Noch keine Campingplatz-Bewertungen abgegeben.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10"
        >
          {editingId === review.id ? (
            <EditForm review={review} onCancel={() => setEditingId(null)} />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Link
                  href={review.campsites ? `/campingplaetze/${review.campsites.id}` : "#"}
                  className="font-medium text-emerald-600 hover:underline"
                >
                  {review.campsites?.name ?? "Campingplatz"}
                </Link>
                <span>★ {review.rating}/5</span>
              </div>
              {review.comment && (
                <p className="mt-1 text-black/70 dark:text-white/70">{review.comment}</p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingId(review.id)}
                  className="flex min-h-11 items-center px-2 -mx-2 text-emerald-600 hover:underline"
                >
                  Bearbeiten
                </button>
                <form action={deleteCampsiteReview}>
                  <input type="hidden" name="id" value={review.id} />
                  <input type="hidden" name="campsite_id" value={review.campsite_id} />
                  <button type="submit" className="flex min-h-11 items-center px-2 -mx-2 text-red-600 hover:underline">
                    Löschen
                  </button>
                </form>
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
