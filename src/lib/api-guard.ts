import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitConfig {
  windowSeconds: number;
  maxRequests: number;
}

/** Gemeinsamer Login- + Rate-Limit-Check fuer die Lade-/Campingplatz-
 * Lese-Endpunkte (Sicherheits-Audit: die "DNA" des Produkts). Login ist
 * seit dem Audit Pflicht (siehe require-user.ts fuer die Seiten-Variante
 * -- Route Handlers werden vom Karten-Client per fetch() aufgerufen und
 * koennen nicht redirecten, deshalb hier 401/429 statt eines Redirects).
 * Rate-Limiting per core.check_rate_limit() (siehe Migration
 * 20261004010000_rate_limiting.sql) -- Schluessel = `<endpoint>:<user.id>`,
 * userbasiert statt IP-basiert, da Login ab jetzt ohnehin vorausgesetzt
 * wird (robuster gegen NAT/Firmennetze).
 *
 * Gibt entweder `{ user }` zurueck (weitermachen) oder `{ response }`
 * (sofort zurueckgeben, 401 oder 429). */
export async function requireApiUser(
  endpoint: string,
  rateLimit: RateLimitConfig
): Promise<{ user: User } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }) };
  }

  const { data: allowed } = await createAdminClient()
    .schema("core")
    .rpc("check_rate_limit", {
      p_key: `${endpoint}:${user.id}`,
      p_window_seconds: rateLimit.windowSeconds,
      p_max_requests: rateLimit.maxRequests,
    });

  if (!allowed) {
    return {
      response: NextResponse.json({ error: "Zu viele Anfragen, bitte kurz warten." }, { status: 429 }),
    };
  }

  return { user };
}

/** Wie requireApiUser()'s Rate-Limit-Teil, aber fuer "use server"-Aktionen
 * (Server Actions, z. B. reportMissingStation/addChargingReview) statt
 * Route Handlers -- die geben kein NextResponse zurueck, sondern werfen bei
 * Ueberschreitung; die aufrufende Aktion faengt das in ihrem eigenen
 * try/catch und liefert die Meldung ueber ActionResult (siehe
 * action-result.ts), statt eines NextResponse-429 wie bei requireApiUser().
 * Sicherheits-Audit (2026-09-24): Server Actions hatten bisher GAR KEIN
 * Rate-Limiting, obwohl funktional identische API-Routen (z. B.
 * POST /api/enrich/charge-points/{key}/trailer) es bereits hatten --
 * Spam-anfaellige Formulare (Meldungen, Bewertungen) liefen dadurch
 * ungebremst. */
export async function requireActionRateLimit(
  endpoint: string,
  userId: string,
  rateLimit: RateLimitConfig
): Promise<void> {
  const { data: allowed } = await createAdminClient()
    .schema("core")
    .rpc("check_rate_limit", {
      p_key: `${endpoint}:${userId}`,
      p_window_seconds: rateLimit.windowSeconds,
      p_max_requests: rateLimit.maxRequests,
    });
  if (!allowed) throw new Error("Zu viele Anfragen, bitte kurz warten.");
}

/** Wie requireApiUser(), zusaetzlich mit profiles.is_admin-Pruefung --
 * fuer die Admin-/Moderations-Endpunkte (Sicherheits-Audit: diese Routen
 * pruefen Login+Admin bereits, hatten aber kein Rate-Limiting, obwohl
 * mehrere davon schreibend sind). Rate-Limit-Key ist bewusst vom Login-
 * Check getrennt gehalten (erst User laden, dann Admin-Flag pruefen, dann
 * limitieren) -- ein 401/403 soll nicht erst das Rate-Limit-Budget
 * verbrauchen. */
export async function requireApiAdmin(
  endpoint: string,
  rateLimit: RateLimitConfig
): Promise<{ user: User } | { response: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Anmeldung erforderlich." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return { response: NextResponse.json({ error: profileError.message }, { status: 500 }) };
  }
  if (!profile?.is_admin) {
    return { response: NextResponse.json({ error: "Kein Admin-Zugriff." }, { status: 403 }) };
  }

  const { data: allowed } = await createAdminClient()
    .schema("core")
    .rpc("check_rate_limit", {
      p_key: `${endpoint}:${user.id}`,
      p_window_seconds: rateLimit.windowSeconds,
      p_max_requests: rateLimit.maxRequests,
    });

  if (!allowed) {
    return {
      response: NextResponse.json({ error: "Zu viele Anfragen, bitte kurz warten." }, { status: 429 }),
    };
  }

  return { user };
}
