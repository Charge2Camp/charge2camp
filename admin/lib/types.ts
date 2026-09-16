/** Schlanke, lokale Zeilentypen fuer die Tabellen, die diese App bearbeitet
 * -- bewusst NICHT aus der Haupt-App importiert (src/types/database.ts),
 * damit admin/ ein eigenstaendiges Deploy bleibt (siehe Plan: "losgeloest").
 * Nur die Felder, die hier tatsaechlich gelesen/geschrieben werden --
 * PostGIS-Spalten (geom/boundary) sind bewusst ausgelassen, diese App
 * zeigt keine Karte. */

export interface ChargePoint {
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
  is_operational: boolean | null;
  max_power_kw: number | null;
  connector_count: number | null;
  source: string;
  last_seen_at: string;
  is_active: boolean;
  manual_override: boolean;
}

export interface Connector {
  id: number;
  charge_point_id: string;
  standard: string | null;
  power_kw: number | null;
  current_type: string | null;
  quantity: number;
}

export type TrailerVerdict = "yes" | "unhitch" | "no" | "unknown";
export type ManeuveringSpace = "ample" | "tight" | "none";

export interface TrailerSuitability {
  charge_point_key: string;
  verdict: TrailerVerdict;
  drive_through: boolean | null;
  pull_in_length_m: number | null;
  maneuvering_space: ManeuveringSpace | null;
  notes: string | null;
  origin: string;
  confirm_count: number;
  dispute_count: number;
  verified_at: string | null;
  verified_by: string | null;
  updated_at: string;
}

export interface TrailerReport {
  id: number;
  charge_point_key: string;
  user_id: string | null;
  verdict: "yes" | "unhitch" | "no";
  drive_through: boolean | null;
  notes: string | null;
  photo_url: string | null;
  rig_length_m: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Campsite {
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
  /** Manueller Override fuer den EV-Camping-Score (0-100) -- NULL =
   * weiterhin automatisch berechnet (siehe Haupt-App lib/scoring/
   * ev-camping-score.ts). */
  ev_score_override: number | null;
  source: string;
  is_active: boolean;
}

export interface CampsiteCharging {
  campsite_key: string;
  has_charging: boolean;
  charging_type: "wallbox" | "schuko_only" | "dc_fast" | "cee" | "mixed" | null;
  max_power_kw: number | null;
  point_count: number | null;
  pitch_charging: boolean | null;
  origin: string;
}

export interface Amenity {
  key: string;
  category: string;
  label_de: string;
  label_en: string | null;
  value_type: "bool" | "num" | "text";
}

export interface CampsiteAmenity {
  campsite_id: string;
  amenity_key: string;
  value_bool: boolean | null;
  value_num: number | null;
  value_text: string | null;
  source: string;
  confidence: number | null;
}

export interface Profile {
  id: string;
  email: string;
  is_admin: boolean;
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

export type VerificationStatus = "unverified" | "verified" | "outdated";

/** public.vehicle_models -- Referenzkatalog fuer die Fahrzeugauswahl mit
 * Autofill in der Haupt-App (VehicleForm). Nutzer koennen die Werte nach
 * dem Autofill frei anpassen -- dieser Katalog ist nur die Vorbelegung,
 * nicht die Quelle der Wahrheit fuer bereits gespeicherte Fahrzeuge. */
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

/** public.caravan_models -- siehe VehicleModel, gleiches Prinzip fuer
 * Wohnwagen. */
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

export interface MissingStationReport {
  id: number;
  user_id: string;
  google_maps_url: string;
  extracted_latitude: number | null;
  extracted_longitude: number | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  created_charge_point_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
}

export interface ChargingReview {
  id: string;
  user_id: string;
  charging_station_id: string;
  suitable: "yes" | "no" | "limited";
  trailer_length_m: number | null;
  trailer_width_m: number | null;
  caravan_model: string | null;
  comment: string | null;
  created_at: string;
}
