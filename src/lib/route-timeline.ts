import type { ChargingStopPlan } from "@/lib/route-planning";

/**
 * Manuell hinzugefuegter Zwischenstopp (§ ABRP-Vorbild "Add Stop"):
 * unabhaengig vom Ladebedarf, muss zwingend durchfahren werden (als
 * Wegpunkt in die OSRM-Anfrage eingespeist, siehe
 * src/app/routenplaner/actions.ts). Wird NICHT von planTrip verwaltet --
 * anders als Ladestopps kann er im Routenuebersicht-Popup nicht geloescht
 * werden (das wuerde die tatsaechlich gefahrene Strecke aendern und eine
 * komplette Neuberechnung erfordern); Aendern/Entfernen geschieht ueber das
 * Hauptformular vor dem (Neu-)Berechnen der Route.
 */
export interface ManualWaypoint {
  query: string;
  displayName: string;
  latitude: number;
  longitude: number;
}

export interface ManualWaypointWithDistance extends ManualWaypoint {
  distanceFromStartKm: number;
}

export interface TimelinePoint {
  kind: "start" | "end" | "charging" | "manual";
  label: string;
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  /** Nur bei kind === "charging": Index in TripPlan.chargingStops (fuer Loeschen/Alternativen-Auswahl im Popup). */
  chargingStopIndex?: number;
  chargingStop?: ChargingStopPlan;
}

/** Baut eine nach Streckenposition sortierte Liste aus Start, Ladestopps,
 * manuellen Zwischenstopps und Ziel -- gemeinsame Grundlage fuer die
 * Routenuebersicht-Anzeige und die Google-Maps-Segment-Navigation, damit
 * beide dieselbe (korrekte) Reihenfolge verwenden. */
export function buildRouteTimeline(input: {
  start: { latitude: number; longitude: number; displayName: string };
  end: { latitude: number; longitude: number; displayName: string };
  distanceKm: number;
  chargingStops: ChargingStopPlan[];
  manualWaypoints: ManualWaypointWithDistance[];
}): TimelinePoint[] {
  const points: TimelinePoint[] = [
    {
      kind: "start",
      label: "Start",
      latitude: input.start.latitude,
      longitude: input.start.longitude,
      distanceFromStartKm: 0,
    },
    ...input.chargingStops.map((stop, index) => ({
      kind: "charging" as const,
      label: `${index + 1}. Ladestopp`,
      latitude: stop.station.latitude,
      longitude: stop.station.longitude,
      distanceFromStartKm: stop.distanceFromStartKm,
      chargingStopIndex: index,
      chargingStop: stop,
    })),
    ...input.manualWaypoints.map((waypoint) => ({
      kind: "manual" as const,
      label: waypoint.displayName,
      latitude: waypoint.latitude,
      longitude: waypoint.longitude,
      distanceFromStartKm: waypoint.distanceFromStartKm,
    })),
    {
      kind: "end",
      label: "Ziel",
      latitude: input.end.latitude,
      longitude: input.end.longitude,
      distanceFromStartKm: input.distanceKm,
    },
  ];

  // Array.prototype.sort ist stabil -- bei gleicher Distanz bleibt die
  // Einfuegereihenfolge (start, charging, manual, end) erhalten.
  return points.sort((a, b) => a.distanceFromStartKm - b.distanceFromStartKm);
}
