import { isDefaultTrailerVerdict } from "@/lib/trailer-verdict";
import type { ChargingStationFilters } from "@/lib/charging-stations";

/** Bewusst HIER (statt in charging-stations.ts) definiert: charging-stations.ts
 * importiert server-only Code (next/headers ueber lib/supabase/server), ein
 * Wert-Import von dort in "use client"-Code (charging-station-map-explorer.tsx,
 * filter-fields.tsx) zieht sonst den kompletten Modulgraphen ins Client-Bundle
 * -- gleiches Muster/gleicher Grund wie in trailer-verdict.ts dokumentiert.
 * `ChargingStationFilters` selbst ist ein reiner Typ-Import (wird beim Build
 * entfernt, unproblematisch). */

export function computeActiveFilterCount(filters: ChargingStationFilters): number {
  return (
    (filters.q ? 1 : 0) +
    (filters.favoritesOnly ? 1 : 0) +
    (isDefaultTrailerVerdict(filters.trailerVerdict) ? 0 : filters.trailerVerdict.length) +
    filters.connectorCategories.length +
    filters.operators.length
  );
}

/** Baut die Query-Parameter aus einem vollstaendigen Filterzustand -- immer
 * mit filters_submitted=1 (jeder Aufruf hier entspricht einer expliziten
 * Nutzeraktion, nie einem impliziten Default), Basis fuer sowohl die
 * Kartenausschnitt-Nachladung (/api/charge-points/viewport, ohne favorites --
 * der Favoriten-Pfad laedt separat, siehe handleBoundsChange) als auch die
 * URL-Synchronisierung der Seite selbst (mit favorites, fuer Teilen-Links/
 * Zurueck-Button). */
export function buildChargingStationFilterParams(
  filters: ChargingStationFilters,
  { includeFavorites = false }: { includeFavorites?: boolean } = {}
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("filters_submitted", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.fastChargersOnly) params.set("fast", "1");
  for (const v of filters.trailerVerdict) params.set(`trailer_${v}`, "1");
  for (const key of filters.connectorCategories) params.set(`connector_${key}`, "1");
  for (const op of filters.operators) params.append("operator", op);
  if (includeFavorites && filters.favoritesOnly) params.set("favorites", "1");
  return params;
}
