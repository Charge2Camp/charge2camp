"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error";

/** Faengt Fehler ab, die aus dem ROOT-Layout selbst kommen (extrem selten --
 * error.tsx alleine deckt das NICHT ab, da es innerhalb des Layouts haengt).
 * Muss deshalb sein eigenes <html>/<body> mitbringen, da es das komplette
 * Layout ersetzt -- entsprechend bewusst schlicht gehalten (kein Header/
 * Footer/Bottom-Tab-Bar, die ja Teil des ausgefallenen Layouts sein
 * koennten). Siehe error.tsx fuer den normalen Fall (jede andere Route). */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadError(error.message);
  // Siehe error.tsx: nur waehrend des tatsaechlich ausgeloesten Reloads
  // nichts anzeigen, sonst die normale Fehlerkarte.
  const [isReloading, setIsReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    if (isChunkError && reloadOnceForChunkError()) {
      // Siehe error.tsx: setState ueber einen Mikrotask entkoppelt
      // (react-hooks/set-state-in-effect). Der Reload ist bereits
      // ausgeloest.
      void Promise.resolve().then(() => setIsReloading(true));
      return;
    }
    Sentry.captureException(error);
  }, [error, isChunkError]);

  if (isReloading) {
    return (
      <html lang="de">
        <body />
      </html>
    );
  }

  return (
    <html lang="de">
      <body>
        <div style={{ maxWidth: 420, margin: "80px auto", padding: "0 16px", textAlign: "center" }}>
          <p style={{ fontSize: 32 }} aria-hidden="true">
            ⚠️
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Etwas ist schiefgelaufen</h1>
          <p style={{ fontSize: 14, color: "#666", marginTop: 8 }}>
            Es gab einen unerwarteten Fehler. Bitte versuche es erneut.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              minHeight: 44,
              padding: "8px 16px",
              borderRadius: 6,
              background: "#C6F24E",
              color: "#0F3B36",
              fontSize: 14,
              fontWeight: 500,
              border: "none",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
