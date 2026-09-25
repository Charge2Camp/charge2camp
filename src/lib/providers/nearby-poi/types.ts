export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Vier Kategorien, die beim Laden mit Gespann typischerweise relevant sind
 * (Nutzerwunsch) -- bewusst keine allgemeine POI-Suche, sondern eine feste,
 * kuratierte Auswahl an OSM-Tags je Kategorie (siehe overpass.ts). */
export type NearbyPoiCategory = "toilets" | "restaurant" | "camping_shop" | "campsite";

export interface NearbyPoi {
  id: string;
  category: NearbyPoiCategory;
  name: string | null;
  distanceM: number;
  latitude: number;
  longitude: number;
}

export interface NearbyPoiProvider {
  id: string;
  /** Liefert POIs aller vier Kategorien im Umkreis von `center`, nach
   * Distanz sortiert. Wirft bei einem Fehler (Timeout/Rate-Limit auf dem
   * geteilten oeffentlichen Dienst) -- Aufrufer zeigen das ehrlich als
   * "nicht verfuegbar" statt eine leere Liste vorzutaeuschen (§2 CLAUDE.md,
   * analog zur Strassenrestriktions-Pruefung). */
  findNearby(center: LatLng, radiusM: number): Promise<NearbyPoi[]>;
}
