import { googleMapsNavigationProvider } from "@/lib/providers/navigation";
import { buildRouteTimeline } from "@/lib/route-timeline";
import type { RoutePlanResult } from "@/app/routenplaner/actions";

export interface RouteSegment {
  label: string;
  url: string;
}

/** Ein Navigations-Link pro Etappe (Start -> 1. Ladestopp -> ... -> Ziel),
 * damit z. B. nur der Teil zwischen zwei Ladestopps in Google Maps
 * nachnavigiert werden kann -- zusaetzlich zur Navigation der Gesamtroute.
 * Beruecksichtigt auch manuell hinzugefuegte Zwischenstopps (§ ABRP-Vorbild
 * "Add Stop") in der korrekten Streckenposition. Gemeinsam genutzt vom
 * Routenplaner (Tab 3, siehe route-planner-form.tsx) und "Meine Routen"
 * (profil/routen/page.tsx), damit beide exakt dieselben Links bauen. */
export function buildRouteSegments(result: RoutePlanResult): { segments: RouteSegment[]; fullRouteUrl: string } {
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
    stops: timeline.slice(1, -1).map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
  });

  return { segments, fullRouteUrl };
}
