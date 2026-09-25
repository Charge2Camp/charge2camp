"use client";

import { useRef, useState } from "react";
import { reportMissingStation } from "@/app/profil/actions";

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
      <label className="flex flex-col gap-1 text-sm">
        Google-Maps-Link zur Ladestation
        <input
          type="url"
          name="google_maps_url"
          required
          placeholder="https://maps.app.goo.gl/…"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Notiz (optional)
        <textarea
          name="notes"
          rows={3}
          placeholder="z. B. Name/Betreiber, wie man hinkommt, ob Anhänger durchfahren kann…"
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
        />
      </label>
      {error && <p className="text-sm text-error">{error}</p>}
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
      <button
        type="submit"
        disabled={pending}
        className="min-h-11 self-start rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Wird gemeldet…" : "Melden"}
      </button>
    </form>
  );
}
