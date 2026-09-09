import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/** Service-Role-Client -- umgeht Row Level Security komplett, deshalb NUR
 * serverseitig verwenden (Server Components, Server Actions) und NIEMALS
 * an den Browser durchreichen. Jeder Aufrufer muss vorher requireAdmin()
 * (siehe ../require-admin.ts) durchlaufen haben; dieser Client selbst
 * prueft keinerlei Berechtigung. Kein Cookie-/Session-Handling noetig --
 * der Service-Role-Key authentifiziert sich selbst. */
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
