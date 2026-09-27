import { mockEmailProvider } from "./mock";
import { createResendEmailProvider } from "./resend";
import type { EmailProvider } from "./types";

export type { EmailProvider, EmailMessage } from "./types";

/** CLAUDE.md Prinzip 3 (Provider über Adapter kapseln): ohne gesetzten
 * RESEND_API_KEY fällt die App auf den mock-Adapter zurück (loggt statt
 * zu senden), analog zu den bestehenden Routing-/Geocoding-Adaptern in
 * src/lib/providers/ der Haupt-App ("Solange kein echter Provider
 * konfiguriert ist, liefert der mock-Adapter klar als Demo gekennzeichnete
 * Daten", docs/api.md). */
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return mockEmailProvider;
  return createResendEmailProvider(apiKey);
}
