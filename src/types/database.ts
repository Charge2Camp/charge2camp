// Hand-written types matching supabase/migrations/20260904210000_init_schema.sql.
// Once `supabase start` works locally, regenerate with:
//   npx supabase gen types typescript --local > src/types/database.ts

export type VerificationStatus =
  | "unverified"
  | "verified"
  | "community_verified"
  | "official";

export type TrailerSuitableAnswer = "yes" | "no" | "limited";

export type FavoriteEntityType = "campsite" | "charging_station";

export interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
  home_address: string | null;
  home_latitude: number | null;
  home_longitude: number | null;
  default_vehicle_id: string | null;
  default_caravan_id: string | null;
  preferred_charging_providers: string[];
  avoided_charging_providers: string[];
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
  width_m: number | null;
  height_m: number | null;
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

export interface CampsiteReview {
  id: string;
  user_id: string;
  campsite_id: string;
  rating: number;
  /** Laden auf dem Platz moeglich -- Nutzerangabe, siehe deriveCampsiteRating(). */
  charging_on_site: boolean;
  /** Nutzbare Ladeloesung fussläufig erreichbar -- Nutzerangabe. */
  charging_walkable: boolean;
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

  // Per Trigger gesetzt (siehe 20261005000000_admin_review_double_weight.sql):
  // true, wenn profiles.is_admin fuer user_id zum Zeitpunkt der Bewertung
  // true war. Laesst Admin-Bewertungen mit Gespannlaenge doppelt in die
  // Gespannlaengen-Empfehlungen einfliessen (trailer-compatibility.ts).
  is_admin_review: boolean;
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
  preferred_providers: string[];
  avoided_providers: string[];

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

export interface BlockedChargingStation {
  user_id: string;
  charging_station_id: string;
  created_at: string;
}

// ============================================================================
// Echte Daten (raw/core/enrich-Schema, siehe CLAUDE_CODE_AUFTRAG.md und
// supabase/migrations/20260913000000_data_layer_schema.sql). Bewusst
// GETRENNT von den obigen Campsite/ChargingStation-Typen (weiterhin
// public.campsites/public.charging_stations, mittlerweile ungenutzt --
// alle Seiten/Funktionen lesen aus core.*).
// ============================================================================

export interface CoreCampsite {
  id: string;
  external_key: string;
  name: string;
  slug: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country_code: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  capacity: number | null;
  /** Manuell im Admin-Backend gesetzter EV-Camping-Score (0-100) -- ueberschreibt
   * die automatische Berechnung (siehe lib/scoring/ev-camping-score.ts)
   * direkt, solange gesetzt. NULL = weiterhin automatisch berechnen. */
  ev_score_override: number | null;
  source: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

/** Zeile aus core.campsite_search (Lesesicht fuer Liste/Filter, siehe
 * Migration 20260913000200). */
export interface CampsiteSearchRow {
  id: string;
  external_key: string;
  name: string;
  slug: string | null;
  country_code: string | null;
  city: string | null;
  website: string | null;
  lat: number;
  lon: number;
  amenities: string[];
  charging_on_site: boolean;
  on_site_power_kw: number | null;
  on_site_point_count: number | null;
  pitch_charging: boolean | null;
  charging_type: string | null;
  charging_origin: string | null;
  nearest_walk_m: number | null;
  nearest_trailer_ok_m: number | null;
  nearby_max_power_kw: number | null;
  charge_points_walkable: number;
}

export interface CoreAmenity {
  key: string;
  category: string;
  label_de: string;
  label_en: string | null;
  value_type: "bool" | "num" | "text";
}

export interface CoreCampsiteAmenity {
  campsite_id: string;
  amenity_key: string;
  value_bool: boolean | null;
  value_num: number | null;
  value_text: string | null;
  source: string;
  confidence: number;
}

export interface CoreConnector {
  id: number;
  charge_point_id: string;
  standard: string | null;
  power_kw: number | null;
  current_type: string | null;
  quantity: number;
}

export interface CoreChargePoint {
  id: string;
  external_key: string;
  name: string | null;
  operator: string | null;
  network: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  country_code: string | null;
  access_type: string | null;
  is_operational: boolean;
  max_power_kw: number | null;
  connector_count: number | null;
  source: string;
  source_updated_at: string | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

/** Zeile aus core.charge_point_geo (legt lat/lon offen, siehe Migration
 * 20260916000100_charge_point_geo_view). */
export interface CoreChargePointGeo extends CoreChargePoint {
  lat: number;
  lon: number;
}

export type TrailerVerdict = "yes" | "unhitch" | "no" | "unknown";

export interface TrailerSuitabilityRecord {
  charge_point_key: string;
  verdict: TrailerVerdict;
  drive_through: boolean | null;
  pull_in_length_m: number | null;
  maneuvering_space: "ample" | "tight" | "none" | null;
  notes: string | null;
  origin: string;
  confirm_count: number;
  dispute_count: number;
  verified_at: string | null;
}

export interface CoreCampsiteChargeLink {
  campsite_id: string;
  charge_point_id: string;
  relation: "on_site" | "walking" | "nearby_drive";
  air_distance_m: number;
  walk_distance_m: number | null;
  walk_duration_s: number | null;
}

// Minimal Supabase `Database` generic so `createClient<Database>()` type-checks.
// This is intentionally loose (not table-by-table typed) until real generated
// types replace it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
