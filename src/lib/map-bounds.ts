/** Kartenausschnitt-Hilfen (rein, ohne Server-Imports -- von Client UND API-Route
 * nutzbar, siehe charging-station-map-explorer.tsx und api/charge-points/viewport). */

export interface BoundsBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Begrenzt einen Ausschnitt auf gueltige Koordinaten (Laenge +-180, Breite +-90).
 * Das Vorladen mit Rand (padBounds) und die von MapLibre gelieferten Grenzen beim
 * Herauszoomen koennen darueber hinausgehen. Serverseitig vergleicht
 * core.charge_points_in_bbox seit 20261026200000 planar und kommt mit solchen Werten
 * zurecht -- die Begrenzung haelt Anfragen aber gueltig, vergleichbar (Cache) und
 * kurz. */
export function clampBounds(bounds: BoundsBox): BoundsBox {
  return {
    west: clamp(bounds.west, -180, 180),
    east: clamp(bounds.east, -180, 180),
    south: clamp(bounds.south, -90, 90),
    north: clamp(bounds.north, -90, 90),
  };
}

/** Liest den bbox-Query-Parameter "west,south,east,north". Liefert `null` bei
 * ungueltiger Eingabe (falsche Anzahl, nicht endliche Zahlen, west > east oder
 * south > north), sonst die auf gueltige Koordinaten begrenzte Box. */
export function parseBboxParam(raw: string): BoundsBox | null {
  const parts = raw.split(",").map((p) => (p.trim() === "" ? NaN : Number(p)));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (west > east || south > north) return null;
  return clampBounds({ west, south, east, north });
}
