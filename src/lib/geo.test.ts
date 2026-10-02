import { describe, expect, it } from "vitest";
import { distanceKm } from "@/lib/geo";

describe("distanceKm", () => {
  it("ist 0 fuer denselben Punkt", () => {
    const p = { latitude: 48.1, longitude: 11.5 };
    expect(distanceKm(p, p)).toBe(0);
  });

  it("entspricht ca. 111,2 km je Breitengrad", () => {
    const d = distanceKm({ latitude: 50, longitude: 10 }, { latitude: 51, longitude: 10 });
    expect(d).toBeCloseTo(111.19, 1);
  });

  it("ist symmetrisch", () => {
    const muc = { latitude: 48.1351, longitude: 11.582 };
    const ber = { latitude: 52.52, longitude: 13.405 };
    expect(distanceKm(muc, ber)).toBeCloseTo(distanceKm(ber, muc), 9);
  });

  it("liefert fuer Muenchen-Berlin rund 504 km", () => {
    const d = distanceKm(
      { latitude: 48.1351, longitude: 11.582 },
      { latitude: 52.52, longitude: 13.405 },
    );
    expect(d).toBeGreaterThan(498);
    expect(d).toBeLessThan(510);
  });
});
