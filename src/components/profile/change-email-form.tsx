"use client";

import { useState } from "react";
import { changeEmail } from "@/app/profil/actions";

/** Extrahiert aus profil/daten/page.tsx (Nutzerwunsch: Server Action darf
 * nicht mehr direkt als `<form action={changeEmail}>` in einem Server
 * Component haengen -- ohne eigene Fehleranzeige wuerde ein Fehlschlag
 * (z. B. E-Mail bereits vergeben) die Seite auf eine leere, generische
 * Next.js-Fehlerseite abstuerzen lassen, siehe changeEmail()/ActionResult). */
export function ChangeEmailForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte.
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSuccess(false);
        setPending(true);
        try {
          const result = await changeEmail(formData);
          if (result.ok) {
            setSuccess(true);
          } else {
            setError(result.error);
          }
        } finally {
          setPending(false);
        }
      }}
      className="mt-2 flex max-w-md flex-col gap-2 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Neue E-Mail-Adresse
        <input
          type="email"
          name="email"
          required
          placeholder="neue@adresse.de"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
        {error && <span className="text-sm text-error">{error}</span>}
        {success && (
          <span className="text-sm text-route">
            Bestätigungslink wurde verschickt -- bitte E-Mail(s) prüfen.
          </span>
        )}
      </label>
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Wird geändert…" : "Ändern"}
      </button>
    </form>
  );
}
