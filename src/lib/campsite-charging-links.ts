import { createClient } from "@/lib/supabase/server";
import type { CoreCampsiteChargeLink, CoreChargePointGeo, TrailerSuitabilityRecord, TrailerVerdict } from "@/types/database";
import { getTrailerPinState, TRAILER_PIN_ICON_SRC } from "@/lib/trailer-verdict";

export interface LinkedChargePoint {
  id: string;
  external_key: string;
  name: string | null;
  operator: string | null;
  max_power_kw: number | null;
  relation: "on_site" | "walking" | "nearby_drive";
  air_distance_m: number;
  walk_distance_m: number | null;
  walk_duration_s: number | null;
  latitude: number;
  longitude: number;
  trailerVerdict: TrailerVerdict;
}

/** Liest die von ingest/build_links.py vorberechnete Campingplatz-
 * Ladepunkt-Verknuepfung (siehe Auftrag C) -- echte Gehstrecken statt
 * Luftlinie. Kann fuer Campingplaetze ausserhalb des bisher per OSRM
 * abgedeckten Gebiets leer sein (noch nicht Teil dieser Umstellung, siehe
 * docs/architecture.md). */
export async function fetchLinkedChargePoints(campsiteId: string): Promise<LinkedChargePoint[]> {
  const supabase = await createClient();
  const { data: links, error } = await supabase
    .schema("core")
    .from("campsite_charge_link")
    .select("*")
    .eq("campsite_id", campsiteId)
    .order("walk_distance_m", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  const linkRows = (links as CoreCampsiteChargeLink[]) ?? [];
  if (linkRows.length === 0) return [];

  const ids = linkRows.map((l) => l.charge_point_id);
  const { data: points, error: pointsError } = await supabase
    .schema("core")
    .from("charge_point_geo")
    .select("*")
    .in("id", ids);
  if (pointsError) throw new Error(pointsError.message);
  const pointRows = (points as CoreChargePointGeo[]) ?? [];
  const pointById = new Map(pointRows.map((p) => [p.id, p]));

  const keys = pointRows.map((p) => p.external_key);
  const { data: trailerRows, error: trailerError } =
    keys.length > 0
      ? await supabase.schema("enrich").from("trailer_suitability").select("*").in("charge_point_key", keys)
      : { data: [] as TrailerSuitabilityRecord[], error: null };
  if (trailerError) throw new Error(trailerError.message);
  const trailerByKey = new Map(((trailerRows as TrailerSuitabilityRecord[]) ?? []).map((t) => [t.charge_point_key, t]));

  const result: LinkedChargePoint[] = [];
  for (const link of linkRows) {
    const point = pointById.get(link.charge_point_id);
    if (!point) continue;
    result.push({
      id: point.id,
      external_key: point.external_key,
      name: point.name,
      operator: point.operator,
      max_power_kw: point.max_power_kw,
      relation: link.relation,
      air_distance_m: link.air_distance_m,
      walk_distance_m: link.walk_distance_m,
      walk_duration_s: link.walk_duration_s,
      latitude: point.lat,
      longitude: point.lon,
      trailerVerdict: trailerByKey.get(point.external_key)?.verdict ?? "unknown",
    });
  }
  return result;
}

export interface NearbyChargePoint {
  id: string;
  name: string | null;
  operator: string | null;
  max_power_kw: number | null;
  latitude: number;
  longitude: number;
  distance_m: number;
  iconSrc: string;
}

/** Echter Umkreis-Radius per PostGIS (core.charge_points_within_radius,
 * siehe Migration 20260909040000) -- fuer die Kartenansicht der
 * Campingplatz-Detailseite, bewusst getrennt von fetchLinkedChargePoints
 * (Fusswege-Verknuepfung, nur wenige Meter/Gehminuten, fuer die
 * "Ladepunkte in der Naehe"-Liste). */
export async function fetchNearbyChargePoints(
  latitude: number,
  longitude: number,
  radiusKm: number
): Promise<NearbyChargePoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.schema("core").rpc("charge_points_within_radius", {
    p_lat: latitude,
    p_lon: longitude,
    p_radius_m: radiusKm * 1000,
  });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as {
    id: string;
    name: string | null;
    operator: string | null;
    max_power_kw: number | null;
    lat: number;
    lon: number;
    distance_m: number;
    verdict: TrailerVerdict | null;
    drive_through: boolean | null;
  }[];

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    operator: r.operator,
    max_power_kw: r.max_power_kw,
    latitude: r.lat,
    longitude: r.lon,
    distance_m: r.distance_m,
    iconSrc: TRAILER_PIN_ICON_SRC[getTrailerPinState({ verdict: r.verdict ?? "unknown", drive_through: r.drive_through })],
  }));
}
