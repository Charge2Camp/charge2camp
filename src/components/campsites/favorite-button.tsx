"use client";

import { useState, useTransition } from "react";
import { toggleCampsiteFavorite } from "@/app/campingplaetze/[id]/actions";

/** Herz-Button zum Merken/Entmerken eines Campingplatzes als Favorit --
 * optimistisches Umschalten, mit Rueckfall auf den vorherigen Zustand bei
 * einem Fehler (z. B. Netzwerkproblem). */
export function CampsiteFavoriteButton({
  campsiteId,
  initialIsFavorite,
}: {
  campsiteId: string;
  initialIsFavorite: boolean;
}) {
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !isFavorite;
    setIsFavorite(next);
    startTransition(async () => {
      const result = await toggleCampsiteFavorite(campsiteId, next);
      if (!result.ok) setIsFavorite(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
      aria-pressed={isFavorite}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-black/15 text-xl leading-none disabled:opacity-50 dark:border-white/15"
    >
      <span className={isFavorite ? "text-error" : "text-black/40 dark:text-white/40"}>
        {isFavorite ? "♥" : "♡"}
      </span>
    </button>
  );
}
