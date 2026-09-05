"use server";

import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";
import { osrmProvider } from "@/lib/providers/routing/osrm";
import { DEFAULT_CONSUMPTION_KWH_PER_100KM, planTrip, type TripPlan } from "@/lib/route-planning";
import { assessPersonalCompatibility, summarizeCommunitySuitability } from "@/lib/scoring/trailer-compatibility";
import type { Caravan, ChargingReview, ChargingStation, Vehicle } from "@/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export interface RoutePlanResult {
  start: { latitude: number; longitude: number; displayName: string };
  end: { latitude: number; longitude: number; displayName: string };
  geometry: { latitude: number; longitude: number }[];
  vehicle: Pick<Vehicle, "manufacturer" | "model">;
  caravan: Pick<Caravan, "manufacturer" | "model"> | null;
  consumptionSource: "manual" | "profile" | "default";
  plan: TripPlan;
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
 * Reichert den geplanten Ladestopp sowie dessen Alternativen um eine
 * persoenliche Eignungseinschaetzung fuer das konkrete Gespann des Nutzers
 * an (§20) -- planTrip selbst kennt keine charging_reviews (reine
 * Planungslogik ohne DB-Zugriff, siehe route-planning.ts). Ohne Wohnwagen
 * im Profil bleibt personalCompatibility null (nur die allgemeine
 * trailer_suitable-Einstufung wird angezeigt).
 */
async function annotatePersonalCompatibility(
  supabase: SupabaseServerClient,
  plan: TripPlan,
  userTrailerLengthM: number | null
): Promise<TripPlan> {
  if (!plan.chargingStop || userTrailerLengthM === null) return plan;

  const stationIds = [
    plan.chargingStop.station.id,
    ...plan.chargingStop.alternatives.map((a) => a.station.id),
  ];

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

  function personalCompatibilityFor(stationId: string) {
    const stationReviews = reviewsByStation.get(stationId) ?? [];
    const summary = summarizeCommunitySuitability(stationReviews);
    return assessPersonalCompatibility(summary, userTrailerLengthM);
  }

  return {
    ...plan,
    chargingStop: {
      ...plan.chargingStop,
      personalCompatibility: personalCompatibilityFor(plan.chargingStop.station.id),
      alternatives: plan.chargingStop.alternatives.map((alt) => ({
        ...alt,
        personalCompatibility: personalCompatibilityFor(alt.station.id),
      })),
    },
  };
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
  const preferTrailerSuitable = formData.get("prefer_trailer_suitable") === "1";

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (vehicleError || !vehicle) throw new Error("Fahrzeug nicht gefunden.");

  let caravan: Caravan | null = null;
  if (typeof caravanId === "string" && caravanId) {
    const { data } = await supabase
      .from("caravans")
      .select("*")
      .eq("id", caravanId)
      .eq("user_id", user.id)
      .maybeSingle();
    caravan = data as Caravan | null;
  }

  const start = await geocodeAddress(startQuery);
  if (!start) throw new Error(`Start "${startQuery}" konnte nicht gefunden werden.`);
  // Nominatim-Nutzungsrichtlinie: max. 1 Anfrage/Sekunde.
  await new Promise((resolve) => setTimeout(resolve, 1000));
  const end = await geocodeAddress(endQuery);
  if (!end) throw new Error(`Ziel "${endQuery}" konnte nicht gefunden werden.`);

  const route = await osrmProvider.planRoute({ start, end });

  const { data: chargingStations } = await supabase.from("charging_stations").select("*");

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

  const plan = planTrip({
    route,
    vehicle: vehicle as Vehicle,
    chargingStations: (chargingStations as ChargingStation[]) ?? [],
    preferTrailerSuitable,
    minPowerKw: minPowerKwRaw ? Number(minPowerKwRaw) : undefined,
    consumptionKwhPer100km,
    ...(departureSocPercent !== null && { departureSocPercent }),
    ...(minSocAtStopPercent !== null && { minSocAtStopPercent }),
    ...(minSocAtDestinationPercent !== null && { minSocAtDestinationPercent }),
    ...(targetSocAfterChargingPercent !== null && { targetSocAfterChargingPercent }),
    ...(detourToleranceKm !== null && { detourToleranceKm }),
  });

  const userTrailerLengthM =
    vehicle.length_m !== null && caravan?.length_m ? vehicle.length_m + caravan.length_m : null;
  const annotatedPlan = await annotatePersonalCompatibility(supabase, plan, userTrailerLengthM);

  return {
    start: { latitude: start.latitude, longitude: start.longitude, displayName: start.displayName },
    end: { latitude: end.latitude, longitude: end.longitude, displayName: end.displayName },
    geometry: route.geometry,
    vehicle: { manufacturer: vehicle.manufacturer, model: vehicle.model },
    caravan: caravan ? { manufacturer: caravan.manufacturer, model: caravan.model } : null,
    consumptionSource,
    plan: annotatedPlan,
  };
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
  departureSocPercent: number;
  minSocAtStopPercent: number;
  minSocAtDestinationPercent: number;
  targetSocAfterChargingPercent: number;
  detourToleranceKm: number;
  excludedStationIds: string[];
  forcedStationId?: string;
}): Promise<TripPlan> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("*")
    .eq("id", input.vehicleId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (vehicleError || !vehicle) throw new Error("Fahrzeug nicht gefunden.");

  let caravan: Caravan | null = null;
  if (input.caravanId) {
    const { data } = await supabase
      .from("caravans")
      .select("*")
      .eq("id", input.caravanId)
      .eq("user_id", user.id)
      .maybeSingle();
    caravan = data as Caravan | null;
  }

  const { data: chargingStations } = await supabase.from("charging_stations").select("*");

  const plan = planTrip({
    route: input.route,
    vehicle: vehicle as Vehicle,
    chargingStations: (chargingStations as ChargingStation[]) ?? [],
    preferTrailerSuitable: input.preferTrailerSuitable,
    minPowerKw: input.minPowerKw,
    consumptionKwhPer100km: input.consumptionKwhPer100km,
    departureSocPercent: input.departureSocPercent,
    minSocAtStopPercent: input.minSocAtStopPercent,
    minSocAtDestinationPercent: input.minSocAtDestinationPercent,
    targetSocAfterChargingPercent: input.targetSocAfterChargingPercent,
    detourToleranceKm: input.detourToleranceKm,
    excludedStationIds: input.excludedStationIds,
    forcedStationId: input.forcedStationId,
  });

  const userTrailerLengthM =
    vehicle.length_m !== null && caravan?.length_m ? vehicle.length_m + caravan.length_m : null;
  return annotatePersonalCompatibility(supabase, plan, userTrailerLengthM);
}
