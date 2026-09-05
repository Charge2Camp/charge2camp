import type { LatLng } from "@/lib/providers/routing/types";
import type { GespannDimensions } from "@/lib/gespann-dimensions";

export type RoadRestrictionKind = "maxheight" | "maxwidth" | "maxweight";

export interface RoadRestrictionHit {
  kind: RoadRestrictionKind;
  /** Beschraenkung laut OSM-Tag: Meter fuer maxheight/maxwidth, Tonnen fuer maxweight. */
  limitValue: number;
  location: LatLng;
}

export interface RoadRestrictionProvider {
  id: string;
  /**
   * Prueft eine Streckengeometrie auf bekannte OSM-Strassenrestriktionen
   * (Hoehen-/Breiten-/Gewichtsbeschraenkungen), die die gegebenen
   * Gespann-Masse ueberschreiten. Liefert nur Treffer, keine vollstaendige
   * Streckenanalyse -- OSM-Tag-Abdeckung ist lueckenhaft (§2 keine
   * Scheindaten: dies ist eine Warnung auf Best-Effort-Basis, keine
   * Garantie).
   */
  checkRoute(geometry: LatLng[], dimensions: GespannDimensions): Promise<RoadRestrictionHit[]>;
}
