"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteCampsiteReview, updateCampsiteReview } from "@/app/profil/actions";
import type { CampsiteReview } from "@/types/database";

export type CampsiteReviewWithCampsite = CampsiteReview & {
  campsites: { id: string; name: string } | null;
};

function EditForm({ review, onCancel }: { review: CampsiteReviewWithCampsite; onCancel: () => void }) {
  const [chargingOnSite, setChargingOnSite] = useState(review.charging_on_site);
  const [chargingWalkable, setChargingWalkable] = useState(review.charging_walkable);

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

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Laden auf dem Platz möglich?</legend>
        <div className="flex gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_on_site"
              value="yes"
              checked={chargingOnSite}
              onChange={() => setChargingOnSite(true)}
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_on_site"
              value="no"
              checked={!chargingOnSite}
              onChange={() => setChargingOnSite(false)}
            />
            Nein
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Nutzbare Ladelösung fußläufig erreichbar?</legend>
        <div className="flex gap-4">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_walkable"
              value="yes"
              checked={chargingWalkable}
              onChange={() => setChargingWalkable(true)}
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="charging_walkable"
              value="no"
              checked={!chargingWalkable}
              onChange={() => setChargingWalkable(false)}
            />
            Nein
          </label>
        </div>
      </fieldset>

      <textarea
        name="comment"
        rows={2}
        defaultValue={review.comment ?? ""}
        className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
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
                  className="font-medium text-route hover:underline"
                >
                  {review.campsites?.name ?? "Campingplatz"}
                </Link>
                <span>★ {review.rating}/5</span>
              </div>
              <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                Laden auf dem Platz: {review.charging_on_site ? "ja" : "nein"} · Fußläufig nutzbar:{" "}
                {review.charging_walkable ? "ja" : "nein"}
              </p>
              {review.comment && (
                <p className="mt-1 text-black/70 dark:text-white/70">{review.comment}</p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingId(review.id)}
                  className="flex min-h-11 items-center px-2 -mx-2 text-route hover:underline"
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
