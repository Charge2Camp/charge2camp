"use server";

import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/providers/geocoding/nominatim";
import { osrmProvider } from "@/lib/providers/routing/osrm";
import type { LatLng, RouteResult } from "@/lib/providers/routing/types";
import {
  DEFAULT_CONSUMPTION_KWH_PER_100KM,
  DEFAULT_DETOUR_TOLERANCE_KM,
  distanceAlongRouteKm,
  planTrip,
  type RouteChargingStation,
  type TripPlan,
} from "@/lib/route-planning";
import { assessPersonalCompatibility, summarizeCommunitySuitability } from "@/lib/scoring/trailer-compatibility";
import { getTrailerPinState } from "@/lib/trailer-verdict";
import { sanitizeProviderKeys } from "@/lib/charging-providers";
import { fetchBlockedStationIds } from "@/lib/blocked-stations";
import { distanceKm } from "@/lib/geo";
import { estimateTravelTimeMin } from "@/lib/travel-time";
import { logAppUsageEvent } from "@/lib/analytics";
import type { ManualWaypoint, ManualWaypointWithDistance } from "@/lib/route-timeline";
import type { Caravan, ChargingReview, SavedRoute, TrailerVerdict, Vehicle } from "@/types/database";
import { actionErrorMessage as errorMessage, type ActionResult } from "@/lib/action-result";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Naechste Server Actions dieser Datei werden vom Client (route-planner-form.tsx)
 * direkt per Netzwerkaufruf aufgerufen -- anders als ein normaler Funktionsaufruf
 * innerhalb eines Server Components (z. B. profil/routen/page.tsx ruft
 * loadSavedRoute direkt auf) redaktiert Next.js dabei JEDE geworfene Error-
 * Message in der Produktion zu einer generischen, fuer Nutzer nutzlosen
 * Meldung ("Minified React error #441", siehe Nutzerbericht). Erwartete
 * Fehler (falsche Adresse, geloeschtes Fahrzeug, Route nicht gefunden, ...)
 * werden deshalb NICHT geworfen, sondern als Ergebniswert zurueckgegeben --
 * so bleibt die hilfreiche deutsche Fehlermeldung fuer den Nutzer sichtbar.
 * ActionResult/errorMessage kommen jetzt aus lib/action-result.ts (geteilt
 * mit profil/actions.ts, ladepunkte/[id]/actions.ts,
 * campingplaetze/[id]/actions.ts -- gleiches Problem, gleicher Fix).
 */

// Mindestabstand (km) zwischen Stichprobenpunkten entlang der Route fuer die
// Ladepunkt-Umkreissuche (siehe fetchCorridorChargingStations) -- verhindert
// bei kleiner Umweg-Toleranz zu viele parallele Anfragen auf langen Routen.
// BEWUSST KEIN Maximum (frueher 40 km): der Abstand soll mit der Umweg-
// Toleranz mitwachsen, da der Suchradius jedes Stichprobenpunkts genau
// dieser Toleranz entspricht -- ein gedeckeltes Maximum liesse bei grosser
// Toleranz (bis 100 km, siehe MAX_DETOUR_TOLERANCE_KM) die Umkreise stark
// ueberlappen, ohne die Anzahl der Punkte zu verringern: jeder Punkt fragt
// dann einen deutlich groesseren Kreis ab (Flaeche waechst quadratisch mit
// dem Radius) bei GLEICHBLEIBEND vielen parallelen Anfragen -- das fuehrte
// bei einer grossen, vom Nutzer gewaehlten Umweg-Toleranz auf einer langen
// Route zu einem "Gateway Timeout" beim Neuplanen (Bugreport).
const CORRIDOR_SAMPLE_MIN_SPACING_KM = 10;

/** Waehlt Punkte entlang der Routengeometrie im Abstand `spacingKm`
 * (kumulierte Streckendistanz, nicht Luftlinie) -- Start und Ziel sind
 * immer dabei. Grundlage fuer die Ladepunkt-Umkreissuche an mehreren
 * Stellen der Route statt nur an einem Punkt. */
function sampleRoutePoints(geometry: LatLng[], spacingKm: number): LatLng[] {
  if (geometry.length === 0) return [];
  const samples: LatLng[] = [geometry[0]];
  let distanceSinceLastSample = 0;

  for (let i = 1; i < geometry.length; i++) {
    distanceSinceLastSample += distanceKm(geometry[i - 1], geometry[i]);
    if (distanceSinceLastSample >= spacingKm) {
      samples.push(geometry[i]);
      distanceSinceLastSample = 0;
    }
  }

  const last = geometry[geometry.length - 1];
  if (samples[samples.length - 1] !== last) samples.push(last);
  return samples;
}

/**
 * Ladepunkt-Kandidaten fuer die Ladeplanung: echte Ladepunkte entlang der
 * Route (core.charge_point, per PostGIS-Umkreissuche core.
 * charge_points_within_radius an mehreren entlang der Strecke verteilten
 * Stichprobenpunkten, siehe sampleRoutePoints) statt der fruehen Demo-
 * Tabelle public.charging_stations (siehe Git-History -- bewusste
 * Zwischenloesung, jetzt abgeloest). Eine einzelne Umkreisabfrage gegen die
 * GESAMTE Routenlinie (erster Versuch, core.charge_points_within_corridor)
 * fuehrte bei laengeren Routen zu Datenbank-Timeouts -- mehrere schnelle
 * Punktabfragen parallel sind der bewaehrte, performante Weg (dieselbe RPC
 * wie campsite-charging-links.ts fetchNearbyChargePoints). `radiusKm` =
 * Umweg-Toleranz: dieselbe Grenze, die planTrip danach ohnehin je Kandidat
 * exakt per corridorDistanceKm prueft -- die DB-seitige Vorfilterung spart
 * nur das Laden tausender offensichtlich zu weit entfernter Ladepunkte. */
async function fetchCorridorChargingStations(
  supabase: SupabaseServerClient,
  routeGeometry: LatLng[],
  detourToleranceKm: number
): Promise<RouteChargingStation[]> {
  const spacingKm = Math.max(CORRIDOR_SAMPLE_MIN_SPACING_KM, detourToleranceKm);
  const samplePoints = sampleRoutePoints(routeGeometry, spacingKm);
  const radiusM = Math.max(detourToleranceKm, 1) * 1000;

  const results = await Promise.all(
    samplePoints.map((point) =>
      supabase.schema("core").rpc("charge_points_within_radius", {
        p_lat: point.latitude,
        p_lon: point.longitude,
        p_radius_m: radiusM,
      })
    )
  );

  const stationsById = new Map<string, RouteChargingStation>();
  for (const { data, error } of results) {
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as {
      id: string;
      name: string | null;
      operator: string | null;
      max_power_kw: number | null;
      lat: number;
      lon: number;
      verdict: TrailerVerdict | null;
      drive_through: boolean | null;
    }[];
    for (const row of rows) {
      if (stationsById.has(row.id)) continue;
      stationsById.set(row.id, {
        id: row.id,
        name: row.name,
        provider: row.operator ?? "",
        latitude: row.lat,
        longitude: row.lon,
        power_kw: row.max_power_kw,
        trailerPinState: getTrailerPinState({ verdict: row.verdict ?? "unknown", drive_through: row.drive_through }),
      });
    }
  }
  return Array.from(stationsById.values());
}

interface GeoPoint {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface RoutePlanResult {
  start: { latitude: number; longitude: number; displayName: string };
  end: { latitude: number; longitude: number; displayName: string };
  /** Direkte Route (nur mit manuellen Zwischenstopps, OHNE Ladestopp-Umwege)
   * -- Basis fuer die Ladeplanung/Korridor-Naeheberechnung (planTrip,
   * distanceAlongRouteKm) und fuer replanChargingStop beim Suchen von
   * Alternativ-Ladepunkten. NICHT fuer die Kartendarstellung verwenden,
   * dafuer siehe mapGeometry -- sonst wuerde ein bereits gewaehlter
   * Ladestopp die Korridor-Suche nach Alternativen fuer genau diesen Stopp
   * verzerren (die Route wuerde ja schon zu ihm hinbiegen). */
  geometry: { latitude: number; longitude: number }[];
  /** Route inklusive Umwegen zu allen geplanten Ladestopps (und manuellen
   * Zwischenstopps), ausschliesslich fuer die Kartendarstellung -- sonst
   * würde die gezeichnete Linie an den Ladepunkten vorbeilaufen, obwohl die
   * Fahrt tatsaechlich dort haelt. Faellt bei OSRM-Fehler auf `geometry`
   * zurueck (siehe buildRoutePlanResult). */
  mapGeometry: { latitude: number; longitude: number }[];
  /** Tatsaechliche Gesamtstrecke/-fahrzeit DIESER (Umwege-inklusive)
   * Route, nicht der direkten Basis-Route (siehe `geometry`/`plan.distanceKm`
   * -- die bleiben bewusst die direkte Strecke, Grundlage der SOC-Berechnung).
   * Fuer die Anzeige ("Strecke"/"Fahrzeit" in Tab 2) -- muss sich nach
   * Loeschen/Alternative-Wahl in Tab 2 mit-aendern, sonst zeigt die Karte
   * eine andere Strecke als die daneben angezeigten km/Minuten (Bugreport). */
  mapDistanceKm: number;
  mapDurationMin: number;
  /** Reisezeit dieser Route unter Annahme des landesabhaengigen Anhaenger-
   * Tempolimits abzueglich Sicherheitsabschlag (siehe lib/travel-time.ts) --
   * fuer die Anzeige ("Reisezeit" in Tab 2/3) statt mapDurationMin, das nur
   * die (zu optimistische) PKW-ohne-Anhaenger-Fahrzeit von OSRM ist. */
  travelTimeMin: number;
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
  preferredProviders?: string[];
  avoidedProviders?: string[];
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
 * Die eigentliche Ladeplanung (planTrip) laeuft gegen die DIREKTE Route
 * (start -> manuelle Zwischenstopps -> end, siehe Kommentar bei
 * RoutePlanResult.geometry) -- Ladestopps werden nur als "nahe am
 * Streckenkorridor" ausgewaehlt, die gezeichnete Linie faehrt also nicht
 * wirklich zu ihnen. Fuer die Kartendarstellung wird deshalb hier ein
 * zweiter Routing-Aufruf gemacht, der Start/Ziel/manuelle Zwischenstopps
 * UND alle geplanten Ladestopps in Fahrtreihenfolge (sortiert nach ihrer
 * Position auf der direkten Route) als Wegpunkte durchfaehrt. Schlaegt das
 * fehl (OSRM-Demo-Server ohne SLA), faellt es auf die direkte Route zurueck
 * -- lieber eine ungenaue Linie zeigen als die ganze Planung scheitern zu
 * lassen.
 */
async function buildMapGeometry({
  start,
  end,
  manualWaypointsWithDistance,
  chargingStops,
  fallback,
}: {
  start: GeoPoint;
  end: GeoPoint;
  manualWaypointsWithDistance: ManualWaypointWithDistance[];
  chargingStops: TripPlan["chargingStops"];
  /** Direkte Route als Rueckfallwert bei OSRM-Fehler -- ihre distanceKm/
   * durationMin sind dann zwar nur die direkte (nicht die Umwege-
   * inklusive) Strecke, aber besser als gar keine Anzeige. */
  fallback: RouteResult;
}): Promise<RouteResult> {
  const detourWaypoints = [
    ...manualWaypointsWithDistance.map((w) => ({
      latitude: w.latitude,
      longitude: w.longitude,
      distanceFromStartKm: w.distanceFromStartKm,
    })),
    ...chargingStops.map((stop) => ({
      latitude: stop.station.latitude,
      longitude: stop.station.longitude,
      distanceFromStartKm: stop.distanceFromStartKm,
    })),
  ].sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm);

  if (detourWaypoints.length === 0) return fallback;

  try {
    return await osrmProvider.planRoute({
      start,
      end,
      waypoints: detourWaypoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
    });
  } catch {
    return fallback;
  }
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

  const chargingStations = await fetchCorridorChargingStations(
    supabase,
    route.geometry,
    settings.detourToleranceKm ?? DEFAULT_DETOUR_TOLERANCE_KM
  );

  const plan = planTrip({
    route,
    vehicle,
    chargingStations,
    preferTrailerSuitable: settings.preferTrailerSuitable,
    minPowerKw: settings.minPowerKw,
    preferredProviders: settings.preferredProviders,
    avoidedProviders: settings.avoidedProviders,
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

  const mapRoute = await buildMapGeometry({ start, end, manualWaypointsWithDistance, chargingStops: annotatedPlan.chargingStops, fallback: route });

  return {
    start: { latitude: start.latitude, longitude: start.longitude, displayName: start.displayName },
    end: { latitude: end.latitude, longitude: end.longitude, displayName: end.displayName },
    geometry: route.geometry,
    mapGeometry: mapRoute.geometry,
    mapDistanceKm: mapRoute.distanceKm,
    mapDurationMin: mapRoute.durationMin,
    travelTimeMin: estimateTravelTimeMin(mapRoute.geometry),
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

export async function planRoute(formData: FormData): Promise<ActionResult<RoutePlanResult>> {
  try {
    return { ok: true, data: await planRouteInner(formData) };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Route konnte nicht berechnet werden.") };
  }
}

async function planRouteInner(formData: FormData): Promise<RoutePlanResult> {
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
  const preferredProviders = sanitizeProviderKeys(
    formData.getAll("preferred_providers").filter((v): v is string => typeof v === "string")
  );
  const avoidedProviders = sanitizeProviderKeys(
    formData.getAll("avoided_providers").filter((v): v is string => typeof v === "string")
  );
  const preferTrailerSuitable = formData.get("prefer_trailer_suitable") === "1";
  const manualStopQueries = formData
    .getAll("manual_stop")
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");

  // Wurde "Start"/"Ziel" ueber einen unserer eigenen Campingplatz-Vorschlaege,
  // einen Ladepunkt (Route-hierher-planen-Button) oder die Favoriten-Auswahl
  // gesetzt (siehe AddressAutocomplete `localSuggestions` bzw.
  // favorites-picker-dialog.tsx in route-planner-form.tsx), sind die
  // Koordinaten schon bekannt und werden als verstecktes Formularfeld
  // mitgeschickt -- kein erneutes Geocoding noetig (und bei Demo-Namen wie
  // "[DEMO] ..." ueber Nominatim ohnehin nicht auffindbar).
  function coordsFromHiddenFields(latField: string, lonField: string) {
    const latRaw = formData.get(latField);
    const lonRaw = formData.get(lonField);
    return typeof latRaw === "string" && typeof lonRaw === "string" && latRaw !== "" && lonRaw !== ""
      ? { latitude: Number(latRaw), longitude: Number(lonRaw) }
      : null;
  }
  const startCoordsFromSuggestion = coordsFromHiddenFields("start_latitude", "start_longitude");
  const endCoordsFromSuggestion = coordsFromHiddenFields("end_latitude", "end_longitude");

  const vehicle = await requireVehicle(supabase, vehicleId, user.id);
  const caravan = await loadCaravan(supabase, typeof caravanId === "string" ? caravanId : null, user.id);

  // Nominatim-Nutzungsrichtlinie: max. 1 Anfrage/Sekunde -- alle tatsaechlich
  // per Nominatim aufzuloesenden Orte werden deshalb sequenziell mit Pause
  // geocodiert statt parallel. Ein bereits per Vorschlag aufgeloestes
  // Start/Ziel (s. o.) zaehlt nicht als Nominatim-Aufruf und braucht daher
  // auch keine Wartezeit davor/danach.
  let lastNominatimCallAt = 0;
  async function geocodeRateLimited(query: string) {
    const waitMs = Math.max(0, lastNominatimCallAt + 1000 - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastNominatimCallAt = Date.now();
    return geocodeAddress(query);
  }

  let start: GeoPoint;
  if (startCoordsFromSuggestion) {
    start = { ...startCoordsFromSuggestion, displayName: startQuery };
  } else {
    const geocodedStart = await geocodeRateLimited(startQuery);
    if (!geocodedStart) throw new Error(`Start "${startQuery}" konnte nicht gefunden werden.`);
    start = geocodedStart;
  }

  let end: GeoPoint;
  if (endCoordsFromSuggestion) {
    end = { ...endCoordsFromSuggestion, displayName: endQuery };
  } else {
    const geocodedEnd = await geocodeRateLimited(endQuery);
    if (!geocodedEnd) throw new Error(`Ziel "${endQuery}" konnte nicht gefunden werden.`);
    end = geocodedEnd;
  }

  const manualWaypoints: ManualWaypoint[] = [];
  for (const query of manualStopQueries) {
    const point = await geocodeRateLimited(query);
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

  // Dauerhaft blockierte Ladepunkte (Nutzerwunsch "Blacklist", siehe
  // block-button.tsx) werden bei JEDER Routenplanung ausgeschlossen -- unabhaengig
  // von den nur pro Route geloeschten Stopps (excludedStationIds).
  const blockedStationIds = await fetchBlockedStationIds(supabase, user.id);

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
      preferTrailerSuitable,
      minPowerKw: minPowerKwRaw ? Number(minPowerKwRaw) : undefined,
      preferredProviders,
      avoidedProviders,
      excludedStationIds: blockedStationIds,
      ...(departureSocPercent !== null && { departureSocPercent }),
      ...(minSocAtStopPercent !== null && { minSocAtStopPercent }),
      ...(minSocAtDestinationPercent !== null && { minSocAtDestinationPercent }),
      ...(targetSocAfterChargingPercent !== null && { targetSocAfterChargingPercent }),
      ...(detourToleranceKm !== null && { detourToleranceKm }),
    },
  });

  // Nutzerwunsch: Admin-Statistik "wie viele Routen wurden geplant" -- nur
  // die frische Berechnung hier zaehlt, nicht jedes Neuplanen/Alternative-
  // Waehlen in Tab 2 (replanChargingStopInner) oder erneutes Oeffnen einer
  // gespeicherten Route (loadSavedRoute).
  await logAppUsageEvent(supabase, "route_planned", user.id);

  return result;
}

export interface ReplanResult {
  plan: TripPlan;
  /** Neu berechnete Kartendarstellungs-Route (siehe RoutePlanResult.mapGeometry)
   * -- ohne diese wuerde die Kartenlinie nach dem Loeschen eines Ladestopps
   * oder Waehlen einer Alternative weiterhin durch die ALTEN Ladestopps
   * fuehren (Bugreport: "Route auf der Karte wird nicht angepasst"). */
  mapGeometry: RouteResult["geometry"];
  /** Siehe RoutePlanResult.mapDistanceKm/mapDurationMin -- muss zusammen mit
   * mapGeometry neu berechnet werden, sonst zeigen "Strecke"/"Fahrzeit" nach
   * Loeschen/Alternative-Wahl weiterhin die alten Werte, obwohl die Karte
   * schon die neue Route zeigt (Bugreport). */
  mapDistanceKm: number;
  mapDurationMin: number;
  /** Siehe RoutePlanResult.travelTimeMin -- muss zusammen mit mapGeometry neu
   * berechnet werden. */
  travelTimeMin: number;
}

/**
 * Berechnet nur die Ladeplanung neu (z. B. nachdem der Nutzer den
 * vorgeschlagenen Ladestopp geloescht oder eine Alternative gewaehlt hat) --
 * ohne erneutes Geocoding/Routing der DIREKTEN Route, da Start/Ziel/
 * Streckengeometrie unveraendert bleiben (vermeidet unnoetige Nominatim-/
 * OSRM-Anfragen dafuer). Die Kartendarstellungs-Route (mapGeometry) haengt
 * aber von den gewaehlten Ladestopps ab und wird deshalb hier IMMER neu
 * gebaut (buildMapGeometry, ein zusaetzlicher OSRM-Aufruf mit den neuen
 * Ladestopps als Wegpunkte).
 */
export async function replanChargingStop(
  input: Parameters<typeof replanChargingStopInner>[0]
): Promise<ActionResult<ReplanResult>> {
  try {
    return { ok: true, data: await replanChargingStopInner(input) };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Ladestopp konnte nicht neu geplant werden.") };
  }
}

async function replanChargingStopInner(input: {
  vehicleId: string;
  caravanId?: string;
  start: GeoPoint;
  end: GeoPoint;
  manualWaypoints: ManualWaypointWithDistance[];
  route: { distanceKm: number; durationMin: number; geometry: { latitude: number; longitude: number }[] };
  consumptionKwhPer100km: number;
  preferTrailerSuitable: boolean;
  minPowerKw?: number;
  preferredProviders?: string[];
  avoidedProviders?: string[];
  departureSocPercent: number;
  minSocAtStopPercent: number;
  minSocAtDestinationPercent: number;
  targetSocAfterChargingPercent: number;
  detourToleranceKm: number;
  excludedStationIds: string[];
  forcedStationIdByIndex?: Record<number, string>;
}): Promise<ReplanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet.");

  const vehicle = await requireVehicle(supabase, input.vehicleId, user.id);
  const caravan = await loadCaravan(supabase, input.caravanId, user.id);

  const chargingStations = await fetchCorridorChargingStations(
    supabase,
    input.route.geometry,
    input.detourToleranceKm
  );

  // Dauerhaft blockierte Ladepunkte auch hier ausschliessen (frisch geladene
  // Kandidaten, siehe fetchCorridorChargingStations oben -- kennen die
  // Blockierliste sonst nicht, siehe Kommentar in planRoute).
  const blockedStationIds = await fetchBlockedStationIds(supabase, user.id);

  const plan = planTrip({
    route: input.route,
    vehicle,
    chargingStations,
    preferTrailerSuitable: input.preferTrailerSuitable,
    minPowerKw: input.minPowerKw,
    preferredProviders: input.preferredProviders,
    avoidedProviders: input.avoidedProviders,
    consumptionKwhPer100km: input.consumptionKwhPer100km,
    departureSocPercent: input.departureSocPercent,
    minSocAtStopPercent: input.minSocAtStopPercent,
    minSocAtDestinationPercent: input.minSocAtDestinationPercent,
    targetSocAfterChargingPercent: input.targetSocAfterChargingPercent,
    detourToleranceKm: input.detourToleranceKm,
    excludedStationIds: [...input.excludedStationIds, ...blockedStationIds],
    forcedStationIdByIndex: input.forcedStationIdByIndex,
  });

  const userTrailerLengthM =
    vehicle.length_m !== null && caravan?.length_m ? vehicle.length_m + caravan.length_m : null;
  const annotatedPlan = await annotateChargingStops(supabase, plan, userTrailerLengthM);

  const mapRoute = await buildMapGeometry({
    start: input.start,
    end: input.end,
    manualWaypointsWithDistance: input.manualWaypoints,
    chargingStops: annotatedPlan.chargingStops,
    fallback: input.route,
  });

  return {
    plan: annotatedPlan,
    mapGeometry: mapRoute.geometry,
    mapDistanceKm: mapRoute.distanceKm,
    mapDurationMin: mapRoute.durationMin,
    travelTimeMin: estimateTravelTimeMin(mapRoute.geometry),
  };
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
  preferredProviders: string[];
  avoidedProviders: string[];
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
export async function saveRoute(input: SaveRouteInput): Promise<ActionResult<{ id: string }>> {
  try {
    return { ok: true, data: await saveRouteInner(input) };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Route konnte nicht gespeichert werden.") };
  }
}

async function saveRouteInner(input: SaveRouteInput): Promise<{ id: string }> {
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
      preferred_providers: input.preferredProviders,
      avoided_providers: input.avoidedProviders,
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
  preferredProviders: string[];
  avoidedProviders: string[];
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
export async function loadSavedRoute(savedRouteId: string): Promise<ActionResult<SavedRouteDetail>> {
  try {
    return { ok: true, data: await loadSavedRouteInner(savedRouteId) };
  } catch (err) {
    return { ok: false, error: errorMessage(err, "Gespeicherte Route konnte nicht geladen werden.") };
  }
}

async function loadSavedRouteInner(savedRouteId: string): Promise<SavedRouteDetail> {
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

  // Dauerhaft blockierte Ladepunkte kommen zu den beim Speichern kuratierten
  // excluded_station_ids dazu -- der Nutzer koennte einen Ladepunkt erst
  // NACH dem Speichern dieser Route blockiert haben.
  const blockedStationIds = await fetchBlockedStationIds(supabase, user.id);

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
      preferredProviders: savedRoute.preferred_providers,
      avoidedProviders: savedRoute.avoided_providers,
      departureSocPercent: savedRoute.departure_soc_percent,
      minSocAtStopPercent: savedRoute.min_soc_at_stop_percent,
      minSocAtDestinationPercent: savedRoute.min_soc_at_destination_percent,
      targetSocAfterChargingPercent: savedRoute.target_soc_after_charging_percent,
      detourToleranceKm: savedRoute.detour_tolerance_km,
      excludedStationIds: [...savedRoute.excluded_station_ids, ...blockedStationIds],
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
    preferredProviders: savedRoute.preferred_providers,
    avoidedProviders: savedRoute.avoided_providers,
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
