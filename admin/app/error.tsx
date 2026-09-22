"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

/** Sicherheitsnetz fuer JEDE Route der Admin-App (analog src/app/error.tsx
 * der Haupt-App) -- bisher gab es hier gar keine error.tsx, ein
 * unerwarteter Fehler fiel auf Next.js' unstyled Standard-Fehlerseite
 * zurueck. error.tsx MUSS laut Next.js ein Client Component sein. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⚠️
      </p>
      <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Es gab einen unerwarteten Fehler. Bitte versuche es erneut oder geh zum Dashboard zurück.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="min-h-11 rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
        >
          Erneut versuchen
        </button>
        <Link
          href="/"
          className="flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 py-2 text-sm dark:border-white/15"
        >
          Zum Dashboard
        </Link>
      </div>
    </div>
  );
}
