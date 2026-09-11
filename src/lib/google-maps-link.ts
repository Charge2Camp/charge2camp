/**
 * Baut einen rein ausgehenden Google-Maps-Link, über den Nutzer die dort
 * hinterlegten Fotos einer Ladesäule ansehen können (Auftrag "Bilder
 * Rückbau und Button", Ersatz für die zurückgebaute Mapillary/Commons-
 * Galerie -- Street-Level-Fotos beantworteten die eigentliche Frage
 * "passt mein Gespann hier durch?" nicht zuverlässig).
 *
 * Bewusst OHNE Google Place ID (kein API-Key, keine Kosten, siehe
 * Auftragsdokument Teil 0) -- der Link wird ausschließlich aus bereits
 * vorhandenen Feldern der Ladesäule gebaut, in drei Stufen je nach
 * Datenlage.
 */

export interface GoogleMapsPhotoLink {
  url: string;
  tier: 1 | 2 | 3;
  label: "Fotos ansehen" | "Auf Google Maps öffnen";
  /** Nur bei Stufe 3 gesetzt -- ehrlicher Hinweis statt falscher Erwartung. */
  hint: string | null;
}

const MAPS_SEARCH_BASE = "https://www.google.com/maps/search/?api=1&query=";

/** Entfernt doppelte Leerzeichen/Zeilenumbrüche und interne Zusätze wie
 * "(OCM)", die aus dem rohen Namen der Datenquelle stammen. */
function cleanName(name: string): string {
  return name
    .replace(/\(OCM\)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildGoogleMapsPhotoLink(station: {
  name: string | null;
  address: string | null;
  postcode: string | null;
  city: string | null;
  lat: number;
  lon: number;
}): GoogleMapsPhotoLink {
  const name = station.name ? cleanName(station.name) : "";

  // Stufe 1: Name + Adresse -- hoechste Chance, direkt auf dem POI-Eintrag
  // mit Fotos zu landen.
  if (name && (station.address || station.city)) {
    const query = [name, station.address, station.postcode, station.city]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      url: `${MAPS_SEARCH_BASE}${encodeURIComponent(query)}`,
      tier: 1,
      label: "Fotos ansehen",
      hint: null,
    };
  }

  // Stufe 2: nur Name + Koordinaten, raeumlich verankert per &center=.
  if (name) {
    return {
      url: `${MAPS_SEARCH_BASE}${encodeURIComponent(name)}&center=${station.lat},${station.lon}`,
      tier: 2,
      label: "Fotos ansehen",
      hint: null,
    };
  }

  // Stufe 3: Fallback, nur Koordinaten -- ehrlich beschriftet, da hier
  // Fotos nicht garantiert sind (reine Koordinatensuche landet oft ohne
  // POI-Kontext).
  const query = `${station.lat},${station.lon}`;
  return {
    url: `${MAPS_SEARCH_BASE}${encodeURIComponent(query)}`,
    tier: 3,
    label: "Auf Google Maps öffnen",
    hint: "Fotos nicht garantiert",
  };
}
