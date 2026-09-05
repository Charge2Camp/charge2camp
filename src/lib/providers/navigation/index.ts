import { googleMapsNavigationProvider } from "./google-maps";
import type { NavigationProvider } from "./types";

export type { NavigationPoint, NavigationProvider, NavigationRouteRequest } from "./types";
export { googleMapsNavigationProvider } from "./google-maps";

// Weitere Anbieter (Apple Karten, Waze) werden hier ergaenzt, sobald
// gebraucht -- Aufrufstellen (z. B. route-planner-form.tsx) wählen ueber
// diese Registry, nie direkt einen konkreten Adapter, damit ein neuer
// Anbieter keine Aenderung an der aufrufenden UI erfordert.
export const NAVIGATION_PROVIDERS: Record<string, NavigationProvider> = {
  [googleMapsNavigationProvider.id]: googleMapsNavigationProvider,
};

export const DEFAULT_NAVIGATION_PROVIDER_ID = googleMapsNavigationProvider.id;
