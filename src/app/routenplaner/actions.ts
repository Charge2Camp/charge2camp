"use server";

import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";
import { osrmProvider } from "@/lib/providers/routing/osrm";
import { DEFAULT_CONSUMPTION_KWH_PER_100KM, planTrip, type TripPlan } from "@/lib/route-planning";
import type { Caravan, ChargingStation, Vehicle } from "@/types/database";

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

function requireString(value: FormDataEntryValue | null, label: string): string {
  if (!value || typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} fehlt.`);
  }
  return value.trim();
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

  const plan = planTrip({
    route,
    vehicle: vehicle as Vehicle,
    chargingStations: (chargingStations as ChargingStation[]) ?? [],
    preferTrailerSuitable,
    minPowerKw: minPowerKwRaw ? Number(minPowerKwRaw) : undefined,
    consumptionKwhPer100km,
  });

  return {
    start: { latitude: start.latitude, longitude: start.longitude, displayName: start.displayName },
    end: { latitude: end.latitude, longitude: end.longitude, displayName: end.displayName },
    geometry: route.geometry,
    vehicle: { manufacturer: vehicle.manufacturer, model: vehicle.model },
    caravan: caravan ? { manufacturer: caravan.manufacturer, model: caravan.model } : null,
    consumptionSource,
    plan,
  };
}
