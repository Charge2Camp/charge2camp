"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteCampsiteReview, updateCampsiteReview } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import type { CampsiteReview } from "@/types/database";

export type CampsiteReviewWithCampsite = CampsiteReview & {
  campsites: { id: string; name: string } | null;
};

function formatReviewMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { month: "short", year: "numeric" });
}

function EditForm({ review, onCancel }: { review: CampsiteReviewWithCampsite; onCancel: () => void }) {
  const [chargingOnSite, setChargingOnSite] = useState(review.charging_on_site);
  const [chargingWalkable, setChargingWalkable] = useState(review.charging_walkable);
  const [error, setError] = useState<string | null>(null);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte
  // (anders als der Loeschen-Button unten in CampsiteReviewList, der bereits
  // pendingDeleteId korrekt nutzt).
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setPending(true);
        try {
          const result = await updateCampsiteReview(formData);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onCancel();
        } finally {
          setPending(false);
        }
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
        className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
      />

      {error && <FormError className="text-sm">{error}</FormError>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-60"
        >
          {pending ? "Wird gespeichert…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-11 rounded-md border border-black/10 px-4 py-2 text-sm disabled:opacity-60 dark:border-white/10"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}

export function CampsiteReviewList({ reviews }: { reviews: CampsiteReviewWithCampsite[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Sichtbarer Bestand wird aus dem `reviews`-Prop abgeleitet (minus gerade
  // geloeschter IDs), kein separater useState-Zwischenspeicher -- damit
  // zeigt z. B. eine erfolgreiche Bearbeitung (updateCampsiteReview loest
  // per revalidatePath ein Server-Component-Re-Render mit frischem Prop
  // aus) sofort den neuen Inhalt, statt auf einen veralteten lokalen Stand
  // "eingefroren" zu bleiben.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [deleteErrorById, setDeleteErrorById] = useState<Record<string, string>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const items = reviews.filter((r) => !removedIds.has(r.id));

  function handleDelete(review: CampsiteReviewWithCampsite) {
    setPendingDeleteId(review.id);
    setDeleteErrorById((prev) => {
      const next = { ...prev };
      delete next[review.id];
      return next;
    });
    startTransition(async () => {
      const result = await deleteCampsiteReview(review.id, review.campsite_id);
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
        Noch keine Campingplatz-Bewertungen abgegeben.
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
                  href={review.campsites ? `/campingplaetze/${review.campsites.id}` : "#"}
                  className="flex min-h-11 items-center font-medium text-route hover:underline"
                >
                  {review.campsites?.name ?? "Campingplatz"}
                </Link>
                <span>★ {review.rating}/5</span>
              </div>
              <p className="text-xs text-text-muted">{formatReviewMonth(review.created_at)}</p>
              <p className="mt-1 text-xs text-text-muted">
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
