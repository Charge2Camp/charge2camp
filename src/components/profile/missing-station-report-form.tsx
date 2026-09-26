"use client";

import { useRef, useState } from "react";
import { reportMissingStation } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Nach demselben Muster wie change-email-form.tsx: lokaler useState fuer
 * error/success statt useActionState, da reportMissingStation dem
 * ActionResult-Konventions-Rueckgabewert folgt (siehe lib/action-result.ts). */
export function MissingStationReportForm() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // UX-Audit (2026-09-24): kein Pending-Zustand -- Doppel-Tap-Schutz fehlte.
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        setSuccess(false);
        setPending(true);
        try {
          const result = await reportMissingStation(formData);
          if (result.ok) {
            setSuccess(true);
            formRef.current?.reset();
          } else {
            setError(result.error);
          }
        } finally {
          setPending(false);
        }
      }}
      ref={formRef}
      className="flex max-w-md flex-col gap-3"
    >
      <Field label="Google-Maps-Link zur Ladestation">
        <Input type="url" name="google_maps_url" required placeholder="https://maps.app.goo.gl/…" />
      </Field>
      <Field label="Notiz (optional)">
        <Textarea
          name="notes"
          rows={3}
          placeholder="z. B. Name/Betreiber, wie man hinkommt, ob Anhänger durchfahren kann…"
        />
      </Field>
      {error && <FormError className="text-sm">{error}</FormError>}
      {success && (
        // UX-05.7 (docs/design/ux-problems.md): keine Push-/E-Mail-
        // Benachrichtigung bei Statusaenderung -- ehrlich statt still
        // ("Fehler sagen, was passiert ist", brand-guide.md §8), damit
        // niemand auf eine Rueckmeldung wartet, die nie kommt.
        <p className="text-sm text-route">
          Danke! Deine Meldung wird geprüft. Den Status siehst du weiter unten, sobald du diese Seite
          erneut besuchst -- es gibt noch keine Benachrichtigung per E-Mail oder Push.
        </p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Wird gemeldet…" : "Melden"}
      </Button>
    </form>
  );
}
