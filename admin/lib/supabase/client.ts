import { createBrowserClient } from "@supabase/ssr";

/** Browser-Client fuer den Login (Anon-Key, kein Zugriff auf geschuetzte
 * Daten -- die laufen ausschliesslich serverseitig ueber service.ts). */
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
