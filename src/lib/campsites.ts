import { createClient } from "@/lib/supabase/server";
import type { Campsite } from "@/types/database";

export const AMENITY_FIELDS = [
  "pool",
  "sea",
  "lake",
  "river",
  "mountain",
  "family_friendly",
  "dogs_allowed",
  "restaurant",
  "supermarket",
  "wifi",
] as const;

export type AmenityField = (typeof AMENITY_FIELDS)[number];

export const AMENITY_LABELS: Record<AmenityField, string> = {
  pool: "Pool",
  sea: "Meer",
  lake: "See",
  river: "Fluss",
  mountain: "Berge",
  family_friendly: "Familienfreundlich",
  dogs_allowed: "Hunde erlaubt",
  restaurant: "Restaurant",
  supermarket: "Supermarkt",
  wifi: "WLAN",
};

export const EV_FIELDS = [
  "ev_charging_available",
  "ev_charging_on_site",
  "ev_charging_nearby",
] as const;

export type EvField = (typeof EV_FIELDS)[number];

export const EV_LABELS: Record<EvField, string> = {
  ev_charging_available: "Ladepunkt vorhanden",
  ev_charging_on_site: "Ladepunkt auf dem Platz",
  ev_charging_nearby: "Ladepunkt in Laufnähe",
};

export interface CampsiteFilters {
  q?: string;
  country?: string;
  region?: string;
  amenities: AmenityField[];
  ev: EvField[];
}

export function parseCampsiteFilters(
  searchParams: Record<string, string | string[] | undefined>
): CampsiteFilters {
  const get = (key: string) => {
    const v = searchParams[key];
    return Array.isArray(v) ? v[0] : v;
  };

  return {
    q: get("q")?.trim() || undefined,
    country: get("country") || undefined,
    region: get("region") || undefined,
    amenities: AMENITY_FIELDS.filter((f) => get(f) === "1"),
    ev: EV_FIELDS.filter((f) => get(f) === "1"),
  };
}

export async function fetchCampsites(filters: CampsiteFilters): Promise<Campsite[]> {
  const supabase = await createClient();
  let query = supabase.from("campsites").select("*");

  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.country) query = query.eq("country", filters.country);
  if (filters.region) query = query.eq("region", filters.region);
  for (const field of filters.amenities) query = query.eq(field, true);
  for (const field of filters.ev) query = query.eq(field, true);

  const { data, error } = await query.order("name");
  if (error) throw new Error(error.message);
  return (data as Campsite[]) ?? [];
}

export async function fetchCampsiteLocationOptions(): Promise<{
  countries: string[];
  regions: string[];
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("campsites").select("country, region");
  if (error) throw new Error(error.message);

  const countries = new Set<string>();
  const regions = new Set<string>();
  for (const row of data ?? []) {
    if (row.country) countries.add(row.country);
    if (row.region) regions.add(row.region);
  }
  return {
    countries: Array.from(countries).sort(),
    regions: Array.from(regions).sort(),
  };
}
