"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateErrorMessage } from "@/lib/action-result";
import { LegalFooterLinks } from "@/components/legal-footer-links";
import { FormError } from "@/components/form-error";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(translateErrorMessage(signUpError.message));
      return;
    }

    if (data.session) {
      router.push("/profil");
      router.refresh();
      return;
    }

    setMessage("Registrierung erfolgreich. Bitte bestätige deine E-Mail-Adresse.");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Konto erstellen</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="E-Mail">
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Passwort">
          <Input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && <FormError className="text-sm">{error}</FormError>}
        {message && <p className="text-sm text-route">{message}</p>}

        <Button type="submit" size="md" disabled={loading}>
          {loading ? "Wird erstellt…" : "Registrieren"}
        </Button>
      </form>

      <p className="text-sm text-text-muted">
        Bereits registriert?{" "}
        <Link href="/login" className="text-route hover:underline">
          Anmelden
        </Link>
      </p>

      <LegalFooterLinks />
    </div>
  );
}
