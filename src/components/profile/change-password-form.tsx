"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/profil/actions";

const initialState: ChangePasswordState = {};

/** Ein falsches aktuelles Passwort ist ein alltaeglicher Fall -- ein
 * `throw` in der Server Action wuerde hier auf Next.js' generischer
 * "Serverfehler"-Seite landen statt einer Inline-Fehlermeldung im
 * Formular. `useActionState` haelt das Ergebnis der Server Action lokal,
 * damit ein Fehler angezeigt werden kann, ohne die Seite zu verlassen. */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="mt-2 flex max-w-md flex-col gap-2">
      <label className="flex flex-col gap-1 text-sm">
        Aktuelles Passwort
        <input
          type="password"
          name="current_password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Neues Passwort
        <input
          type="password"
          name="new_password"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Neues Passwort bestätigen
        <input
          type="password"
          name="new_password_confirm"
          required
          minLength={6}
          autoComplete="new-password"
          className="w-full rounded-md border border-black/15 px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
        />
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-route">Passwort geändert.</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 min-h-11 self-start rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover disabled:opacity-60"
      >
        {pending ? "Wird geändert…" : "Passwort ändern"}
      </button>
    </form>
  );
}
