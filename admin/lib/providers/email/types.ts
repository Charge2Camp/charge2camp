/** CLAUDE.md Prinzip 3 (Provider über Adapter kapseln) -- analog zu den
 * bestehenden Routing-/Geocoding-Adaptern in src/lib/providers/ der
 * Haupt-App. Bewusst minimal (nur `send`), da bisher genau ein
 * Anwendungsfall existiert (Meldestatus-Benachrichtigung, s.
 * notify-missing-station-report.ts). */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}
