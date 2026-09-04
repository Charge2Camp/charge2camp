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
  photo_url: string | null;
  comment: string | null;
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
