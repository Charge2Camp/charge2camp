import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Schlankes Nutzungs-Ereignisprotokoll fuer die Admin-Statistik (core.
 * app_usage_event, siehe Migration 20260929000000) -- Nutzerwunsch "mehr
 * Statistik zur Anwendung der Nutzer". Bewusst nur Ereignis-Zaehler ohne
 * Rueckverfolgung einzelner Routeninhalte (Datensparsamkeit).
 *
 * Fire-and-forget: ein fehlgeschlagenes Protokollieren darf NIE die
 * eigentliche Aktion (Route planen, Navigation exportieren) scheitern
 * lassen -- Fehler werden deshalb bewusst verschluckt (nur console.error
 * fuer Debugging), nie geworfen.
 */
export type AppUsageEventType = "route_planned" | "route_segment_export" | "route_full_export";

export async function logAppUsageEvent(
  supabase: SupabaseClient,
  eventType: AppUsageEventType,
  userId: string | null
): Promise<void> {
  try {
    const { error } = await supabase.schema("core").from("app_usage_event").insert({ event_type: eventType, user_id: userId });
    if (error) console.error(`logAppUsageEvent(${eventType}) fehlgeschlagen:`, error.message);
  } catch (err) {
    console.error(`logAppUsageEvent(${eventType}) fehlgeschlagen:`, err);
  }
}
