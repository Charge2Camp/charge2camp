import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
  }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const {
    savedRouteId,
    destination_campsite_id: destinationCampsiteId,
    destination_station_id: destinationStationId,
  } = await searchParams;

  const [
    { data: vehicles },
    { data: caravans },
    { data: providerRows },
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
    supabase.from("charging_stations").select("provider"),
    fetchCampsiteDestinationOptions(),
    destinationStationId
      ? supabase
          .schema("core")
          .from("charge_point_geo")
          .select("name, operator, lat, lon")
          .eq("id", destinationStationId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchFavoriteDestinations(user.id),
    supabase.from("profiles").select("home_address, home_latitude, home_longitude").eq("id", user.id).maybeSingle(),
    // Nur die schlanken Anzeige-Felder (kein Ladeplan, siehe saved_routes-
    // Kommentar in actions.ts) -- fuer den "Gespeicherte Route öffnen"-Picker
    // in route-planner-form.tsx, bevor eine Route berechnet wurde.
    supabase
      .from("saved_routes")
      .select("id, name, start_display_name, end_display_name, created_at")
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

  const homeAddress =
    profile?.home_address && profile.home_latitude != null && profile.home_longitude != null
      ? { name: profile.home_address, latitude: profile.home_latitude, longitude: profile.home_longitude }
      : null;

  const providers = Array.from(new Set((providerRows ?? []).map((r) => r.provider as string))).sort();

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
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Route mit anhängertauglichen Ladestopps für dein Gespann planen.
      </p>

      <div className="mt-8">
        <RoutePlannerForm
          vehicles={(vehicles as Vehicle[]) ?? []}
          caravans={(caravans as Caravan[]) ?? []}
          providers={providers}
          campsiteDestinations={campsiteDestinations}
          favorites={favorites}
          homeAddress={homeAddress}
          savedRoutes={savedRoutes}
          initialDestination={initialDestination}
          initialSavedRouteId={savedRouteId}
        />
      </div>
    </div>
  );
}
