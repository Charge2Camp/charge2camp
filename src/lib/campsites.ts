import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CampsiteSearchRow, CoreAmenity, Favorite } from "@/types/database";

/** Merkmalskatalog aus core.amenity (siehe Migration
 * 20260913000100_data_layer_seed_amenities) -- dynamisch statt hart codiert,
 * damit neue Merkmale nicht an zwei Stellen gepflegt werden muessen. */
export async function fetchAmenityCatalog(): Promise<CoreAmenity[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("amenity")
    .select("*")
    .order("category")
    .order("label_de");
  if (error) throw new Error(error.message);
  return (data as CoreAmenity[]) ?? [];
}

export interface CampsiteFilters {
  q?: string;
  country?: string;
  amenities: string[];
  charging?: "on_site" | "walking";
}

export function parseCampsiteFilters(
  searchParams: Record<string, string | string[] | undefined>,
  amenityKeys: string[]
): CampsiteFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  const chargingRaw = get("charging");
  return {
    q: get("q")?.trim() || undefined,
    country: get("country") || undefined,
    amenities: amenityKeys.filter((key) => get(key) === "1"),
    charging: chargingRaw === "on_site" || chargingRaw === "walking" ? chargingRaw : undefined,
  };
}

/** Liest aus core.campsite_search (Lesesicht mit Merkmalen + vorberechneter
 * Ladepunkt-Naehe, siehe Migration 20260913000200). */
export async function fetchCampsites(filters: CampsiteFilters): Promise<CampsiteSearchRow[]> {
  const supabase = createAdminClient();
  let query = supabase.schema("core").from("campsite_search").select("*");

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.country) query = query.eq("country_code", filters.country);
  if (filters.amenities.length > 0) query = query.contains("amenities", filters.amenities);
  if (filters.charging === "on_site") query = query.eq("charging_on_site", true);
  if (filters.charging === "walking") query = query.not("nearest_walk_m", "is", null);

  const { data, error } = await query.order("name").limit(5000);
  if (error) throw new Error(error.message);
  return (data as CampsiteSearchRow[]) ?? [];
}

/** Alle Campingplatz-Namen (unabhaengig von aktiven Filtern) fuer die
 * Vorschlagsliste im Suchfeld -- siehe NameSuggestField. */
export async function fetchCampsiteNameOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("campsite")
    .select("name")
    .eq("is_active", true)
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((row) => row.name).filter(Boolean)));
}

export interface CampsiteDestinationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Name + Koordinaten aller Campingplaetze, fuer die Ziel-Vorschlaege im
 * Routenplaner (AddressAutocomplete `localSuggestions`) -- die Koordinaten
 * sind bereits bekannt, kein erneutes Geocoding des Namens noetig (siehe
 * routenplaner/actions.ts). */
export async function fetchCampsiteDestinationOptions(): Promise<CampsiteDestinationOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .schema("core")
    .from("campsite_search")
    .select("id, name, lat, lon")
    .order("name")
    .limit(5000);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, latitude: r.lat, longitude: r.lon }));
}

/** Vom Nutzer gemerkte Campingplaetze mit vollen Merkmalen (core.campsite_search)
 * -- gezeigt statt der ungefilterten Gesamtliste, solange keine Filter aktiv
 * sind (siehe campingplaetze/page.tsx). Nicht angemeldet oder noch keine
 * Favoriten gemerkt: leere Liste, kein Fehler. */
export async function fetchFavoriteCampsites(userId: string): Promise<CampsiteSearchRow[]> {
  const supabase = await createClient();
  const { data: favorites } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", userId)
    .eq("entity_type", "campsite");
  const campsiteIds = ((favorites as Favorite[]) ?? []).map((f) => f.entity_id);
  if (campsiteIds.length === 0) return [];

  const { data, error } = await createAdminClient()
    .schema("core")
    .from("campsite_search")
    .select("*")
    .in("id", campsiteIds);
  if (error) throw new Error(error.message);
  return (data as CampsiteSearchRow[]) ?? [];
}

/** Bekannte Laendercodes fuer den Land-Filter. */
export async function fetchCampsiteCountryOptions(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.schema("core").from("campsite").select("country_code").limit(5000);
  if (error) throw new Error(error.message);
  const countries = new Set<string>();
  for (const row of data ?? []) {
    if (row.country_code) countries.add(row.country_code);
  }
  return Array.from(countries).sort();
}
