"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/profil/actions";
import { FormError } from "@/components/form-error";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
      <Field label="Aktuelles Passwort">
        <Input type="password" name="current_password" required autoComplete="current-password" />
      </Field>
      <Field label="Neues Passwort">
        <Input type="password" name="new_password" required minLength={6} autoComplete="new-password" />
      </Field>
      <Field label="Neues Passwort bestätigen">
        <Input type="password" name="new_password_confirm" required minLength={6} autoComplete="new-password" />
      </Field>

      {state.error && <FormError className="text-sm">{state.error}</FormError>}
      {state.success && <p className="text-sm text-route">Passwort geändert.</p>}

      <Button type="submit" disabled={pending} className="mt-1 self-start">
        {pending ? "Wird geändert…" : "Passwort ändern"}
      </Button>
    </form>
  );
}
