"use client";

import { useState } from "react";
import { changeEmail } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      <Field label="Neue E-Mail-Adresse" className="flex-1">
        <Input type="email" name="email" required placeholder="neue@adresse.de" />
        {error && <FormError className="text-sm">{error}</FormError>}
        {success && (
          <span className="text-sm text-route">
            Bestätigungslink wurde verschickt -- bitte E-Mail(s) prüfen.
          </span>
        )}
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Wird geändert…" : "Ändern"}
      </Button>
    </form>
  );
}
