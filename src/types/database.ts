// Hand-written types matching supabase/migrations/20260904210000_init_schema.sql.
// Once `supabase start` works locally, regenerate with:
//   npx supabase gen types typescript --local > src/types/database.ts

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "community_verified"
  | "official";

export type TrailerSuitability = "confirmed" | "likely" | "unsuitable" | "unknown";

export type TrailerSuitableAnswer = "yes" | "no" | "limited";

export type FavoriteEntityType = "campsite" | "charging_station";

export interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  manufacturer: string;
  model: string;
  battery_capacity_kwh: number;
  consumption_kwh_per_100km: number | null;
  charging_power_kw: number | null;
  range_km: number | null;
  max_towing_weight_braked_kg: number | null;
  length_m: number | null;
  model_reference_id: string | null;
  created_at: string;
}

export interface Caravan {
  id: string;
  user_id: string;
  manufacturer: string;
  model: string;
  length_m: number;
  width_m: number;
  height_m: number;
  weight_kg: number;
  gross_vehicle_weight_kg: number | null;
  actual_travel_weight_kg: number | null;
  model_reference_id: string | null;
  created_at: string;
}

export interface VehicleModel {
  id: string;
  manufacturer: string;
  model: string;
  variant: string;
  battery_capacity_kwh: number | null;
  consumption_kwh_per_100km: number | null;
  charging_power_kw: number | null;
  range_km: number | null;
  max_towing_weight_braked_kg: number | null;
  length_m: number | null;
  source: string;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  created_at: string;
}

export interface CaravanModel {
  id: string;
  manufacturer: string;
  model: string;
  series: string | null;
  length_m: number;
  width_m: number;
  height_m: number;
  weight_kg: number;
  gross_vehicle_weight_kg: number | null;
  source: string;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  created_at: string;
}

export interface Campsite {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  country: string | null;
  region: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  phone: string | null;
  image_url: string | null;
  is_open: boolean | null;
  rating_avg: number | null;

  pool: boolean;
  sea: boolean;
  lake: boolean;
  river: boolean;
  mountain: boolean;
  family_friendly: boolean;
  dogs_allowed: boolean;
  restaurant: boolean;
  supermarket: boolean;
  electricity: boolean;
  wifi: boolean;

  ev_charging_available: boolean;
  ev_charging_on_site: boolean;
  ev_charging_nearby: boolean;
  max_charging_power_kw: number | null;
  number_of_charging_points: number | null;

  source: string;
  verification_status: VerificationStatus;
  last_verified_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface ChargingStation {
  id: string;
  provider: string;
  name: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  power_kw: number | null;
  connector_type: string | null;
  connector_count: number | null;
  status: string;
  price: number | null;
  currency: string | null;
  opening_hours: string | null;

  trailer_suitable: TrailerSuitability;
  trailer_suitable_score: number | null;
  trailer_notes: string | null;
  verified_by_community: boolean;

  source: string;
  verification_status: VerificationStatus;
  last_verified_at: string | null;
  last_updated: string;

  created_at: string;
}

export interface CampsiteReview {
  id: string;
  user_id: string;
  campsite_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface ChargingReview {
  id: string;
  user_id: string;
  charging_station_id: string;
  suitable: TrailerSuitableAnswer;
  trailer_length_m: number | null;
  trailer_width_m: number | null;
  caravan_model: string | null;
  vehicle_id: string | null;
  caravan_id: string | null;
  decoupled_parking_possible: boolean | null;
  photo_url: string | null;
  comment: string | null;
  created_at: string;

  // Strukturierte "echter Drive-Through"-Kriterien (angelehnt an
  // evcaravan.de), jeweils optional (null = keine Angabe).
  enough_space_for_rig: boolean | null;
  unobstructed_access: boolean | null;
  no_barrier_or_garage: boolean | null;
  side_mounted_charger: boolean | null;
}

export interface SavedRoute {
  id: string;
  user_id: string;
  name: string;

  start_query: string;
  start_display_name: string;
  start_latitude: number;
  start_longitude: number;

  end_query: string;
  end_display_name: string;
  end_latitude: number;
  end_longitude: number;

  vehicle_id: string | null;
  caravan_id: string | null;

  manual_consumption_kwh_per_100km: number | null;
  min_power_kw: number | null;
  prefer_trailer_suitable: boolean;
  preferred_provider: string | null;

  departure_soc_percent: number;
  min_soc_at_stop_percent: number;
  min_soc_at_destination_percent: number;
  target_soc_after_charging_percent: number;
  detour_tolerance_km: number;

  excluded_station_ids: string[];
  forced_station_id_by_index: Record<number, string>;
  manual_stops: { query: string; display_name: string; latitude: number; longitude: number }[];

  created_at: string;
}

export interface Favorite {
  user_id: string;
  entity_type: FavoriteEntityType;
  entity_id: string;
  created_at: string;
}

// Minimal Supabase `Database` generic so `createClient<Database>()` type-checks.
// This is intentionally loose (not table-by-table typed) until real generated
// types replace it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
