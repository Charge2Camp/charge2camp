/**
 * Discriminiertes Ergebnisobjekt fuer "use server"-Funktionen, die von einer
 * "use client"-Komponente per Netzwerkaufruf (RPC-Grenze) aufgerufen werden
 * -- anders als ein normaler Funktionsaufruf innerhalb eines Server
 * Components redaktiert Next.js dabei JEDE geworfene Error-Message in der
 * Produktion zu einer generischen, fuer Nutzer nutzlosen Meldung
 * ("Minified React error #441", siehe Bugreport). Erwartete Fehler (falsche
 * Eingabe, fehlende Berechtigung, DB-Constraint, ...) werden deshalb NICHT
 * geworfen, sondern als Ergebniswert zurueckgegeben -- so bleibt die
 * hilfreiche deutsche Fehlermeldung fuer den Nutzer sichtbar. Ohne `T`
 * (reine Erfolg/Fehler-Aktionen wie Loeschen) einfach `ActionResult` ohne
 * Typparameter verwenden (T ist dann void).
 */
export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export function actionErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
