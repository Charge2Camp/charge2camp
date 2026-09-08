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
  const confirmed = confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={deleteAccount} className="mt-3 flex max-w-md flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Zur Bestätigung deine E-Mail-Adresse eingeben ({email}):
        <input
          type="email"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={email}
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          autoComplete="off"
        />
      </label>
      <button
        type="submit"
        disabled={!confirmed}
        className="min-h-11 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Konto endgültig löschen
      </button>
    </form>
  );
}
