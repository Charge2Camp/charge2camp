"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/** Formular fuer den zweiten Schritt von "Passwort vergessen" -- erreichbar
 * nur ueber den Link aus der Reset-E-Mail (via /auth/callback, das den
 * PKCE-Code gegen eine echte Session tauscht). Ohne gueltige Session (z. B.
 * Seite direkt aufgerufen, Link abgelaufen) kann auth.updateUser() nicht
 * greifen -- das wird explizit geprueft, statt ein kryptisches
 * Supabase-Fehlerobjekt anzuzeigen. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    });
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password !== passwordConfirm) {
      setError("Die beiden Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/profil");
      router.refresh();
    }, 1500);
  }

  if (checkingSession) return null;

  if (!hasSession) {
    return (
      <div className="mx-auto flex max-w-sm flex-col gap-4 px-4 py-16">
        <h1 className="text-2xl font-semibold">Link ungültig</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.
        </p>
        <Link href="/passwort-vergessen" className="text-sm text-route hover:underline">
          Neuen Link anfordern
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Neues Passwort festlegen</h1>

      {success ? (
        <p className="text-sm text-route">Passwort geändert. Du wirst weitergeleitet…</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Neues Passwort
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Neues Passwort bestätigen
            <input
              type="password"
              required
              minLength={8}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="min-h-12 rounded-md bg-action px-4 py-3 font-medium text-base hover:bg-action-hover disabled:opacity-50"
          >
            {loading ? "Wird gespeichert…" : "Passwort speichern"}
          </button>
        </form>
      )}
    </div>
  );
}
