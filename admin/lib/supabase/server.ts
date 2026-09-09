import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Session-Client (Anon-Key + Nutzer-Cookies) -- nur fuer Login/Logout und
 * um die eigene profiles.is_admin zu pruefen (requireAdmin.ts). Fuer alle
 * eigentlichen Verwaltungsoperationen wird stattdessen der Service-Role-
 * Client (service.ts) verwendet, der RLS umgeht. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // setAll kann aus einer Server Component aufgerufen werden; wird
          // dort sicher ignoriert (kein Middleware-Refresh in dieser App
          // noetig, requireAdmin() liest die Session bei jedem Seitenaufruf
          // ohnehin frisch).
        }
      },
    },
  });
}
