"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSavedRoute } from "@/app/profil/actions";

/** Extrahiert aus profil/routen/page.tsx (Nutzerwunsch: Server Action darf
 * nicht mehr direkt als `<form action={deleteSavedRoute}>` in einem Server
 * Component haengen -- ohne eigene Fehleranzeige wuerde ein Fehlschlag die
 * Seite auf eine leere, generische Next.js-Fehlerseite abstuerzen lassen,
 * siehe deleteSavedRoute()/ActionResult). */
export function DeleteSavedRouteButton({ id, routeName }: { id: string; routeName: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await deleteSavedRoute(id);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="flex min-h-11 items-center px-2 text-red-600 hover:underline disabled:opacity-50"
        aria-label={`Route "${routeName}" entfernen`}
      >
        Entfernen
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
