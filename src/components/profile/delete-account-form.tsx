"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Kontoloeschung ist unwiderruflich (§ docs/privacy.md) -- anders als die
 * leichtgewichtigen Fahrzeug-/Wohnwagen-Loeschungen (dort jederzeit
 * reversibel durch erneutes Hinzufuegen) braucht das eine echte
 * Bestaetigung: die eigene E-Mail-Adresse eintippen schaltet den Button
 * erst frei. */
export function DeleteAccountForm({ email }: { email: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <form
      action={async () => {
        setError(null);
        setPending(true);
        const result = await deleteAccount();
        // Bei Erfolg navigiert deleteAccount() serverseitig per redirect()
        // weg -- hierher kommt die Ausfuehrung dann nie zurueck. pending
        // bleibt in dem Fall bewusst true (kein setPending(false)), damit
        // der Button bis zur Weiterleitung deaktiviert bleibt.
        if (!result.ok) {
          setError(result.error);
          setPending(false);
        }
      }}
      className="mt-3 flex max-w-md flex-col gap-2"
    >
      <Field label={`Zur Bestätigung deine E-Mail-Adresse eingeben (${email}):`}>
        <Input
          type="email"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
      </Field>
      {error && <FormError className="text-sm">{error}</FormError>}
      <Button type="submit" variant="destructive" disabled={!confirmed || pending} className="disabled:cursor-not-allowed">
        Konto endgültig löschen
      </Button>
    </form>
  );
}
