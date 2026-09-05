import type { RoadRestrictionKind } from "./types";

export const ROAD_RESTRICTION_LABELS: Record<RoadRestrictionKind, (limitValue: number) => string> = {
  maxheight: (limit) => `Höhenbeschränkung ${limit.toFixed(1)} m`,
  maxwidth: (limit) => `Breitenbeschränkung ${limit.toFixed(1)} m`,
  maxweight: (limit) => `Gewichtsbeschränkung ${limit.toFixed(1)} t`,
};
