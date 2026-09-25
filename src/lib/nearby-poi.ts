import { overpassNearbyPoiProvider } from "@/lib/providers/nearby-poi/overpass";
import type { NearbyPoi, NearbyPoiCategory } from "@/lib/providers/nearby-poi/types";

const RADIUS_M = 1000;
const MAX_PER_CATEGORY = 5;

export type NearbyPoiByCategory = Record<NearbyPoiCategory, NearbyPoi[]>;

export type NearbyPoiResult =
  | { status: "ok"; byCategory: NearbyPoiByCategory }
  | { status: "unavailable" };

/** "In der Naehe" an einer Ladesaeule (Nutzerwunsch), 1 km Fussweg-Radius.
 * Overpass ist ein geteilter, oeffentlicher Dienst ohne SLA -- schlaegt die
 * Anfrage fehl (Timeout/Rate-Limit), wird das ehrlich als "nicht verfuegbar"
 * zurueckgegeben statt stillschweigend eine leere Liste vorzutaeuschen (§2
 * CLAUDE.md, analog zur Strassenrestriktions-Pruefung in docs/architecture.md). */
export async function fetchNearbyPoi(center: { latitude: number; longitude: number }): Promise<NearbyPoiResult> {
  try {
    const pois = await overpassNearbyPoiProvider.findNearby(center, RADIUS_M);
    const byCategory: NearbyPoiByCategory = { toilets: [], restaurant: [], camping_shop: [], campsite: [] };
    for (const poi of pois) {
      if (byCategory[poi.category].length < MAX_PER_CATEGORY) byCategory[poi.category].push(poi);
    }
    return { status: "ok", byCategory };
  } catch {
    return { status: "unavailable" };
  }
}
