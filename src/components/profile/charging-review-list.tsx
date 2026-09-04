"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteChargingReview, updateChargingReview } from "@/app/profil/actions";
import type { ChargingReview } from "@/types/database";

export type ChargingReviewWithStation = ChargingReview & {
  charging_stations: { id: string; name: string | null; provider: string } | null;
};

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

function EditForm({
  review,
  onCancel,
}: {
  review: ChargingReviewWithStation;
  onCancel: () => void;
}) {
  return (
    <form
      action={async (formData) => {
        await updateChargingReview(formData);
        onCancel();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={review.id} />
      <input type="hidden" name="charging_station_id" value={review.charging_station_id} />

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Gespann nutzbar?</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="suitable" value="yes" defaultChecked={review.suitable === "yes"} />
          Ja
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="limited"
            defaultChecked={review.suitable === "limited"}
          />
          Mit Einschränkungen
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="suitable" value="no" defaultChecked={review.suitable === "no"} />
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
            defaultValue={review.trailer_length_m ?? ""}
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
            defaultValue={review.trailer_width_m ?? ""}
            className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Wohnwagenmodell
        <input
          name="caravan_model"
          defaultValue={review.caravan_model ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 dark:border-white/15 dark:bg-transparent"
        />
      </label>

      <textarea
        name="comment"
        rows={2}
        defaultValue={review.comment ?? ""}
        className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15 dark:bg-transparent"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Speichern
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-black/10 px-3 py-1.5 text-sm dark:border-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export function ChargingReviewList({ reviews }: { reviews: ChargingReviewWithStation[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (reviews.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Noch keine Ladepunkt-Bewertungen abgegeben.
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
                  href={review.charging_stations ? `/ladepunkte/${review.charging_stations.id}` : "#"}
                  className="font-medium text-emerald-600 hover:underline"
                >
                  {review.charging_stations?.name ?? review.charging_stations?.provider ?? "Ladepunkt"}
                </Link>
                <span>{SUITABLE_LABELS[review.suitable]}</span>
              </div>
              <p className="mt-1 text-black/60 dark:text-white/60">
                {review.trailer_length_m && `${review.trailer_length_m} m`}
                {review.trailer_width_m && ` × ${review.trailer_width_m} m`}
                {review.caravan_model && ` · ${review.caravan_model}`}
              </p>
              {review.comment && (
                <p className="mt-1 text-black/70 dark:text-white/70">{review.comment}</p>
              )}
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingId(review.id)}
                  className="text-emerald-600 hover:underline"
                >
                  Bearbeiten
                </button>
                <form action={deleteChargingReview}>
                  <input type="hidden" name="id" value={review.id} />
                  <input
                    type="hidden"
                    name="charging_station_id"
                    value={review.charging_station_id}
                  />
                  <button type="submit" className="text-red-600 hover:underline">
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
