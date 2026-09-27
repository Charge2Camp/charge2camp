import type { EmailMessage, EmailProvider } from "./types";

/** Fallback, solange RESEND_API_KEY nicht gesetzt ist (CLAUDE.md Prinzip 2:
 * keine Scheindaten -- loggt statt eine E-Mail vorzutäuschen, die nie
 * ankommt; klar als [DEMO]/mock im Log erkennbar, nicht im UI sichtbar,
 * da dieser Adapter ausschließlich serverseitig in Admin-Aktionen läuft). */
export const mockEmailProvider: EmailProvider = {
  async send(message) {
    console.log(`[EMAIL:mock, kein RESEND_API_KEY gesetzt] An ${message.to}: ${message.subject}\n${message.text}`);
  },
};
