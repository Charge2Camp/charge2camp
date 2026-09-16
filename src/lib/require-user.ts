import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Muss am Anfang jeder Seite stehen, die Ladepunkte-/Campingplatz-Daten
 * zeigt (die "DNA" des Produkts) -- Browsen erfordert seit dem
 * Sicherheits-Audit ein Login (noch kein Abo, das ist fuer die
 * Routenplanung spaeter vorgesehen). Nicht eingeloggt -> Redirect zu
 * /login mit `redirect`-Parameter, damit die Person nach dem Einloggen
 * automatisch zur eigentlich gewuenschten Seite zurueckkommt (siehe
 * src/app/login/page.tsx). Analog zu admin/lib/require-admin.ts, hier
 * aber ohne is_admin-Pruefung -- jeder eingeloggte Nutzer darf browsen. */
export async function requireUser(redirectTo: string): Promise<User> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect(`/login?redirect=${encodeURIComponent(redirectTo)}`);

  return user;
}
