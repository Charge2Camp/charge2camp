import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { deleteSavedRoute } from "@/app/profil/actions";
import { loadSavedRoute, type RoutePlanResult } from "@/app/routenplaner/actions";
import { googleMapsNavigationProvider } from "@/lib/providers/navigation";
import { buildRouteTimeline } from "@/lib/route-timeline";
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
 * nachnavigiert werden kann -- zusaetzlich zur Navigation der Gesamtroute.
 * Beruecksichtigt auch manuell hinzugefuegte Zwischenstopps (§ ABRP-Vorbild
 * "Add Stop") in der korrekten Streckenposition. */
function buildSegments(result: RoutePlanResult): { segments: RouteSegment[]; fullRouteUrl: string } {
  const timeline = buildRouteTimeline({
    start: result.start,
    end: result.end,
    distanceKm: result.plan.distanceKm,
    chargingStops: result.plan.chargingStops,
    manualWaypoints: result.manualWaypoints,
  });

  const segments: RouteSegment[] = [];
  for (let i = 0; i < timeline.length - 1; i++) {
    segments.push({
      label: `${timeline[i].label} → ${timeline[i + 1].label}`,
      url: googleMapsNavigationProvider.buildUrl({ origin: timeline[i], destination: timeline[i + 1], stops: [] }),
    });
  }

  const fullRouteUrl = googleMapsNavigationProvider.buildUrl({
    origin: result.start,
    destination: result.end,
    stops: timeline
      .slice(1, -1)
      .map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
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
                <div className="flex shrink-0 flex-wrap items-center gap-1 text-sm">
                  <a
                    href={`/routenplaner?savedRouteId=${route.id}`}
                    className="flex min-h-11 items-center px-2 text-route hover:underline "
                  >
                    Im Routenplaner öffnen
                  </a>
                  <form action={deleteSavedRoute}>
                    <input type="hidden" name="id" value={route.id} />
                    <button
                      type="submit"
                      className="flex min-h-11 items-center px-2 text-red-600 hover:underline"
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
                            className="w-fit min-h-11 rounded-md bg-action px-4 py-2.5 text-sm font-medium text-base hover:bg-action-hover"
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
                                    className="min-h-11 rounded-md border border-black/15 px-3 py-2.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
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
