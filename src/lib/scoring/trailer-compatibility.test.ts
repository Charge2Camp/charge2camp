import { describe, expect, it } from "vitest";
import type { ChargingReview } from "@/types/database";
import {
  assessPersonalCompatibility,
  bucketReviewsByRigLength,
  summarizeCommunitySuitability,
} from "@/lib/scoring/trailer-compatibility";

let seq = 0;
function review(
  suitable: ChargingReview["suitable"],
  trailer_length_m: number | null,
  extra: Partial<ChargingReview> = {},
): ChargingReview {
  seq += 1;
  return {
    id: `r${seq}`,
    user_id: `u${seq}`,
    charging_station_id: "s1",
    suitable,
    trailer_length_m,
    trailer_width_m: null,
    caravan_model: null,
    vehicle_id: null,
    caravan_id: null,
    decoupled_parking_possible: null,
    photo_url: null,
    comment: null,
    created_at: "2026-10-01T00:00:00Z",
    enough_space_for_rig: null,
    unobstructed_access: null,
    no_barrier_or_garage: null,
    side_mounted_charger: null,
    is_admin_review: false,
    ...extra,
  };
}

describe("summarizeCommunitySuitability", () => {
  it("verlangt mindestens 3 Bewertungen fuer eine Aussage", () => {
    const s = summarizeCommunitySuitability([review("yes", 8), review("yes", 8)]);
    expect(s.summary).toMatch(/Noch nicht genug/);
  });

  it("meldet 'ueberwiegend bestaetigt' ab 80 % positiv", () => {
    const s = summarizeCommunitySuitability([review("yes", 8), review("yes", 8), review("yes", 8)]);
    expect(s.overallPositiveRatio).toBe(1);
    expect(s.summary).toMatch(/überwiegend als anhängertauglich bestätigt/);
  });

  it("gewichtet 'limited' mit 0,5", () => {
    const s = summarizeCommunitySuitability([review("yes", 8), review("limited", 8)]);
    expect(s.overallPositiveRatio).toBe(0.75);
  });

  it("vererbt 'yes' grosser Gespanne an normale, aber nicht umgekehrt", () => {
    const s = summarizeCommunitySuitability([review("yes", 13), review("yes", 13), review("no", 7)]);
    expect(s.normalEvidenceCount).toBe(3); // 2 geerbte + 1 direkte
    expect(s.largeEvidenceCount).toBe(2);
    const onlyNormal = summarizeCommunitySuitability([review("yes", 7), review("yes", 7)]);
    expect(onlyNormal.largeEvidenceCount).toBe(0);
  });

  it("vererbt 'no'/'limited' grosser Gespanne nicht an normale", () => {
    const s = summarizeCommunitySuitability([review("no", 13), review("limited", 13), review("yes", 7)]);
    expect(s.normalEvidenceCount).toBe(1);
  });

  it("zaehlt Admin-Bewertungen mit Laenge doppelt, ohne Laenge einfach", () => {
    const withLength = summarizeCommunitySuitability([review("yes", 10, { is_admin_review: true })]);
    expect(withLength.largeEvidenceCount).toBe(2);
    const withoutLength = summarizeCommunitySuitability([review("yes", null, { is_admin_review: true })]);
    expect(withoutLength.normalEvidenceCount).toBe(1);
  });

  it("erzeugt die Differenz-Aussage normal vs. sehr gross", () => {
    const s = summarizeCommunitySuitability([
      review("yes", 7),
      review("yes", 7),
      review("no", 10),
      review("no", 10),
    ]);
    expect(s.summary).toMatch(/Geeignet für normale Gespanne, eingeschränkt für sehr große Gespanne \(> 8,5 m\)/);
  });
});

describe("assessPersonalCompatibility", () => {
  const summaryOf = (reviews: ChargingReview[]) => summarizeCommunitySuitability(reviews);

  it("liefert keine_daten ohne hinterlegte Gespannlaenge", () => {
    expect(assessPersonalCompatibility(summaryOf([review("yes", 8)]), null)).toBe("keine_daten");
  });

  it("uebersteuert alles mit nicht_geeignet bei >= 90 % 'no' (auch bei einer einzigen Bewertung)", () => {
    expect(assessPersonalCompatibility(summaryOf([review("no", 8)]), 6)).toBe("nicht_geeignet");
    expect(assessPersonalCompatibility(summaryOf([review("no", 14)]), 14)).toBe("nicht_geeignet");
  });

  it("'limited' loest den nicht_geeignet-Override nicht aus", () => {
    const s = summaryOf([review("limited", 8), review("limited", 8), review("limited", 8)]);
    expect(assessPersonalCompatibility(s, 8)).not.toBe("nicht_geeignet");
  });

  it("bewertet ein 9-m-Gespann anhand zweier geerbter 13-m-'yes'", () => {
    const s = summaryOf([review("yes", 13), review("yes", 13)]);
    expect(assessPersonalCompatibility(s, 9)).toBe("sehr_gut");
  });

  it("faellt bei fehlender grosser Evidenz auf den Gesamtwert zurueck", () => {
    const s = summaryOf([review("yes", 7), review("yes", 7), review("yes", 7)]);
    expect(assessPersonalCompatibility(s, 12)).toBe("sehr_gut");
    const fewTotal = summaryOf([review("yes", 7), review("yes", 7)]);
    expect(assessPersonalCompatibility(fewTotal, 12)).toBe("unklar");
  });

  it("meldet eingeschraenkt bei gemischter relevanter Evidenz", () => {
    const s = summaryOf([review("yes", 7), review("limited", 7), review("limited", 7)]);
    expect(assessPersonalCompatibility(s, 7)).toBe("eingeschraenkt");
  });
});

describe("bucketReviewsByRigLength", () => {
  it("trennt Bewertungen mit und ohne Laenge", () => {
    const d = bucketReviewsByRigLength([review("yes", 10), review("yes", null)]);
    expect(d.reviewsWithLength).toBe(1);
    expect(d.reviewsWithoutLength).toBe(1);
  });

  it("ordnet Grenzwerte der unteren Klasse zu (9 m -> 'bis 9 m', 11 m -> '9–11 m')", () => {
    const d = bucketReviewsByRigLength([review("yes", 9), review("yes", 11), review("yes", 15.1)]);
    const counts = Object.fromEntries(d.buckets.map((b) => [b.label, b.count]));
    expect(counts["bis 9 m"]).toBe(1);
    expect(counts["9–11 m"]).toBe(1);
    expect(counts["über 15 m"]).toBe(1);
  });

  it("vererbt 'yes' laengerer Gespanne nach unten und markiert inferredOnly", () => {
    const d = bucketReviewsByRigLength([review("yes", 14), review("yes", 14)]);
    const small = d.buckets.find((b) => b.label === "bis 9 m")!;
    expect(small.count).toBe(0);
    expect(small.reliable).toBe(true);
    expect(small.inferredOnly).toBe(true);
    expect(small.positiveRatio).toBe(1);
  });

  it("vererbt 'no' nicht nach unten", () => {
    const d = bucketReviewsByRigLength([review("no", 14), review("no", 14)]);
    const small = d.buckets.find((b) => b.label === "bis 9 m")!;
    expect(small.reliable).toBe(false);
    expect(small.positiveRatio).toBeNull();
  });

  it("berechnet Anteile an Bewertungen mit Laenge", () => {
    const d = bucketReviewsByRigLength([review("yes", 8), review("yes", 8), review("yes", 12), review("yes", 12)]);
    expect(d.buckets.find((b) => b.label === "bis 9 m")!.sharePercent).toBe(50);
  });
});
