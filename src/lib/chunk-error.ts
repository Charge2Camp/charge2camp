/**
 * Erkennt und behandelt "stale chunk" Fehler: der Browser hat eine Seite
 * geladen, WAEHREND das noch von einem AELTEREN Deploy war, und versucht
 * danach (z. B. beim Oeffnen eines Bottom-Sheets/einer Modal-Route), einen
 * JS-Chunk mit dem alten Content-Hash nachzuladen -- den gibt es auf dem
 * CDN seit dem naechsten Deploy nicht mehr, der Server antwortet mit der
 * HTML-Fehlerseite statt JavaScript ("Failed to load module script: ...
 * non-JavaScript MIME type text/html"). Alles, was von diesem Modul
 * abhaengt, schlaegt dadurch scheinbar zufaellig fehl (z. B. ein einzelner
 * Bewertungs-Fetch im Bottom-Sheet), obwohl die eigentliche API/DB-Abfrage
 * gar kein Problem hat (Nutzerfeedback 2026-09-30, .../ladepunkte).
 *
 * Fix ist ein einfacher, einmaliger Hard-Reload -- danach laedt der Browser
 * die aktuelle HTML-Seite mit den aktuellen Chunk-Referenzen. Der Reload
 * wird ueber sessionStorage auf EINEN Versuch pro Zeitfenster begrenzt,
 * damit ein echter (wiederkehrender) Serverfehler nicht in eine
 * Reload-Schleife laeuft, sondern stattdessen normal in error.tsx landet.
 */

const STORAGE_KEY = "c2c:chunk-error-reload-at";
const RETRY_WINDOW_MS = 10_000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to load module script/i,
  /Loading chunk [\d\w-]+ failed/i,
  /Loading CSS chunk [\d\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /ChunkLoadError/i,
];

export function isChunkLoadError(message: string | null | undefined): boolean {
  if (!message) return false;
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Loest genau einmal pro RETRY_WINDOW_MS einen Hard-Reload aus. Gibt true
 * zurueck, wenn der Reload ausgeloest wurde (Aufrufer sollte dann nichts
 * weiter tun/rendern), false, wenn bereits kuerzlich versucht wurde (dann
 * normal weiter zur Fehleranzeige, siehe error.tsx/global-error.tsx).
 */
export function reloadOnceForChunkError(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const lastAttempt = Number(window.sessionStorage.getItem(STORAGE_KEY) ?? "0");
    if (Date.now() - lastAttempt < RETRY_WINDOW_MS) return false;
    window.sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // sessionStorage kann in restriktiven Kontexten (z. B. privates
    // Surfen mit deaktiviertem Storage) werfen -- dann ohne Schleifenschutz
    // einmalig neu laden ist immer noch besser als eine kaputte Seite.
  }
  window.location.reload();
  return true;
}
