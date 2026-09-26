"use client";

import { useState } from "react";
import { deleteAccount } from "@/app/profil/actions";

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
      <label className="flex flex-col gap-1 text-sm">
        Zur Bestätigung deine E-Mail-Adresse eingeben ({email}):
        <input
          type="email"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={email}
          className="w-full rounded-md border border-line-strong px-3 py-2 text-base dark:bg-transparent"
          autoComplete="off"
        />
      </label>
      {error && <p className="text-sm text-error">{error}</p>}
      <button
        type="submit"
        disabled={!confirmed || pending}
        className="min-h-11 rounded-md bg-error px-4 py-2 text-sm font-medium text-white hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Konto endgültig löschen
      </button>
    </form>
  );
}
