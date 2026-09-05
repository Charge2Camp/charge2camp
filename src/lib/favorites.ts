import { createClient } from "@/lib/supabase/server";
import type { Favorite } from "@/types/database";

export interface FavoriteDestinationOption {
  id: string;
  entityType: "campsite" | "charging_station";
  name: string;
  latitude: number;
  longitude: number;
}

/** Alle vom Nutzer gemerkten Campingplaetze/Ladepunkte (Name + Koordinaten),
 * fuer die Favoriten-Auswahl im Routenplaner (§ favorites-picker-dialog.tsx)
 * -- Koordinaten sind bereits bekannt, kein erneutes Geocoding noetig. */
export async function fetchFavoriteDestinations(userId: string): Promise<FavoriteDestinationOption[]> {
  const supabase = await createClient();
  const { data: favorites } = await supabase.from("favorites").select("*").eq("user_id", userId);
  const favoriteList = (favorites as Favorite[]) ?? [];

  const campsiteIds = favoriteList.filter((f) => f.entity_type === "campsite").map((f) => f.entity_id);
  const stationIds = favoriteList
    .filter((f) => f.entity_type === "charging_station")
    .map((f) => f.entity_id);

  const [{ data: campsites }, { data: stations }] = await Promise.all([
    campsiteIds.length
      ? supabase.from("campsites").select("id, name, latitude, longitude").in("id", campsiteIds)
      : Promise.resolve({ data: [] as { id: string; name: string; latitude: number; longitude: number }[] }),
    stationIds.length
      ? supabase
          .from("charging_stations")
          .select("id, name, provider, latitude, longitude")
          .in("id", stationIds)
      : Promise.resolve({
          data: [] as { id: string; name: string | null; provider: string; latitude: number; longitude: number }[],
        }),
  ]);

  const result: FavoriteDestinationOption[] = [];
  for (const c of campsites ?? []) {
    result.push({ id: c.id, entityType: "campsite", name: c.name, latitude: c.latitude, longitude: c.longitude });
  }
  for (const s of stations ?? []) {
    result.push({
      id: s.id,
      entityType: "charging_station",
      name: s.name ?? s.provider,
      latitude: s.latitude,
      longitude: s.longitude,
    });
  }
  return result;
}
