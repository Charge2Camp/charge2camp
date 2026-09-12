import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Tauscht den PKCE-`code` aus einem Supabase-Auth-E-Mail-Link (aktuell nur
 * fuer "Passwort vergessen", siehe passwort-vergessen/page.tsx) gegen eine
 * echte Session -- ohne diese Route wuerde @supabase/ssr's PKCE-Flow
 * (Standard bei createBrowserClient/createServerClient) den Code nie
 * einloesen, der Nutzer laendet dann zwar auf der Zielseite, aber OHNE
 * Session. `next` bestimmt, wohin danach weitergeleitet wird (Standard:
 * Passwort-Reset-Formular).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/passwort-zuruecksetzen";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Der Link ist ungültig oder abgelaufen. Bitte erneut anfordern.")}`
  );
}
