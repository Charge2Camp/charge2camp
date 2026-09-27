import { getEmailProvider } from "@/lib/providers/email";

/** UX-05.7 (docs/design/ux-problems.md, Haupt-App): bisher gab es keine
 * aktive Rückmeldung, wenn eine gemeldete Ladesäule geprüft wurde --
 * Nutzer sahen den Status nur bei erneutem Besuch von
 * /profil/fehlende-saeule. Wird aus beiden Moderations-Aktionen
 * (approve/reject in fehlende-saeulen/actions.ts bzw. [reportId]/actions.ts)
 * aufgerufen, NACH dem erfolgreichen Status-Update -- ein Fehler beim
 * Mailversand (z. B. Resend-API down) darf die eigentliche Moderations-
 * Aktion nicht rückgängig machen oder blockieren, deshalb bewusst
 * fehlertolerant (s. Aufrufer: try/catch um den Aufruf, nicht hier). */
export async function notifyMissingStationReportDecision(params: {
  email: string;
  googleMapsUrl: string;
  status: "approved" | "rejected";
}) {
  const provider = getEmailProvider();
  const subject =
    params.status === "approved"
      ? "Deine gemeldete Ladesäule wurde eingepflegt"
      : "Deine Meldung bei charge2camp wurde geprüft";
  const text =
    params.status === "approved"
      ? `Danke für deine Meldung!\n\nDie von dir gemeldete Ladesäule ist jetzt in charge2camp eingepflegt und für alle sichtbar:\n${params.googleMapsUrl}\n\nDu kannst deine Meldungen jederzeit unter "Mein Profil" -> "Fehlende Ladesäule melden" einsehen.`
      : `Deine Meldung zu dieser Ladesäule wurde geprüft:\n${params.googleMapsUrl}\n\nSie konnte diesmal nicht übernommen werden -- zum Beispiel, weil die Station bereits erfasst ist oder sich die Angaben nicht eindeutig zuordnen ließen. Danke trotzdem fürs Mitmachen! Du kannst jederzeit eine neue Meldung mit mehr Details abschicken.`;
  await provider.send({ to: params.email, subject, text });
}
