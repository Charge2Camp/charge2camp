import { describe, expect, it } from "vitest";
import type { ChargingStopPlan } from "@/lib/route-planning";
import { buildRouteTimeline } from "@/lib/route-timeline";

const stop = (distanceFromStartKm: number): ChargingStopPlan =>
  ({
    distanceFromStartKm,
    station: { latitude: 50, longitude: 10 },
  }) as unknown as ChargingStopPlan;

const input = {
  start: { latitude: 48, longitude: 11, displayName: "A" },
  end: { latitude: 53, longitude: 13, displayName: "B" },
  distanceKm: 600,
};

describe("buildRouteTimeline", () => {
  it("setzt Start zuerst und Ziel zuletzt, ohne Zwischenstopps", () => {
    const t = buildRouteTimeline({ ...input, chargingStops: [], manualWaypoints: [] });
    expect(t.map((p) => p.kind)).toEqual(["start", "end"]);
    expect(t[1].distanceFromStartKm).toBe(600);
  });

  it("sortiert Ladestopps und manuelle Stopps nach Streckenposition", () => {
    const t = buildRouteTimeline({
      ...input,
      chargingStops: [stop(400), stop(150)],
      manualWaypoints: [
        { query: "q", displayName: "Mitte", latitude: 51, longitude: 12, distanceFromStartKm: 300 },
      ],
    });
    expect(t.map((p) => p.distanceFromStartKm)).toEqual([0, 150, 300, 400, 600]);
    expect(t.map((p) => p.kind)).toEqual(["start", "charging", "manual", "charging", "end"]);
  });

  it("behaelt chargingStopIndex aus der Eingabereihenfolge", () => {
    const t = buildRouteTimeline({ ...input, chargingStops: [stop(400), stop(150)], manualWaypoints: [] });
    const charging = t.filter((p) => p.kind === "charging");
    expect(charging.map((p) => p.chargingStopIndex)).toEqual([1, 0]);
    expect(charging.map((p) => p.label)).toEqual(["2. Ladestopp", "1. Ladestopp"]);
  });

  it("haelt bei gleicher Distanz die Einfuegereihenfolge (stabil)", () => {
    const t = buildRouteTimeline({
      ...input,
      chargingStops: [stop(200)],
      manualWaypoints: [{ query: "q", displayName: "M", latitude: 51, longitude: 12, distanceFromStartKm: 200 }],
    });
    expect(t.map((p) => p.kind)).toEqual(["start", "charging", "manual", "end"]);
  });
});
