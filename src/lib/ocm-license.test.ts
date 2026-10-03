import { describe, expect, it } from "vitest";
import { classifyOcmLicense, classifyOcmPoi } from "@/lib/ocm-license";
// Dieselben Faelle prueft ingest/test_ocm_license.py gegen die Python-
// Implementierung -- beide Importwege muessen identisch entscheiden.
import fixture from "./ocm-license-cases.json";

describe("classifyOcmLicense", () => {
  for (const c of fixture.cases) {
    it(`${c.provider} -> ${c.expected}`, () => {
      expect(classifyOcmLicense(c.license, c.isOpenDataLicensed)).toBe(c.expected);
    });
  }
});

describe("classifyOcmPoi", () => {
  it("liest die Lizenz aus DataProvider", () => {
    expect(
      classifyOcmPoi({ DataProvider: { License: "CC0", IsOpenDataLicensed: true } }),
    ).toBe("allowed");
  });

  it("ist unknown, wenn kein DataProvider-Objekt mitgeliefert wird", () => {
    expect(classifyOcmPoi({})).toBe("unknown");
    expect(classifyOcmPoi({ DataProvider: null })).toBe("unknown");
  });
});
