"use server";

import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";
import { osrmProvider } from "@/lib/providers/routing/osrm";
import { DEFAULT_CONSUMPTION_KWH_PER_100KM, distanceAlongRouteKm, planTrip, type TripPlan } from "@/lib/route-planning";
import { assessPersonalCompatibility, summarizeCommunitySuitability } from "@/lib/scoring/trailer-compatibility";
import type { ManualWaypoint, ManualWaypointWithDistance } from "@/lib/route-timeline";
import type { Caravan, ChargingReview, ChargingStation, SavedRoute, Vehicle } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

interface GeoPoint {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface RoutePlanResult {
  start: { latitude: number; longitude: number; displayName: string };
  end: { latitude: number; longitude: number; displayName: string };
  geometry: { latitude: number; longitude: number }[];
  /** Manuell hinzugefuegte, zwingend zu durchfahrende Zwischenstopps (§ ABRP-Vorbild "Add Stop") -- unabhaengig von der Ladeplanung, siehe route-timeline.ts. */
  manualWaypoints: ManualWaypointWithDistance[];
  vehicle: Pick<Vehicle, "manufacturer" | "model">;
  caravan: Pick<Caravan, "manufacturer" | "model"> | null;
  consumptionSource: "manual" | "profile" | "default";
  plan: TripPlan;
}

/** Alle vom Nutzer einstellbaren Ladeplanungs-Parameter -- Formular-Slider
 * plus vom Routenuebersicht-Popup kuratierte Auswahl. Wird sowohl fuer eine
 * frische Planung als auch beim erneuten Oeffnen einer gespeicherten Route
 * verwendet. */
interface PlanningSettings {
  preferTrailerSuitable: boolean;
  minPowerKw?: number;
  preferredProvider?: string;
  departureSocPercent?: number;
  minSocAtStopPercent?: number;
  minSocAtDestinationPercent?: number;
  targetSocAfterChargingPercent?: number;
  detourToleranceKm?: number;
  excludedStationIds?: string[];
  forcedStationIdByIndex?: Record<number, string>;
}

function parseOptionalPositiveNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Wie parseOptionalPositiveNumber, erlaubt aber 0 (z. B. Umweg-Toleranz "0 km"). */
function parseOptionalNonNegativeNumber(value: FormDataEntryValue | null): number | null {
  if (!value || typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function requireString(value: FormDataEntryValue | null, label: string): string {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} fehlt.`);
  }
  return value.trim();
}

/**
 * Reichert die geplanten Ladestopps sowie deren Alternativen an: eine
 * persoenliche Eignungseinschaetzung fuer das konkrete Gespann des Nutzers
 * (§20) und das Datum der letzten Community-Bewertung als Proxy fuer
 * "zuletzt bestaetigt funktionsfaehig" (kein Live-Status verfuegbar, siehe
 * Phase 8). planTrip selbst kennt keine charging_reviews (reine
 * Planungslogik ohne DB-Zugriff, siehe route-planning.ts).
 */
async function annotateChargingStops(
  supabase: SupabaseServerClient,
  plan: TripPlan,
  userTrailerLengthM: number | null
): Promise<TripPlan> {
  if (plan.chargingStops.length === 0) return plan;

  const stationIds = plan.chargingStops.flatMap((stop) => [
    stop.station.id,
    ...stop.alternatives.map((a) => a.station.id),
  ]);

  const { data: reviews } = await supabase
    .from("charging_reviews")
    .select("*")
    .in("charging_station_id", stationIds);

  const reviewsByStation = new Map<string, ChargingReview[]>();
  for (const review of (reviews as ChargingReview[]) ?? []) {
    const list = reviewsByStation.get(review.charging_station_id) ?? [];
    list.push(review);
    reviewsByStation.set(review.charging_station_id, list);
  }

  function annotate(stationId: string) {
    const stationReviews = reviewsByStation.get(stationId) ?? [];
    const summary = summarizeCommunitySuitability(stationReviews);
    const lastConfirmedAt =
      stationReviews.length > 0
        ? stationReviews.reduce((latest, r) => (r.created_at > latest ? r.created_at : latest), stationReviews[0].created_at)
        : null;
    return {
      personalCompatibility: assessPersonalCompatibility(summary, userTrailerLengthM),
      lastConfirmedAt,
    };
  }

  return {
    ...plan,
    chargingStops: plan.chargingStops.map((stop) => ({
      ...stop,
      ...annotate(stop.station.id),
      alternatives: stop.alternatives.map((alt) => ({
        ...alt,
        ...annotate(alt.station.id),
      })),
    })),
  };
}

/**
 * Gemeinsamer Kern von `planRoute` (frische Planung, geocodiert Start/Ziel
 * zuerst) und `loadSavedRoute` (Start/Ziel-Koordinaten bereits bekannt,
 * kein erneutes Geocoding noetig): Routing + Ladeplanung + persoenliche
 * Eignungseinschaetzung fuer bereits aufgeloeste Start-/Zielpunkte,
 * Fahrzeug und Wohnwagen.
 */
async function buildRoutePlanResult({
  supabase,
  start,
  end,
  manualWaypoints,
  vehicle,
  caravan,
  consumptionKwhPer100km,
  consumptionSource,
  settings,
}: {
  supabase: SupabaseServerClient;
  start: GeoPoint;
  end: GeoPoint;
  /** Bereits aufgeloeste manuelle Zwischenstopps (Koordinaten bekannt, siehe route-timeline.ts). */
  manualWaypoints: ManualWaypoint[];
  vehicle: Vehicle;
  caravan: Caravan | null;
  consumptionKwhPer100km: number;
  consumptionSource: RoutePlanResult["consumptionSource"];
  settings: PlanningSettings;
}): Promise<RoutePlanResult> {
  const route = await osrmProvider.planRoute({
    start,
    end,
    waypoints: manualWaypoints.map((w) => ({ latitude: w.latitude, longitude: w.longitude })),
  });

  const { data: chargingStations } = await supabase.from("charging_stations").select("*");

  const plan = planTrip({
    route,
    vehicle,
    chargingStations: (chargingStations as ChargingStation[]) ?? [],
    preferTrailerSuitable: settings.preferTrailerSuitable,
    minPowerKw: settings.minPowerKw,
    preferredProvider: settings.preferredProvider,
    consumptionKwhPer100km,
    ...(settings.departureSocPercent !== undefined && { departureSocPercent: settings.departureSocPercent }),
    ...(settings.minSocAtStopPercent !== undefined && { minSocAtStopPercent: settings.minSocAtStopPercent }),
    ...(settings.minSocAtDestinationPercent !== undefined && {
      minSocAtDestinationPercent: settings.minSocAtDestinationPercent,
    }),
    ...(settings.targetSocAfterChargingPercent !== undefined && {
      targetSocAfterChargingPercent: settings.targetSocAfterChargingPercent,
    }),
    ...(settings.detourToleranceKm !== undefined && { detourToleranceKm: settings.detourToleranceKm }),
    excludedStationIds: settings.excludedStationIds,
    forcedStationIdByIndex: settings.forcedStationIdByIndex,
  });

  const userTrailerLengthM =
    vehicle.length_m !== null && caravan?.length_m ? vehicle.length_m + caravan.length_m : null;
  const annotatedPlan = await annotateChargingStops(supabase, plan, userTrailerLengthM);

  const manualWaypointsWithDistance: ManualWaypointWithDistance[] = manualWaypoints.map((w) => ({
    ...w,
    distanceFromStartKm: distanceAlongRouteKm(w, route),
  }));

  return {
    start: { latitude: start.latitude, longitude: start.longitude, displayName: start.displayName },
    end: { latitude: end.latitude, longitude: end.longitude, displayName: end.displayName },
    geometry: route.geometry,
    manualWaypoints: manualWaypointsWithDistance,
    vehicle: { manufacturer: vehicle.manufacturer, model: vehicle.model },
    caravan: caravan ? { manufacturer: caravan.manufacturer, model: caravan.model } : null,
    consumptionSource,
    plan: annotatedPlan,
  };
}

async function requireVehicle(
  supabase: SupabaseServerClient,
  vehicleId: string,
  userId: string
): Promise<Vehicle> {
  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !vehicle) throw new Error("Fahrzeug nicht gefunden.");
  return vehicle as Vehicle;
}

async function loadCaravan(
  supabase: SupabaseServerClient,
  caravanId: string | null | undefined,
  userId: string
): Promise<Caravan | null> {
  if (!caravanId) return null;
  const { data } = await supabase
    .from("caravans")
    .select("*")
    .eq("id", caravanId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Caravan | null) ?? null;
}

export async function planRoute(formData: FormData): Promise<RoutePlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const startQuery = requireString(formData.get("start"), "Start");
  const endQuery = requireString(formData.get("end"), "Ziel");
  const vehicleId = requireString(formData.get("vehicle_id"), "Fahrzeug");
  const caravanId = formData.get("caravan_id");
  const minPowerKwRaw = formData.get("min_power_kw");
  const preferredProviderRaw = formData.get("preferred_provider");
  const preferTrailerSuitable = formData.get("prefer_trailer_suitable") === "1";
  const manualStopQueries = formData
    .getAll("manual_stop")
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  const vehicle = await requireVehicle(supabase, vehicleId, user.id);
  const caravan = await loadCaravan(supabase, typeof caravanId === "string" ? caravanId : null, user.id);

  // Nominatim-Nutzungsrichtlinie: max. 1 Anfrage/Sekunde -- Start, Ziel und
  // jeder manuelle Zwischenstopp werden deshalb sequenziell mit Pause
  // geocodiert statt parallel.
  const start = await geocodeAddress(startQuery);
  if (!start) throw new Error(`Start "${startQuery}" konnte nicht gefunden werden.`);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const end = await geocodeAddress(endQuery);
  if (!end) throw new Error(`Ziel "${endQuery}" konnte nicht gefunden werden.`);

  const manualWaypoints: ManualWaypoint[] = [];
  for (const query of manualStopQueries) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const point = await geocodeAddress(query);
    if (!point) throw new Error(`Zwischenstopp "${query}" konnte nicht gefunden werden.`);
    manualWaypoints.push({ query, displayName: point.displayName, latitude: point.latitude, longitude: point.longitude });
  }

  // Verbrauch: manuelle Eingabe im Routenplaner > Profilangabe > Standardwert.
  // Bewusst KEINE Herstellerangaben (Batterie/Reichweite) verwenden, siehe
  // src/lib/route-planning.ts.
  const manualConsumption = parseOptionalPositiveNumber(formData.get("consumption_kwh_per_100km"));
  const consumptionKwhPer100km =
    manualConsumption ?? vehicle.consumption_kwh_per_100km ?? DEFAULT_CONSUMPTION_KWH_PER_100KM;
  const consumptionSource: RoutePlanResult["consumptionSource"] = manualConsumption
    ? "manual"
    : vehicle.consumption_kwh_per_100km
      ? "profile"
      : "default";

  const departureSocPercent = parseOptionalNonNegativeNumber(formData.get("departure_soc_percent"));
  const minSocAtStopPercent = parseOptionalNonNegativeNumber(formData.get("min_soc_at_stop_percent"));
  const minSocAtDestinationPercent = parseOptionalNonNegativeNumber(
    formData.get("min_soc_at_destination_percent")
  );
  const targetSocAfterChargingPercent = parseOptionalNonNegativeNumber(
    formData.get("target_soc_after_charging_percent")
  );
  const detourToleranceKm = parseOptionalNonNegativeNumber(formData.get("detour_tolerance_km"));

  return buildRoutePlanResult({
    supabase,
    start,
    end,
    manualWaypoints,
    vehicle,
    caravan,
    consumptionKwhPer100km,
    consumptionSource,
    settings: {
      preferTrailerSuitable,
      minPowerKw: minPowerKwRaw ? Number(minPowerKwRaw) : undefined,
      preferredProvider: typeof preferredProviderRaw === "string" && preferredProviderRaw ? preferredProviderRaw : undefined,
      ...(departureSocPercent !== null && { departureSocPercent }),
      ...(minSocAtStopPercent !== null && { minSocAtStopPercent }),
      ...(minSocAtDestinationPercent !== null && { minSocAtDestinationPercent }),
      ...(targetSocAfterChargingPercent !== null && { targetSocAfterChargingPercent }),
      ...(detourToleranceKm !== null && { detourToleranceKm }),
    },
  });
}

/**
 * Berechnet nur die Ladeplanung neu (z. B. nachdem der Nutzer den
 * vorgeschlagenen Ladestopp geloescht oder eine Alternative gewaehlt hat) --
 * ohne erneutes Geocoding/Routing, da Start/Ziel/Streckengeometrie
 * unveraendert bleiben. Vermeidet unnoetige Nominatim-/OSRM-Anfragen.
 */
export async function replanChargingStop(input: {
  vehicleId: string;
  caravanId?: string;
  route: { distanceKm: number; durationMin: number; geometry: { latitude: number; longitude: number }[] };
  consumptionKwhPer100km: number;
  preferTrailerSuitable: boolean;
  minPowerKw?: number;
  preferredProvider?: string;
  departureSocPercent: number;
  minSocAtStopPercent: number;
  minSocAtDestinationPercent: number;
  targetSocAfterChargingPercent: number;
  detourToleranceKm: number;
  excludedStationIds: string[];
  forcedStationIdByIndex?: Record<number, string>;
}): Promise<TripPlan> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const vehicle = await requireVehicle(supabase, input.vehicleId, user.id);
  const caravan = await loadCaravan(supabase, input.caravanId, user.id);

  const { data: chargingStations } = await supabase.from("charging_stations").select("*");

  const plan = planTrip({
    route: input.route,
    vehicle,
    chargingStations: (chargingStations as ChargingStation[]) ?? [],
    preferTrailerSuitable: input.preferTrailerSuitable,
    minPowerKw: input.minPowerKw,
    preferredProvider: input.preferredProvider,
    consumptionKwhPer100km: input.consumptionKwhPer100km,
    departureSocPercent: input.departureSocPercent,
    minSocAtStopPercent: input.minSocAtStopPercent,
    minSocAtDestinationPercent: input.minSocAtDestinationPercent,
    targetSocAfterChargingPercent: input.targetSocAfterChargingPercent,
    detourToleranceKm: input.detourToleranceKm,
    excludedStationIds: input.excludedStationIds,
    forcedStationIdByIndex: input.forcedStationIdByIndex,
  });

  const userTrailerLengthM =
    vehicle.length_m !== null && caravan?.length_m ? vehicle.length_m + caravan.length_m : null;
  return annotateChargingStops(supabase, plan, userTrailerLengthM);
}

export interface SaveRouteInput {
  name: string;
  startQuery: string;
  start: GeoPoint;
  endQuery: string;
  end: GeoPoint;
  manualWaypoints: ManualWaypoint[];
  vehicleId: string;
  caravanId: string | null;
  manualConsumptionKwhPer100km: number | null;
  minPowerKw: number | null;
  preferTrailerSuitable: boolean;
  preferredProvider: string | null;
  departureSocPercent: number;
  minSocAtStopPercent: number;
  minSocAtDestinationPercent: number;
  targetSocAfterChargingPercent: number;
  detourToleranceKm: number;
  excludedStationIds: string[];
  forcedStationIdByIndex: Record<number, string>;
}

/** Speichert Start/Ziel/Fahrzeug/Einstellungen im Profil des Nutzers --
 * bewusst keine fertige Streckengeometrie/keinen fertigen Ladeplan (siehe
 * Kommentar in der Migration), damit die Route beim erneuten Oeffnen immer
 * mit aktuellen Ladepunkten/Strassendaten neu berechnet wird. */
export async function saveRoute(input: SaveRouteInput): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { data, error } = await supabase
    .from("saved_routes")
    .insert({
      user_id: user.id,
      name: input.name,
      start_query: input.startQuery,
      start_display_name: input.start.displayName,
      start_latitude: input.start.latitude,
      start_longitude: input.start.longitude,
      end_query: input.endQuery,
      end_display_name: input.end.displayName,
      end_latitude: input.end.latitude,
      end_longitude: input.end.longitude,
      manual_stops: input.manualWaypoints.map((w) => ({
        query: w.query,
        display_name: w.displayName,
        latitude: w.latitude,
        longitude: w.longitude,
      })),
      vehicle_id: input.vehicleId,
      caravan_id: input.caravanId,
      manual_consumption_kwh_per_100km: input.manualConsumptionKwhPer100km,
      min_power_kw: input.minPowerKw,
      prefer_trailer_suitable: input.preferTrailerSuitable,
      preferred_provider: input.preferredProvider,
      departure_soc_percent: input.departureSocPercent,
      min_soc_at_stop_percent: input.minSocAtStopPercent,
      min_soc_at_destination_percent: input.minSocAtDestinationPercent,
      target_soc_after_charging_percent: input.targetSocAfterChargingPercent,
      detour_tolerance_km: input.detourToleranceKm,
      excluded_station_ids: input.excludedStationIds,
      forced_station_id_by_index: input.forcedStationIdByIndex,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Route konnte nicht gespeichert werden.");
  return { id: data.id };
}

export interface SavedRouteDetail {
  name: string;
  startQuery: string;
  endQuery: string;
  manualStopQueries: string[];
  vehicleId: string;
  caravanId: string | null;
  manualConsumptionKwhPer100km: number | null;
  minPowerKw: number | null;
  preferTrailerSuitable: boolean;
  preferredProvider: string | null;
  departureSocPercent: number;
  minSocAtStopPercent: number;
  minSocAtDestinationPercent: number;
  targetSocAfterChargingPercent: number;
  detourToleranceKm: number;
  excludedStationIds: string[];
  forcedStationIdByIndex: Record<number, string>;
  result: RoutePlanResult;
}

/** Oeffnet eine gespeicherte Route erneut: Start/Ziel/manuelle Zwischenstopp-
 * Koordinaten sind bereits bekannt (kein erneutes Geocoding noetig), Route/
 * Ladeplanung werden mit den gespeicherten Einstellungen frisch neu
 * berechnet. */
export async function loadSavedRoute(savedRouteId: string): Promise<SavedRouteDetail> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { data: saved, error } = await supabase
    .from("saved_routes")
    .select("*")
    .eq("id", savedRouteId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !saved) throw new Error("Gespeicherte Route nicht gefunden.");

  const savedRoute = saved as SavedRoute;

  if (!savedRoute.vehicle_id) {
    throw new Error("Das Fahrzeug dieser gespeicherten Route wurde inzwischen aus dem Profil gelöscht.");
  }

  const vehicle = await requireVehicle(supabase, savedRoute.vehicle_id, user.id);
  const caravan = await loadCaravan(supabase, savedRoute.caravan_id, user.id);

  const consumptionKwhPer100km =
    savedRoute.manual_consumption_kwh_per_100km ?? vehicle.consumption_kwh_per_100km ?? DEFAULT_CONSUMPTION_KWH_PER_100KM;
  const consumptionSource: RoutePlanResult["consumptionSource"] = savedRoute.manual_consumption_kwh_per_100km
    ? "manual"
    : vehicle.consumption_kwh_per_100km
      ? "profile"
      : "default";

  const start: GeoPoint = {
    latitude: savedRoute.start_latitude,
    longitude: savedRoute.start_longitude,
    displayName: savedRoute.start_display_name,
  };
  const end: GeoPoint = {
    latitude: savedRoute.end_latitude,
    longitude: savedRoute.end_longitude,
    displayName: savedRoute.end_display_name,
  };
  const manualWaypoints: ManualWaypoint[] = savedRoute.manual_stops.map((w) => ({
    query: w.query,
    displayName: w.display_name,
    latitude: w.latitude,
    longitude: w.longitude,
  }));

  const result = await buildRoutePlanResult({
    supabase,
    start,
    end,
    manualWaypoints,
    vehicle,
    caravan,
    consumptionKwhPer100km,
    consumptionSource,
    settings: {
      preferTrailerSuitable: savedRoute.prefer_trailer_suitable,
      minPowerKw: savedRoute.min_power_kw ?? undefined,
      preferredProvider: savedRoute.preferred_provider ?? undefined,
      departureSocPercent: savedRoute.departure_soc_percent,
      minSocAtStopPercent: savedRoute.min_soc_at_stop_percent,
      minSocAtDestinationPercent: savedRoute.min_soc_at_destination_percent,
      targetSocAfterChargingPercent: savedRoute.target_soc_after_charging_percent,
      detourToleranceKm: savedRoute.detour_tolerance_km,
      excludedStationIds: savedRoute.excluded_station_ids,
      forcedStationIdByIndex: savedRoute.forced_station_id_by_index,
    },
  });

  return {
    name: savedRoute.name,
    startQuery: savedRoute.start_query,
    endQuery: savedRoute.end_query,
    manualStopQueries: manualWaypoints.map((w) => w.query),
    vehicleId: savedRoute.vehicle_id,
    caravanId: savedRoute.caravan_id,
    manualConsumptionKwhPer100km: savedRoute.manual_consumption_kwh_per_100km,
    minPowerKw: savedRoute.min_power_kw,
    preferTrailerSuitable: savedRoute.prefer_trailer_suitable,
    preferredProvider: savedRoute.preferred_provider,
    departureSocPercent: savedRoute.departure_soc_percent,
    minSocAtStopPercent: savedRoute.min_soc_at_stop_percent,
    minSocAtDestinationPercent: savedRoute.min_soc_at_destination_percent,
    targetSocAfterChargingPercent: savedRoute.target_soc_after_charging_percent,
    detourToleranceKm: savedRoute.detour_tolerance_km,
    excludedStationIds: savedRoute.excluded_station_ids,
    forcedStationIdByIndex: savedRoute.forced_station_id_by_index,
    result,
  };
}
