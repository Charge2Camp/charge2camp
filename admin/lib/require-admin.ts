import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
}

/** Muss am Anfang jeder geschuetzten Seite/Server Action stehen. Liest die
 * Session ueber den normalen Anon-Client (kein Service-Role noetig, RLS
 * erlaubt jedem Nutzer das Lesen des EIGENEN profiles-Eintrags) -- nicht
 * eingeloggt -> Redirect zu /login, eingeloggt aber nicht is_admin ->
 * Redirect zu /kein-zugriff. Gibt bei Erfolg die Admin-Identitaet zurueck,
 * z. B. fuer verified_by/p_moderator_id-Felder bei manuellen Korrekturen. */
export async function requireAdmin(): Promise<AdminUser> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();

  if (!profile?.is_admin) redirect("/kein-zugriff");

  return { id: user.id, email: user.email ?? "" };
}
