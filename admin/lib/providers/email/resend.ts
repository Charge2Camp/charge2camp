import type { EmailMessage, EmailProvider } from "./types";

// Kostenoptimierung (CLAUDE.md Prinzip 4): Resend bietet einen kostenlosen
// Tarif (3000 E-Mails/Monat, Stand 2026, keine Kreditkarte nötig) mit
// einfacher REST-API ohne SMTP-Konfiguration -- ausreichend fürs MVP-
// Meldevolumen. Absenderadresse per Env-Variable, damit sie sich nach
// Domain-Verifizierung bei Resend ohne Code-Änderung umstellen lässt.
const FROM_ADDRESS = process.env.NOTIFICATION_EMAIL_FROM ?? "charge2camp <onboarding@resend.dev>";

export function createResendEmailProvider(apiKey: string): EmailProvider {
  return {
    async send(message: EmailMessage) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: message.to,
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend-API-Fehler (${res.status}): ${body}`);
      }
    },
  };
}
