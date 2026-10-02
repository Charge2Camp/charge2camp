import { describe, expect, it } from "vitest";
import {
  EV_SCORE_WEIGHTS,
  calculateEvCampingScore,
  deriveCampsiteRating,
  type EvScoreInput,
} from "@/lib/scoring/ev-camping-score";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

const base: EvScoreInput = {
  ev_charging_on_site: false,
  max_charging_power_kw: null,
  number_of_charging_points: null,
  rating_avg: null,
  last_verified_at: null,
};

describe("EV_SCORE_WEIGHTS", () => {
  it("summiert auf 100 Punkte", () => {
    const sum = Object.values(EV_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});

describe("deriveCampsiteRating", () => {
  it.each([
    [true, true, 5],
    [true, false, 4],
    [false, true, 3],
    [false, false, 1],
  ])("on-site=%s walkable=%s -> %s", (onSite, walkable, expected) => {
    expect(deriveCampsiteRating(onSite, walkable)).toBe(expected);
  });
});

describe("calculateEvCampingScore", () => {
  it("gibt ohne jede Information 0 Punkte", () => {
    expect(calculateEvCampingScore(base, null).score).toBe(0);
  });

  it("vergibt das Maximum bei bester Ausstattung", () => {
    const result = calculateEvCampingScore(
      {
        ev_charging_on_site: true,
        max_charging_power_kw: 22,
        number_of_charging_points: 2,
        rating_avg: 4.8,
        last_verified_at: daysAgo(0),
      },
      5,
    );
    expect(result.score).toBe(100);
  });

  it("zaehlt Leistung und Anzahl nur bei Ladepunkt auf dem Platz", () => {
    const r = calculateEvCampingScore(
      { ...base, max_charging_power_kw: 150, number_of_charging_points: 10 },
      null,
    );
    expect(r.power).toBe(0);
    expect(r.pointCount).toBe(0);
  });

  it("wertet unbekannte Ladeleistung pauschal mit 10 von 15 Punkten", () => {
    const r = calculateEvCampingScore({ ...base, ev_charging_on_site: true }, null);
    expect(r.power).toBe(10);
  });

  it("skaliert die Leistung linear bis 22 kW und deckelt darueber", () => {
    const half = calculateEvCampingScore(
      { ...base, ev_charging_on_site: true, max_charging_power_kw: 11 },
      null,
    );
    const capped = calculateEvCampingScore(
      { ...base, ev_charging_on_site: true, max_charging_power_kw: 350 },
      null,
    );
    expect(half.power).toBe(Math.round(EV_SCORE_WEIGHTS.power / 2));
    expect(capped.power).toBe(EV_SCORE_WEIGHTS.power);
  });

  it("gibt Schnelllader-Punkte nur bis 15 km Entfernung", () => {
    expect(calculateEvCampingScore(base, 15).fastChargerProximity).toBe(20);
    expect(calculateEvCampingScore(base, 15.1).fastChargerProximity).toBe(0);
    expect(calculateEvCampingScore(base, null).fastChargerProximity).toBe(0);
  });

  it.each([
    [4.5, 20],
    [4.0, 10],
    [3.6, 10],
    [3.5, 0],
    [null, 0],
  ])("Community-Rating %s -> %s Punkte", (rating, expected) => {
    expect(calculateEvCampingScore({ ...base, rating_avg: rating }, null).communityRating).toBe(expected);
  });

  it("stuft die Datenaktualitaet in drei Stufen", () => {
    const at = (days: number) =>
      calculateEvCampingScore({ ...base, last_verified_at: daysAgo(days) }, null).dataFreshness;
    expect(at(1)).toBe(10);
    expect(at(60)).toBe(5);
    expect(at(400)).toBe(0);
    expect(calculateEvCampingScore(base, null).dataFreshness).toBe(0);
  });

  it("reicht nearestFastChargerKm unveraendert durch", () => {
    expect(calculateEvCampingScore(base, 7.5).nearestFastChargerKm).toBe(7.5);
  });
});
