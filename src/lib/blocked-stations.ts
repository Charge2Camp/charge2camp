import { createClient } from "@/lib/supabase/server";

/** Vom Nutzer dauerhaft blockierte Ladepunkte (public.blocked_charging_stations,
 * analog zu favorites.ts) -- werden bei JEDER Routenplanung zusaetzlich zu den
 * nur fuer eine einzelne Route geloeschten Stopps (excludedStationIds) aus den
 * Kandidaten entfernt, siehe routenplaner/actions.ts. */
export async function fetchBlockedStationIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("blocked_charging_stations")
    .select("charging_station_id")
    .eq("user_id", userId);
  return (data ?? []).map((row: { charging_station_id: string }) => row.charging_station_id);
}
