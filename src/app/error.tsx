"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Sicherheitsnetz fuer JEDE Route (siehe Bugreport "intensive Pruefung"):
 * bisher gab es GAR KEINE error.tsx im ganzen Projekt -- ein unerwarteter,
 * nicht abgefangener Fehler (z. B. eine Server Action, die entgegen der
 * ActionResult-Konvention doch einmal wirft, oder ein echter Bug) fiel
 * direkt auf Next.js' generische, unstyled Standard-Fehlerseite zurueck,
 * ganz ohne Navigation/Weg zurueck ausser Neuladen. Diese Seite haengt
 * INNERHALB des Root-Layouts (Header/Footer/Bottom-Tab-Bar bleiben
 * sichtbar) und bietet "Erneut versuchen" (Next.js' reset(), rendert das
 * betroffene Segment neu) sowie einen Link zur Startseite. error.tsx MUSS
 * laut Next.js ein Client Component sein. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⚠️
      </p>
      <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        Es gab einen unerwarteten Fehler. Bitte versuche es erneut oder geh zur Startseite zurück.
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
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
