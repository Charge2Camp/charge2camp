import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteSavedRoute } from "@/app/profil/actions";
import { loadSavedRoute, type RoutePlanResult } from "@/app/routenplaner/actions";
import { googleMapsNavigationProvider, type NavigationPoint } from "@/lib/providers/navigation";
import { NavigationLink } from "@/components/profile/navigation-link";
import type { SavedRoute } from "@/types/database";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

interface RouteSegment {
  label: string;
  url: string;
}

/** Ein Navigations-Link pro Etappe (Start -> 1. Ladestopp -> ... -> Ziel),
 * damit z. B. nur der Teil zwischen zwei Ladestopps in Google Maps
 * nachnavigiert werden kann -- zusaetzlich zur Navigation der Gesamtroute. */
function buildSegments(result: RoutePlanResult): { segments: RouteSegment[]; fullRouteUrl: string } {
  const points: (NavigationPoint & { label: string })[] = [
    { label: "Start", latitude: result.start.latitude, longitude: result.start.longitude },
    ...result.plan.chargingStops.map((stop, index) => ({
      label: `${index + 1}. Ladestopp`,
      latitude: stop.station.latitude,
      longitude: stop.station.longitude,
    })),
    { label: "Ziel", latitude: result.end.latitude, longitude: result.end.longitude },
  ];

  const segments: RouteSegment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({
      label: `${points[i].label} → ${points[i + 1].label}`,
      url: googleMapsNavigationProvider.buildUrl({ origin: points[i], destination: points[i + 1], stops: [] }),
    });
  }

  const fullRouteUrl = googleMapsNavigationProvider.buildUrl({
    origin: result.start,
    destination: result.end,
    stops: result.plan.chargingStops.map((stop) => ({
      latitude: stop.station.latitude,
      longitude: stop.station.longitude,
    })),
  });

  return { segments, fullRouteUrl };
}

export default async function SavedRoutesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: savedRoutes } = await supabase
    .from("saved_routes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const routes = (savedRoutes as SavedRoute[]) ?? [];

  // Die gespeicherte Route enthaelt bewusst keinen fertigen Ladeplan (siehe
  // Migration/architecture.md) -- fuer Gespann/Ladestopp-Anzeige und die
  // Segment-Navigation wird hier mit den gespeicherten Einstellungen frisch
  // neu geplant. Schlaegt das fuer eine Route fehl (z. B. Fahrzeug
  // inzwischen geloescht), wird das ehrlich nur fuer diese eine Route
  // angezeigt, statt die ganze Seite abzubrechen.
  const rows = await Promise.all(
    routes.map(async (route) => {
      try {
        const detail = await loadSavedRoute(route.id);
        return { route, result: detail.result, error: null as string | null };
      } catch (err) {
        return {
          route,
          result: null,
          error: err instanceof Error ? err.message : "Route konnte nicht geladen werden.",
        };
      }
    })
  );

  return (
    <section>
      <h2 className="text-lg font-semibold">Meine Routen</h2>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-black/50 dark:text-white/50">
          Noch keine Route gespeichert. Im{" "}
          <a href="/routenplaner" className="underline">
            Routenplaner
          </a>{" "}
          kannst du eine geplante Route speichern.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {rows.map(({ route, result, error }) => (
            <li key={route.id} className="rounded-lg border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{route.name}</p>
                  <p className="text-xs text-black/40 dark:text-white/40">
                    Gespeichert am {formatDate(route.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <a
                    href={`/routenplaner?savedRouteId=${route.id}`}
                    className="text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    Im Routenplaner öffnen
                  </a>
                  <form action={deleteSavedRoute}>
                    <input type="hidden" name="id" value={route.id} />
                    <button
                      type="submit"
                      className="text-red-600 hover:underline"
                      aria-label={`Route "${route.name}" entfernen`}
                    >
                      Entfernen
                    </button>
                  </form>
                </div>
              </div>

              {error ? (
                <p className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
                  {error}
                </p>
              ) : (
                result && (
                  <div className="mt-3 flex flex-col gap-2 text-sm text-black/70 dark:text-white/70">
                    <p>
                      Gespann: {result.vehicle.manufacturer} {result.vehicle.model}
                      {result.caravan && ` + ${result.caravan.manufacturer} ${result.caravan.model}`}
                    </p>
                    <p>
                      {result.start.displayName} → {result.end.displayName}
                    </p>
                    <p>
                      {result.plan.chargingStops.length === 0
                        ? "Kein Ladestopp nötig"
                        : `${result.plan.chargingStops.length} Ladestopp${result.plan.chargingStops.length === 1 ? "" : "s"}`}
                    </p>

                    {(() => {
                      const { segments, fullRouteUrl } = buildSegments(result);
                      return (
                        <div className="mt-2 flex flex-col gap-2">
                          <NavigationLink
                            href={fullRouteUrl}
                            className="w-fit rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                          >
                            Gesamte Route navigieren (Google Maps)
                          </NavigationLink>
                          {segments.length > 1 && (
                            <div>
                              <p className="text-xs text-black/50 dark:text-white/50">
                                Oder nur eine einzelne Etappe navigieren:
                              </p>
                              <div className="mt-1 flex flex-wrap gap-2">
                                {segments.map((segment) => (
                                  <NavigationLink
                                    key={segment.label}
                                    href={segment.url}
                                    className="rounded-md border border-black/15 px-3 py-1.5 text-xs hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                                  >
                                    {segment.label}
                                  </NavigationLink>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
