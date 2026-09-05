export interface AddressSuggestion {
  displayName: string;
  latitude: number;
  longitude: number;
}

/**
 * Adress-Vorschlaege waehrend der Eingabe (Search-as-you-type) ueber die
 * oeffentliche Photon-API (photon.komoot.io, baut auf OSM-Daten auf) --
 * kostenlos, kein API-Key, fuer den Browser-Direktaufruf gedacht (im
 * Gegensatz zu Nominatim: dessen Nutzungsrichtlinie verbietet
 * Autocomplete/Search-as-you-type ausdruecklich, siehe
 * docs/data-sources.md). Waehlt der Nutzer einen Vorschlag aus (siehe
 * address-autocomplete.tsx `onSelectCoordinates`), werden dessen Koordinaten
 * direkt uebernommen -- kein erneutes Geocoding ueber Nominatim ([./nominatim.ts](./nominatim.ts))
 * beim Absenden, das das Ergebnis (z. B. die Hausnummer) verfaelschen
 * koennte. Nominatim bleibt nur fuer frei eingetippten Text (ohne
 * Vorschlagsauswahl) zustaendig.
 */
const PHOTON_BASE_URL = process.env.NEXT_PUBLIC_PHOTON_BASE_URL ?? "https://photon.komoot.io/api/";

// Charge2Camp ist auf Europa ausgerichtet (§ Zielmarkt) -- Vorschlaege
// werden deshalb auf eine grobe Europa-Bounding-Box beschraenkt (west, sued,
// ost, nord), damit keine Orte aus USA/Asien/Afrika mit gleichem/aehnlichem
// Namen vorgeschlagen werden. Bewusst grosszuegig geschnitten (inkl. Island,
// Kanaren, europaeisches Russland bis zum Ural, europ. Tuerkei) statt exakt
// an Landesgrenzen ausgerichtet -- eine Naeherung, keine amtliche Definition
// von "Europa".
const EUROPE_BBOX = "-25,34,45,72";

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

/** Baut die Anzeige-Adresse im deutschen Format "Straße Hausnummer, PLZ Ort"
 * -- Hausnummer war zuvor gar nicht in den Vorschlaegen enthalten (Photon
 * liefert sie separat in `housenumber`, nicht als Teil von `street`), und
 * PLZ/Ort wurden faelschlich durch ein Komma statt eines Leerzeichens
 * getrennt. */
function formatDisplayName(props: PhotonFeature["properties"]): string {
  const streetPart = [props.street, props.housenumber].filter(Boolean).join(" ");
  const postcodeCityPart = [props.postcode, props.city].filter(Boolean).join(" ");
  const parts = [props.name, streetPart, postcodeCityPart, props.state, props.country];
  return Array.from(new Set(parts.filter((p): p is string => Boolean(p)))).join(", ");
}

export async function searchAddressSuggestions(query: string, limit = 5): Promise<AddressSuggestion[]> {
  const url = `${PHOTON_BASE_URL}?q=${encodeURIComponent(query)}&limit=${limit}&lang=de&bbox=${EUROPE_BBOX}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Adressvorschläge fehlgeschlagen (${response.status}).`);
  }

  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data.features) ? data.features : [];

  return features
    .map((f) => ({
      displayName: formatDisplayName(f.properties),
      latitude: f.geometry.coordinates[1],
      longitude: f.geometry.coordinates[0],
    }))
    .filter((s) => s.displayName.length > 0);
}
