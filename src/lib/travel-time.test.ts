import { describe, expect, it } from "vitest";
import {
  DEFAULT_TRAILER_SPEED_LIMIT_KMH,
  TRAILER_SPEED_LIMIT_KMH,
  TRAILER_SPEED_SAFETY_FACTOR,
  countryCodeForPoint,
  effectiveTrailerSpeedKmh,
  estimateTravelTimeMin,
} from "@/lib/travel-time";

// Hinweis: Die Boxen sind eine grobe Naeherung -- z. B. liegt Muenchen (48,14 / 11,58) noch in der
// AT-Box, die vor DE geprueft wird. Fuer DE/AT sind die Limits gleich, daher ohne Auswirkung.
describe("countryCodeForPoint", () => {
  it("erkennt Punkte in bekannten Laendern", () => {
    expect(countryCodeForPoint({ latitude: 52.52, longitude: 13.4 })).toBe("DE");
    expect(countryCodeForPoint({ latitude: 48.85, longitude: 2.35 })).toBe("FR");
  });

  it("liefert null ausserhalb aller Boxen", () => {
    expect(countryCodeForPoint({ latitude: 0, longitude: 0 })).toBeNull();
  });
});

describe("effectiveTrailerSpeedKmh", () => {
  it("wendet den Sicherheitsabschlag auf das Landeslimit an", () => {
    expect(effectiveTrailerSpeedKmh("DE")).toBeCloseTo(
      TRAILER_SPEED_LIMIT_KMH.DE * TRAILER_SPEED_SAFETY_FACTOR,
      9,
    );
  });

  it("nutzt den Standardwert fuer unbekannte Laender und null", () => {
    const expected = DEFAULT_TRAILER_SPEED_LIMIT_KMH * TRAILER_SPEED_SAFETY_FACTOR;
    expect(effectiveTrailerSpeedKmh(null)).toBeCloseTo(expected, 9);
    expect(effectiveTrailerSpeedKmh("ZZ")).toBeCloseTo(expected, 9);
  });
});

describe("estimateTravelTimeMin", () => {
  it("ist 0 ohne oder mit nur einem Punkt", () => {
    expect(estimateTravelTimeMin([])).toBe(0);
    expect(estimateTravelTimeMin([{ latitude: 48, longitude: 11 }])).toBe(0);
  });

  it("ignoriert doppelte Punkte (Teilstueck der Laenge 0)", () => {
    const p = { latitude: 48, longitude: 11 };
    expect(estimateTravelTimeMin([p, p, p])).toBe(0);
  });

  it("rechnet ein Teilstueck in Deutschland mit 100 km/h * 0,9", () => {
    const a = { latitude: 51.0, longitude: 10.0 };
    const b = { latitude: 52.0, longitude: 10.0 }; // ca. 111,2 km, Mittelpunkt klar in DE
    const expected = (111.19 / (100 * TRAILER_SPEED_SAFETY_FACTOR)) * 60;
    expect(estimateTravelTimeMin([a, b])).toBeCloseTo(expected, 0);
  });

  it("dauert laenger als ohne Sicherheitsabschlag", () => {
    const a = { latitude: 51.0, longitude: 10.0 };
    const b = { latitude: 52.0, longitude: 10.0 };
    const withoutFactor = (111.19 / 100) * 60;
    expect(estimateTravelTimeMin([a, b])).toBeGreaterThan(withoutFactor);
  });
});
