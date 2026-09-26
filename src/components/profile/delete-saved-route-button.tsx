"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteSavedRoute } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

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
      <Button
        variant="plain"
        size="link"
        onClick={handleClick}
        disabled={pending}
        className="text-error"
        aria-label={`Route "${routeName}" entfernen`}
      >
        Entfernen
      </Button>
      {error && <FormError className="text-xs">{error}</FormError>}
    </div>
  );
}
