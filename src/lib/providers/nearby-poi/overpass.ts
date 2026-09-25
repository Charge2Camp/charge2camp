import { distanceKm } from "@/lib/geo";
import type { LatLng, NearbyPoi, NearbyPoiCategory, NearbyPoiProvider } from "./types";

/**
 * Overpass-Adapter fuer "In der Naehe" an einer Ladesaeule (Nutzerwunsch):
 * Toilette, Restaurant, Campingfachmarkt/-geschaeft, Campingplatz. Nutzt
 * dieselbe oeffentliche Overpass-API (overpass-api.de, kostenlos, kein
 * API-Key) wie die in docs/architecture.md dokumentierte
 * Strassenrestriktions-Pruefung (§28ff) -- siehe docs/data-sources.md,
 * Abschnitt "Straßenrestriktionen", dort bereits als Datenquelle
 * freigegeben.
 *
 * EIN kombinierter Request statt vier Einzelanfragen (aus Ruecksicht auf
 * den geteilten Dienst, gleiches Prinzip wie bei der
 * Strassenrestriktions-Pruefung). Kategorien sind bewusst kuratiert statt
 * einer generischen POI-Suche -- jede weitere Kategorie braucht einen
 * expliziten Eintrag in CATEGORY_QUERIES.
 */
const OVERPASS_BASE_URL = process.env.OVERPASS_BASE_URL ?? "https://overpass-api.de/api/interpreter";

const CATEGORY_QUERIES: Record<NearbyPoiCategory, string> = {
  toilets: 'nwr["amenity"="toilets"]',
  restaurant: 'nwr["amenity"="restaurant"]',
  // "Campingfachmarkt"/"Campinggeschäft" -- OSM kennt kein eigenes Tag dafuer,
  // shop=outdoor (Outdoor-/Campingausruestung) trifft es am ehesten;
  // shop=caravan (Wohnwagen-/Wohnmobil-Haendler) ergaenzt gezielt Gespann-
  // relevante Faelle (Ersatzteile, Zubehoer).
  camping_shop: 'nwr["shop"~"^(outdoor|caravan)$"]',
  campsite: 'nwr["tourism"="camp_site"]',
};

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function categoryOf(tags: Record<string, string> | undefined): NearbyPoiCategory | null {
  if (!tags) return null;
  if (tags.amenity === "toilets") return "toilets";
  if (tags.amenity === "restaurant") return "restaurant";
  if (tags.shop === "outdoor" || tags.shop === "caravan") return "camping_shop";
  if (tags.tourism === "camp_site") return "campsite";
  return null;
}

export const overpassNearbyPoiProvider: NearbyPoiProvider = {
  id: "overpass",
  async findNearby(center: LatLng, radiusM: number): Promise<NearbyPoi[]> {
    const around = `(around:${radiusM},${center.latitude},${center.longitude})`;
    // Jede Kategorie bekommt ihr EIGENES "out center"-Limit statt eines
    // gemeinsamen -- sonst koennte eine dichte Kategorie (z.B. Restaurants
    // in einer Innenstadt) das gemeinsame Limit ausschoepfen und andere
    // Kategorien (z.B. Campingplatz) komplett verdraengen, obwohl welche
    // im Radius vorhanden waeren (mit einem gemeinsamen Limit getestet und
    // reproduziert: 80 Restaurant-Treffer in Muenchen-Zentrum liessen
    // keinen Platz mehr fuer andere Kategorien).
    const query =
      `[out:json][timeout:10];` +
      Object.values(CATEGORY_QUERIES).map((q) => `${q}${around};out center 15;`).join("");

    const response = await fetch(OVERPASS_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Charge2Camp-dev/0.1 (MVP, lokale Entwicklung)",
      },
      body: `data=${encodeURIComponent(query)}`,
      // Naechster geografischer Nachbar aendert sich praktisch nie taeglich --
      // 7 Tage Cache schont den geteilten Dienst (siehe Kommentar oben).
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!response.ok) {
      throw new Error(`Overpass-Anfrage fehlgeschlagen (${response.status}).`);
    }

    const data = (await response.json()) as { elements: OverpassElement[] };

    const pois: NearbyPoi[] = [];
    for (const el of data.elements ?? []) {
      const category = categoryOf(el.tags);
      if (!category) continue;
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null) continue;

      pois.push({
        id: `${el.type}/${el.id}`,
        category,
        name: el.tags?.name ?? null,
        distanceM: distanceKm(center, { latitude: lat, longitude: lon }) * 1000,
        latitude: lat,
        longitude: lon,
      });
    }

    return pois.sort((a, b) => a.distanceM - b.distanceM);
  },
};
