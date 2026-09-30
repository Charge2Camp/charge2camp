"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error";

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
  const isChunkError = isChunkLoadError(error.message);
  // Nur waehrend des tatsaechlich ausgeloesten Reloads nichts anzeigen --
  // wurde (Retry-Fenster in lib/chunk-error.ts) bereits kuerzlich versucht
  // und schlaegt der Fehler trotzdem erneut auf, soll die normale
  // Fehlerkarte erscheinen statt einer leeren Seite ohne jeden Ausweg.
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    // "Stale chunk" nach einem Deploy (siehe lib/chunk-error.ts) ist kein
    // echter Anwendungsfehler, sondern ein voruebergehender Zustand des
    // Tabs -- dafuer nicht Sentry fluten, stattdessen einmalig neu laden.
    if (isChunkError && reloadOnceForChunkError()) {
      // Wie loadExtras() in station-bottom-sheet.tsx: setState ueber einen
      // Mikrotask entkoppelt, damit es nicht synchron im Effect-Body
      // passiert (react-hooks/set-state-in-effect). window.location.reload()
      // ist bereits ausgeloest, der Wert hier blendet nur noch die
      // Fehlerkarte fuer die kurze Zeit bis zum tatsaechlichen Neuladen aus.
      void Promise.resolve().then(() => setIsReloading(true));
      return;
    }
    Sentry.captureException(error);
  }, [error, isChunkError]);

  if (isReloading) return null;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="text-4xl" aria-hidden="true">
        ⚠️
      </p>
      <h1 className="text-xl font-semibold">Etwas ist schiefgelaufen</h1>
      <p className="text-sm text-text-muted">
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
          className="flex min-h-11 items-center justify-center rounded-md border border-line-strong px-4 py-2 text-sm"
        >
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}
