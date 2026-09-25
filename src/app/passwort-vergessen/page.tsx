"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LegalFooterLinks } from "@/components/legal-footer-links";

/** "Passwort vergessen"-Formular (Nutzerwunsch: bisher gab es KEINE
 * Moeglichkeit, das Passwort selbst zurueckzusetzen -- wer es vergessen
 * hatte, kam gar nicht mehr ins Konto). Schickt einen Supabase-Reset-Link,
 * der ueber /auth/callback (PKCE-Code-Tausch) auf
 * /passwort-zuruecksetzen fuehrt. Bewusst IMMER dieselbe Erfolgsmeldung,
 * unabhaengig davon, ob die E-Mail tatsaechlich zu einem Konto gehoert --
 * sonst liesse sich ueber die Fehlermeldung erraten, welche E-Mail-Adressen
 * registriert sind (Enumeration). */
export default function ForgotPasswordPage() {
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/passwort-zuruecksetzen`,
    });

    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Passwort vergessen</h1>

      {submitted ? (
        <p className="text-sm text-route">
          Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde gerade ein Link zum
          Zurücksetzen des Passworts verschickt. Bitte E-Mail-Postfach prüfen.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            E-Mail
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover disabled:opacity-50"
          >
            {loading ? "Wird gesendet…" : "Link zum Zurücksetzen senden"}
          </button>
        </form>
      )}

      <p className="text-sm text-black/60 dark:text-white/60">
        <Link href="/login" className="text-route hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>

      <LegalFooterLinks />
    </div>
  );
}
