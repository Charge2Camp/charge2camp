/** Client-sicherer Teil der serverseitigen Campingplatz-Vorschlagssuche
 * (GET /api/campsites/suggest) -- bewusst OHNE Server-Imports, damit
 * "use client"-Komponenten (NameSuggestField, AddressAutocomplete,
 * route-planner-form) ihn ohne Client/Server-Grenzverletzung importieren
 * koennen (siehe campsites.ts fuer den serverseitigen Teil). */

export interface CampsiteDestinationOption {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Mindestlaenge fuer Vorschlaege -- identisch zu NameSuggestField/
 * AddressAutocomplete (MIN_QUERY_LENGTH). */
export const CAMPSITE_SUGGEST_MIN_QUERY_LENGTH = 3;

async function requestCampsites(params: URLSearchParams, signal?: AbortSignal): Promise<CampsiteDestinationOption[]> {
  const res = await fetch(`/api/campsites/suggest?${params.toString()}`, { signal });
  if (!res.ok) throw new Error("Campingplatz-Vorschlaege nicht verfuegbar.");
  const data = (await res.json()) as { campsites?: CampsiteDestinationOption[] };
  return data.campsites ?? [];
}

/** Campingplaetze, deren Name `query` enthaelt (hoechstens wenige, serverseitig begrenzt). */
export function fetchCampsiteSuggestions(query: string, signal?: AbortSignal): Promise<CampsiteDestinationOption[]> {
  return requestCampsites(new URLSearchParams({ q: query }), signal);
}

/** Genau den Campingplatz mit diesem Namen (oder null) -- zum Wiederherstellen
 * der Koordinaten einer gespeicherten Route (siehe route-planner-form.tsx). */
export async function fetchCampsiteByName(name: string, signal?: AbortSignal): Promise<CampsiteDestinationOption | null> {
  const results = await requestCampsites(new URLSearchParams({ name }), signal);
  return results[0] ?? null;
}
