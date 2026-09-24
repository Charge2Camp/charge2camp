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

/**
 * UX-Audit (2026-09-24): Supabase-Auth-Fehler (`supabase.auth.*`) und rohe
 * Postgres-Constraint-Meldungen (z. B. "duplicate key value violates unique
 * constraint ...") sind IMMER Englisch/technisch -- ohne Uebersetzung landen
 * sie unveraendert in dieser durchgehend deutschsprachigen App (ueber
 * `error.message` in login/register/passwort-zuruecksetzen sowie ueber
 * actionErrorMessage() in praktisch jeder Server Action). Absichtlich vom
 * Nutzer selbst geworfene Meldungen (`throw new Error("Pflichtfeld fehlt.")`
 * usw., bereits Deutsch) matchen keines der Muster unten und bleiben
 * deshalb unveraendert -- diese Funktion uebersetzt NUR bekannte
 * Roh-Meldungen, nie eine bereits deutsche.
 */
const KNOWN_ERROR_TRANSLATIONS: { pattern: RegExp; german: string }[] = [
  { pattern: /invalid login credentials/i, german: "E-Mail oder Passwort ist falsch." },
  { pattern: /user already registered/i, german: "Für diese E-Mail-Adresse besteht bereits ein Konto." },
  { pattern: /email not confirmed/i, german: "Bitte bestätige zuerst deine E-Mail-Adresse (Link in der Bestätigungs-E-Mail)." },
  { pattern: /password should be at least (\d+) characters?/i, german: "Das Passwort ist zu kurz (mindestens $1 Zeichen)." },
  { pattern: /unable to validate email address/i, german: "Bitte eine gültige E-Mail-Adresse eingeben." },
  { pattern: /email address .* is invalid/i, german: "Bitte eine gültige E-Mail-Adresse eingeben." },
  {
    pattern: /for security purposes, you can only request this after (\d+) seconds?/i,
    german: "Aus Sicherheitsgründen bitte $1 Sekunden warten und erneut versuchen.",
  },
  { pattern: /new password should be different from the old password/i, german: "Das neue Passwort muss sich vom alten unterscheiden." },
  { pattern: /email rate limit exceeded/i, german: "Zu viele Versuche -- bitte später erneut versuchen." },
  { pattern: /token has expired or is invalid/i, german: "Der Link ist abgelaufen oder ungültig." },
  { pattern: /jwt expired/i, german: "Sitzung abgelaufen -- bitte erneut anmelden." },
  { pattern: /duplicate key value violates unique constraint/i, german: "Diesen Eintrag gibt es bereits." },
  { pattern: /violates foreign key constraint/i, german: "Ungültige Referenz -- bitte Seite neu laden und erneut versuchen." },
  { pattern: /violates row-level security policy/i, german: "Keine Berechtigung für diese Aktion." },
  { pattern: /network ?error|fetch failed|failed to fetch/i, german: "Keine Verbindung -- bitte Internetverbindung prüfen und erneut versuchen." },
];

export function translateErrorMessage(message: string): string {
  for (const { pattern, german } of KNOWN_ERROR_TRANSLATIONS) {
    const match = message.match(pattern);
    if (match) return german.replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? "");
  }
  return message;
}

export function actionErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  return translateErrorMessage(err.message);
}
