"use client";

import { useEffect } from "react";
import { isChunkLoadError, reloadOnceForChunkError } from "@/lib/chunk-error";

/**
 * Faengt "stale chunk"-Fehler NACH einem Deploy ab, die NICHT ueber React's
 * Error Boundaries (error.tsx) laufen -- ein fehlgeschlagenes
 * <script type="module">-Nachladen feuert nur ein window "error"-Event
 * (Capture-Phase, da Ressourcenfehler nicht bubbeln) bzw. bei
 * dynamischem import() eine "unhandledrejection". Siehe lib/chunk-error.ts
 * fuer den Hintergrund. Rendert nichts -- reiner Seiteneffekt, deshalb im
 * Root-Layout einmalig gemountet statt pro Route.
 */
export function ChunkErrorListener() {
  useEffect(() => {
    function handleError(event: ErrorEvent | Event) {
      const message =
        event instanceof ErrorEvent
          ? event.message
          : (event.target as HTMLScriptElement | null)?.src
            ? "Failed to load module script"
            : null;
      if (isChunkLoadError(message)) reloadOnceForChunkError();
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = typeof reason === "string" ? reason : reason?.message;
      if (isChunkLoadError(message)) reloadOnceForChunkError();
    }

    window.addEventListener("error", handleError, true);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError, true);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
