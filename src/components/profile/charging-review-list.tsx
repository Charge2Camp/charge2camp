"use client";

import { useState } from "react";
import Link from "next/link";
import { deleteChargingReview, updateChargingReview } from "@/app/profil/actions";
import { CriterionField } from "@/components/charging-stations/criterion-field";
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
  const [suitable, setSuitable] = useState(review.suitable);
  const [decoupledParkingPossible, setDecoupledParkingPossible] = useState(
    review.decoupled_parking_possible === true
      ? "yes"
      : review.decoupled_parking_possible === false
        ? "no"
        : ""
  );
  const criterionDefault = (value: boolean | null) => (value === true ? "yes" : value === false ? "no" : "");
  const [enoughSpaceForRig, setEnoughSpaceForRig] = useState(criterionDefault(review.enough_space_for_rig));
  const [unobstructedAccess, setUnobstructedAccess] = useState(criterionDefault(review.unobstructed_access));
  const [noBarrierOrGarage, setNoBarrierOrGarage] = useState(criterionDefault(review.no_barrier_or_garage));
  const [sideMountedCharger, setSideMountedCharger] = useState(criterionDefault(review.side_mounted_charger));

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
          <input
            type="radio"
            name="suitable"
            value="yes"
            checked={suitable === "yes"}
            onChange={() => setSuitable("yes")}
          />
          Ja
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="limited"
            checked={suitable === "limited"}
            onChange={() => setSuitable("limited")}
          />
          Mit Einschränkungen
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="no"
            checked={suitable === "no"}
            onChange={() => setSuitable("no")}
          />
          Nein
        </label>
      </fieldset>

      {suitable === "limited" && (
        <fieldset className="flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <legend className="mb-1">
            Wohnwagen abkoppelbar &amp; bequem in der Nähe parkbar während des Ladens?
          </legend>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="yes"
              checked={decoupledParkingPossible === "yes"}
              onChange={() => setDecoupledParkingPossible("yes")}
            />
            Ja
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="no"
              checked={decoupledParkingPossible === "no"}
              onChange={() => setDecoupledParkingPossible("no")}
            />
            Nein
          </label>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 rounded-md border border-black/10 p-3 dark:border-white/10">
        <p className="text-sm font-medium">Details zur Durchfahrt</p>
        <CriterionField
          name="enough_space_for_rig"
          label="Genug Platz für Zugfahrzeug + Wohnwagen (ca. ab 15 m)?"
          value={enoughSpaceForRig}
          onChange={setEnoughSpaceForRig}
        />
        <CriterionField
          name="unobstructed_access"
          label="Freie Rangierfläche ohne Hindernisse?"
          value={unobstructedAccess}
          onChange={setUnobstructedAccess}
        />
        <CriterionField
          name="no_barrier_or_garage"
          label="Kein Parkhaus / keine Schranke?"
          value={noBarrierOrGarage}
          onChange={setNoBarrierOrGarage}
        />
        <CriterionField
          name="side_mounted_charger"
          label="Ladesäule seitlich mit ausreichender Kabellänge?"
          value={sideMountedCharger}
          onChange={setSideMountedCharger}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Gespannlänge (m)
          <input
            name="trailer_length_m"
            type="number"
            step="0.01"
            min="0"
            defaultValue={review.trailer_length_m ?? ""}
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
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
            className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Wohnwagenmodell
        <input
          name="caravan_model"
          defaultValue={review.caravan_model ?? ""}
          className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

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
                  className="font-medium text-route hover:underline"
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
              {review.suitable === "limited" && review.decoupled_parking_possible !== null && (
                <p className="mt-1 text-black/60 dark:text-white/60">
                  Wohnwagen abkoppeln &amp; in der Nähe parken:{" "}
                  {review.decoupled_parking_possible ? "möglich" : "nicht möglich"}
                </p>
              )}
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
                <form action={deleteChargingReview}>
                  <input type="hidden" name="id" value={review.id} />
                  <input
                    type="hidden"
                    name="charging_station_id"
                    value={review.charging_station_id}
                  />
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
