"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteChargingReview, updateChargingReview } from "@/app/profil/actions";
import { CriterionField } from "@/components/charging-stations/criterion-field";
import { FormError } from "@/components/form-error";
import type { ChargingReview } from "@/types/database";

export type ChargingReviewWithStation = ChargingReview & {
  charging_stations: { id: string; name: string | null; operator: string | null } | null;
};

const SUITABLE_LABELS = { yes: "Ja", limited: "Mit Einschränkungen", no: "Nein" } as const;

function formatReviewMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

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
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await updateChargingReview(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onCancel();
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="id" value={review.id} />
      <input type="hidden" name="charging_station_id" value={review.charging_station_id} />

      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="mb-1">Gespann nutzbar?</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="yes"
            checked={suitable === "yes"}
            onChange={() => setSuitable("yes")}
          />
          Ja
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="suitable"
            value="limited"
            checked={suitable === "limited"}
            onChange={() => setSuitable("limited")}
          />
          Mit Einschränkungen
        </label>
        <label className="flex min-h-11 items-center gap-2">
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
        <fieldset className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          <legend className="mb-1">
            Wohnwagen abkoppelbar &amp; bequem in der Nähe parkbar während des Ladens?
          </legend>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              name="decoupled_parking_possible"
              value="yes"
              checked={decoupledParkingPossible === "yes"}
              onChange={() => setDecoupledParkingPossible("yes")}
            />
            Ja
          </label>
          <label className="flex min-h-11 items-center gap-2">
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
          label="Genug Platz für Gespann?"
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
          label="Kabel an Säulen in ausreichender Länge?"
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
            className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
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
            className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Wohnwagenmodell
        <input
          name="caravan_model"
          defaultValue={review.caravan_model ?? ""}
          className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
      </label>

      <textarea
        name="comment"
        rows={2}
        defaultValue={review.comment ?? ""}
        className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
      />

      {error && <FormError className="text-sm">{error}</FormError>}

      <div className="flex flex-col gap-2 sm:flex-row">
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
  // Siehe Kommentar in campsite-review-list.tsx: sichtbarer Bestand wird
  // aus dem `reviews`-Prop abgeleitet (minus gerade geloeschter IDs), kein
  // separater useState-Zwischenspeicher.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deleteErrorById, setDeleteErrorById] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const items = reviews.filter((r) => !removedIds.has(r.id));

  function handleDelete(review: ChargingReviewWithStation) {
    setPendingDeleteId(review.id);
    setDeleteErrorById((prev) => {
      const next = { ...prev };
      delete next[review.id];
      return next;
    });
    startTransition(async () => {
      const result = await deleteChargingReview(review.id, review.charging_station_id);
      if (result.ok) {
        setRemovedIds((prev) => new Set(prev).add(review.id));
      } else {
        setDeleteErrorById((prev) => ({ ...prev, [review.id]: result.error }));
      }
      setPendingDeleteId(null);
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        Noch keine Ladepunkt-Bewertungen abgegeben.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((review) => (
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
                  className="flex min-h-11 items-center font-medium text-route hover:underline"
                >
                  {review.charging_stations?.name ?? review.charging_stations?.operator ?? "Ladepunkt"}
                </Link>
                <span>Anhängertauglich: {SUITABLE_LABELS[review.suitable]}</span>
              </div>
              <p className="text-xs text-text-muted">{formatReviewMonth(review.created_at)}</p>
              <p className="mt-1 text-text-muted">
                {review.trailer_length_m && `${review.trailer_length_m} m`}
                {review.trailer_width_m && ` × ${review.trailer_width_m} m`}
                {review.caravan_model && ` · ${review.caravan_model}`}
              </p>
              {review.suitable === "limited" && review.decoupled_parking_possible !== null && (
                <p className="mt-1 text-text-muted">
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
                <button
                  type="button"
                  onClick={() => handleDelete(review)}
                  disabled={pendingDeleteId === review.id}
                  className="flex min-h-11 items-center px-2 -mx-2 text-error hover:underline disabled:opacity-50"
                >
                  Löschen
                </button>
              </div>
              {deleteErrorById[review.id] && (
                <FormError className="mt-1 text-xs">{deleteErrorById[review.id]}</FormError>
              )}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
