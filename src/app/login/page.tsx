"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateErrorMessage } from "@/lib/action-result";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { FormError } from "@/components/form-error";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Fehlermeldung von /auth/callback (z. B. abgelaufener Passwort-Reset-
  // Link) als Startwert -- lokaler Fehler (falsches Passwort etc.)
  // ueberschreibt sie beim naechsten Login-Versuch ganz normal.
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(translateErrorMessage(signInError.message));
      return;
    }

    router.push(searchParams.get("redirect") || "/profil");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Anmelden</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          E-Mail
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Passwort
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
          />
        </label>

        <Link
          href="/passwort-vergessen"
          className="flex min-h-11 items-center self-end text-sm text-route hover:underline"
        >
          Passwort vergessen?
        </Link>

        {error && <FormError className="text-sm">{error}</FormError>}

        <button
          type="submit"
          disabled={loading}
          className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover disabled:opacity-50"
        >
          {loading ? "Wird angemeldet…" : "Anmelden"}
        </button>
      </form>

      <p className="text-sm text-text-muted">
        Noch kein Konto?{" "}
        <Link href="/register" className="text-route hover:underline">
          Registrieren
        </Link>
      </p>

      <LegalFooterLinks />
    </div>
  );
}
