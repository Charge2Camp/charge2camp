import { describe, expect, it } from "vitest";
import { clampBounds, parseBboxParam } from "./map-bounds";

describe("clampBounds", () => {
  it("laesst gueltige Grenzen unveraendert", () => {
    const b = { west: -10, south: 41, east: 30, north: 61 };
    expect(clampBounds(b)).toEqual(b);
  });

  it("begrenzt Laenge auf +-180 und Breite auf +-90", () => {
    expect(clampBounds({ west: -540, south: -270, east: 540, north: 270 })).toEqual({
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    });
  });

  it("begrenzt jede Seite einzeln", () => {
    expect(clampBounds({ west: -200, south: 41, east: 30, north: 95 })).toEqual({
      west: -180,
      south: 41,
      east: 30,
      north: 90,
    });
  });
});

describe("parseBboxParam", () => {
  it("parst eine gueltige Box", () => {
    expect(parseBboxParam("-10,41,30,61")).toEqual({ west: -10, south: 41, east: 30, north: 61 });
  });

  it("begrenzt Werte ausserhalb des gueltigen Bereichs statt sie abzulehnen", () => {
    expect(parseBboxParam("-200,-95,200,95")).toEqual({ west: -180, south: -90, east: 180, north: 90 });
  });

  it("akzeptiert die ganze Welt", () => {
    expect(parseBboxParam("-180,-90,180,90")).toEqual({ west: -180, south: -90, east: 180, north: 90 });
  });

  it("lehnt falsche Anzahl ab", () => {
    expect(parseBboxParam("1,2,3")).toBeNull();
    expect(parseBboxParam("1,2,3,4,5")).toBeNull();
    expect(parseBboxParam("")).toBeNull();
  });

  it("lehnt nicht endliche oder nicht numerische Werte ab", () => {
    expect(parseBboxParam("a,2,3,4")).toBeNull();
    expect(parseBboxParam("1,2,3,")).toBeNull();
    expect(parseBboxParam("1,2,Infinity,4")).toBeNull();
    expect(parseBboxParam("NaN,2,3,4")).toBeNull();
  });

  it("lehnt vertauschte Seiten ab (west > east, south > north)", () => {
    expect(parseBboxParam("30,41,-10,61")).toBeNull();
    expect(parseBboxParam("-10,61,30,41")).toBeNull();
  });
});
