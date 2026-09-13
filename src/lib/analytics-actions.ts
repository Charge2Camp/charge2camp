"use server";

import { createClient } from "@/lib/supabase/server";
import { logAppUsageEvent, type AppUsageEventType } from "@/lib/analytics";

/** Server Action fuer Client-Komponenten, die ein Nutzungsereignis
 * protokollieren wollen (aktuell: NavigationLink beim Exportieren einer
 * Route/Etappe nach Google Maps, siehe route-planner-form.tsx und
 * profil/routen/page.tsx) -- fire-and-forget, blockiert nie die eigentliche
 * Aktion (siehe logAppUsageEvent). Nicht angemeldete Nutzer (z. B. eine
 * oeffentlich geteilte Route) protokollieren mit user_id=null. */
export async function logRouteExportEvent(eventType: Extract<AppUsageEventType, "route_full_export" | "route_segment_export">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await logAppUsageEvent(supabase, eventType, user?.id ?? null);
}
