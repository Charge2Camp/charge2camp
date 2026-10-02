/** Wiederholungsregeln fuer den Karten-Viewport-Abruf (/api/charge-points/viewport),
 * rein und ohne Server-Imports -- genutzt von charging-station-map-explorer.tsx.
 *
 * Voruebergehende Fehler (Rate-Limit 429, Serverfehler 5xx, Netzwerk/Timeout --
 * z. B. ein Kaltstart der Datenbank, dessen Abfrage serverseitig weiterlaeuft und
 * den Cache waermt) werden mit Wartezeit wiederholt, statt sofort "nicht aktuell"
 * zu zeigen. Dauerhafte Fehler (4xx ausser 429, z. B. 400/401) nicht. */

/** Hoechstzahl der Versuche bei HTTP-Fehlern (429/5xx). */
export const VIEWPORT_MAX_ATTEMPTS = 3;
/** Bei Netzwerkfehler/Timeout nur ein zweiter Versuch: jeder Versuch kann bis zum
 * Timeout (12 s) dauern, die Gesamtwartezeit soll nicht auf ~40 s anwachsen. */
export const VIEWPORT_MAX_ATTEMPTS_NETWORK = 2;

const BACKOFF_MS = [2000, 5000] as const;
const MAX_RETRY_AFTER_MS = 15000;

export type ViewportFailReason = "rate_limit" | "network" | "error";

/** HTTP-Status, bei dem ein weiterer Versuch sinnvoll ist. */
export function isTransientViewportStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Wartezeit in ms vor dem naechsten Versuch, oder `null`, wenn keiner mehr folgt.
 * `attemptsMade` = bisherige Versuche (>= 1). Ein numerischer Retry-After-Header
 * (Sekunden) hat Vorrang, ist aber auf 15 s begrenzt. */
export function viewportRetryDelayMs(
  attemptsMade: number,
  retryAfterHeader?: string | null,
  maxAttempts: number = VIEWPORT_MAX_ATTEMPTS
): number | null {
  if (attemptsMade >= maxAttempts) return null;
  const headerSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
  if (Number.isFinite(headerSeconds) && headerSeconds >= 0) {
    return Math.min(headerSeconds * 1000, MAX_RETRY_AFTER_MS);
  }
  return BACKOFF_MS[Math.min(attemptsMade - 1, BACKOFF_MS.length - 1)];
}

/** Ursache fuer die Anzeige, wenn alle Versuche gescheitert sind (`null` = Netzwerk/Timeout). */
export function viewportFailReasonFor(status: number | null): ViewportFailReason {
  if (status === null) return "network";
  if (status === 429) return "rate_limit";
  return "error";
}
