import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/require-user";
import type { Caravan, Vehicle } from "@/types/database";
import { fetchCampsiteDestinationOptions } from "@/lib/campsites";
import { fetchFavoriteDestinations } from "@/lib/favorites";
import { RoutePlannerForm } from "@/components/routing/route-planner-form";

export default async function RoutePlannerPage({
  searchParams,
}: {
  searchParams: Promise<{
    savedRouteId?: string;
    destination_campsite_id?: string;
    destination_station_id?: string;
    resumeDraft?: string;
  }>;
}) {
  // Browsen/Routenplanung erfordert Login (Sicherheits-Audit) -- siehe
  // require-user.ts.
  const user = await requireUser("/routenplaner");
  const supabase = await createClient();

  const {
    savedRouteId,
    destination_campsite_id: destinationCampsiteId,
    destination_station_id: destinationStationId,
    resumeDraft,
  } = await searchParams;

  const [
    { data: vehicles },
    { data: caravans },
    campsiteDestinations,
    stationResult,
    favorites,
    { data: profile },
    { data: savedRouteRows },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("caravans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    fetchCampsiteDestinationOptions(),
    destinationStationId
      ? createAdminClient()
          .schema("core")
          .from("charge_point_geo")
          .select("name, operator, lat, lon")
          .eq("id", destinationStationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchFavoriteDestinations(user.id),
    supabase
      .from("profiles")
      .select(
        "home_address, home_latitude, home_longitude, default_vehicle_id, default_caravan_id, preferred_charging_providers, avoided_charging_providers"
      )
      .eq("id", user.id)
      .maybeSingle(),
    // Nur die schlanken Anzeige-Felder (kein Ladeplan, siehe saved_routes-
    // Kommentar in actions.ts) -- fuer den "Gespeicherte Route öffnen"-Picker
    // in route-planner-form.tsx, bevor eine Route berechnet wurde.
    // vehicle_id/caravan_id zusaetzlich als Rueckfallebene fuer die
    // Gespann-Vorbelegung unten, falls kein explizites Standard-Gespann
    // gesetzt ist (profiles.default_vehicle_id/default_caravan_id, siehe
    // profil/gespann).
    supabase
      .from("saved_routes")
      .select("id, name, start_display_name, end_display_name, created_at, vehicle_id, caravan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  const savedRoutes = (savedRouteRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    startDisplayName: r.start_display_name,
    endDisplayName: r.end_display_name,
    createdAt: r.created_at,
  }));

  // Vorbelegung Gespann-Auswahl: zuerst das explizite Standard-Gespann aus
  // dem Profil (profiles.default_vehicle_id/default_caravan_id, oben auf
  // profil/gespann gesetzt) -- sonst als Rueckfallebene das Fahrzeug/der
  // Wohnwagen aus der zuletzt gespeicherten Route, falls es dieses noch im
  // Profil gibt -- sonst das zuletzt im Profil angelegte (Listen bereits
  // nach created_at absteigend sortiert). Ohne jede Angabe bleibt die
  // Auswahl leer.
  const vehicleIds = new Set((vehicles ?? []).map((v) => v.id));
  const caravanIds = new Set((caravans ?? []).map((c) => c.id));
  const defaultVehicleId = profile?.default_vehicle_id;
  const defaultCaravanId = profile?.default_caravan_id;
  const lastRouteVehicleId = savedRouteRows?.[0]?.vehicle_id;
  const lastRouteCaravanId = savedRouteRows?.[0]?.caravan_id;
  const initialVehicleId =
    (defaultVehicleId && vehicleIds.has(defaultVehicleId) ? defaultVehicleId : null) ??
    (lastRouteVehicleId && vehicleIds.has(lastRouteVehicleId) ? lastRouteVehicleId : null) ??
    vehicles?.[0]?.id ??
    "";
  const initialCaravanId =
    (defaultCaravanId && caravanIds.has(defaultCaravanId) ? defaultCaravanId : null) ??
    (lastRouteCaravanId && caravanIds.has(lastRouteCaravanId) ? lastRouteCaravanId : null) ??
    caravans?.[0]?.id ??
    "";

  const homeAddress =
    profile?.home_address && profile.home_latitude != null && profile.home_longitude != null
      ? { name: profile.home_address, latitude: profile.home_latitude, longitude: profile.home_longitude }
      : null;

  // Vom "Route hierher planen"-Button auf der Campingplatz- bzw.
  // Ladepunkt-Detailseite (§ campingplaetze/[id]/page.tsx,
  // ladepunkte/[id]/page.tsx) -- Ziel wird damit schon beim ersten Rendern
  // vorbelegt, inkl. bekannter Koordinaten (kein erneutes Geocoding noetig,
  // siehe route-planner-form.tsx). Hoechstens einer der beiden Query-
  // Parameter ist in der Praxis gesetzt.
  const destinationCampsite = destinationCampsiteId
    ? campsiteDestinations.find((c) => c.id === destinationCampsiteId)
    : undefined;
  const initialDestination =
    destinationCampsite ??
    (stationResult.data
      ? {
          name: stationResult.data.name ?? stationResult.data.operator,
          latitude: stationResult.data.lat,
          longitude: stationResult.data.lon,
        }
      : undefined);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Routenplaner</h1>
      <p className="mt-1 text-sm text-text-muted">
        Route mit anhängertauglichen Ladestopps für dein Gespann planen.
      </p>

      <div className="mt-8">
        <RoutePlannerForm
          vehicles={(vehicles as Vehicle[]) ?? []}
          caravans={(caravans as Caravan[]) ?? []}
          initialPreferredProviders={profile?.preferred_charging_providers ?? []}
          initialAvoidedProviders={profile?.avoided_charging_providers ?? []}
          campsiteDestinations={campsiteDestinations}
          favorites={favorites}
          homeAddress={homeAddress}
          savedRoutes={savedRoutes}
          initialVehicleId={initialVehicleId}
          initialCaravanId={initialCaravanId}
          initialDestination={initialDestination}
          initialSavedRouteId={savedRouteId}
          resumeDraft={resumeDraft === "1"}
        />
      </div>
    </div>
  );
}
