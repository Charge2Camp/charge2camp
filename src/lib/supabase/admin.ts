import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Server-only Admin-Client mit dem Service-Role-Key -- fuer die wenigen
 * Operationen, die die normale (RLS-gebundene) Nutzer-Session nicht darf,
 * z. B. das eigene Konto in auth.users loeschen (§ Kontoloeschung,
 * docs/privacy.md). NIE importieren von Client Components oder etwas, das
 * ins Browser-Bundle gelangen koennte -- der Key hebelt RLS komplett aus.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
