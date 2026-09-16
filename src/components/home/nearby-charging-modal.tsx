"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MapView, type MapBoundsBox } from "@/components/map/map-view";
import {
  TRAILER_PIN_COLORS,
  TRAILER_PIN_ICON_SRC,
  TRAILER_PIN_LABELS,
  TRAILER_VERDICT_LABELS,
  TRAILER_VERDICT_VALUES,
  getTrailerPinState,
} from "@/lib/trailer-verdict";
import { distanceKm } from "@/lib/geo";
import type { ChargingStationView } from "@/lib/charging-stations";
import type { TrailerVerdict } from "@/types/database";

const VIEWPORT_FETCH_DEBOUNCE_MS = 500;
const GERMANY_OVERVIEW_CENTER = { latitude: 51.1657, longitude: 10.4515 };
const GERMANY_OVERVIEW_ZOOM = 4.5;

interface QuickFilters {
  trailerVerdict: TrailerVerdict[];
  fastChargersOnly: boolean;
}

function buildViewportQuery(filters: QuickFilters, bounds: MapBoundsBox): string {
  const params = new URLSearchParams();
  params.set("bbox", `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`);
  if (filters.fastChargersOnly) params.set("fast", "1");
  for (const v of filters.trailerVerdict) params.set(`trailer_${v}`, "1");
  return params.toString();
}

/** Popup vom Startseiten-Button "Ladesäule in der Nähe suchen" (Nutzerwunsch):
 * eine kompakte, eigenständige Variante der Kartensuche direkt auf der
 * Startseite -- mit Karte (inkl. "Standort suchen"-Button, siehe
 * map-view.tsx GeolocateControl), den üblichen Quick-Filtern
 * (Anhängertauglichkeit, Schnelllader) und einer nach Entfernung
 * sortierten Trefferliste. Nutzt dasselbe Kartenausschnitt-basierte
 * Nachladen (/api/charge-points/viewport) wie die volle Ladepunkte-Seite
 * (charging-station-map-explorer.tsx) -- die Startseite selbst bleibt zwar
 * ohne Login erreichbar (reine Marketing-Landingpage), der Endpunkt
 * dahinter erfordert seit dem Sicherheits-Audit aber ein Login (siehe
 * require-user.ts/api-guard.ts) -- ohne Login zeigt dieses Popup deshalb
 * einen Login-Hinweis statt einer irrefuehrenden "keine Ladepunkte"-Meldung. */
export function NearbyChargingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [filters, setFilters] = useState<QuickFilters>({ trailerVerdict: [], fastChargersOnly: false });
  const [stations, setStations] = useState<ChargingStationView[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const boundsRef = useRef<MapBoundsBox | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchSeqRef = useRef(0);

  // Beim Oeffnen automatisch den Standort ermitteln (Nutzerwunsch: direkt
  // "in der Naehe suchen", ohne vorher extra einen Button antippen zu
  // muessen) -- ohne Berechtigung/Unterstuetzung faellt die Karte auf den
  // Deutschland-weiten Ausschnitt zurueck (siehe initialCenter unten), der
  // Standort-Button in der Karte selbst bleibt danach weiterhin nutzbar.
  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setUserLocation(null);
      setLocationDenied(false);
    });
    if (!navigator.geolocation) {
      void Promise.resolve().then(() => setLocationDenied(true));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocationDenied(true),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [open]);

  function runFetch(bounds: MapBoundsBox, activeFilters: QuickFilters) {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      const seq = ++fetchSeqRef.current;
      setIsLoading(true);
      try {
        const qs = buildViewportQuery(activeFilters, bounds);
        const res = await fetch(`/api/charge-points/viewport?${qs}`);
        if (seq !== fetchSeqRef.current) return;
        if (res.status === 401) {
          setRequiresLogin(true);
          return;
        }
        if (!res.ok) return;
        setRequiresLogin(false);
        const data = (await res.json()) as { stations?: ChargingStationView[] };
        if (seq !== fetchSeqRef.current) return;
        setStations(data.stations ?? []);
      } catch {
        // Netzwerkfehler: bisherige Ergebnisse bleiben stehen statt abzustuerzen.
      } finally {
        if (seq === fetchSeqRef.current) setIsLoading(false);
      }
    }, VIEWPORT_FETCH_DEBOUNCE_MS);
  }

  function handleBoundsChange(bounds: MapBoundsBox) {
    boundsRef.current = bounds;
    runFetch(bounds, filters);
  }

  function toggleTrailerVerdict(value: TrailerVerdict) {
    setFilters((prev) => {
      const next = prev.trailerVerdict.includes(value)
        ? prev.trailerVerdict.filter((v) => v !== value)
        : [...prev.trailerVerdict, value];
      const updated = { ...prev, trailerVerdict: next };
      if (boundsRef.current) runFetch(boundsRef.current, updated);
      return updated;
    });
  }

  function toggleFastOnly() {
    setFilters((prev) => {
      const updated = { ...prev, fastChargersOnly: !prev.fastChargersOnly };
      if (boundsRef.current) runFetch(boundsRef.current, updated);
      return updated;
    });
  }

  if (!open) return null;

  const sortedStations = userLocation
    ? [...stations].sort(
        (a, b) =>
          distanceKm(userLocation, { latitude: a.lat, longitude: a.lon }) -
          distanceKm(userLocation, { latitude: b.lat, longitude: b.lon })
      )
    : stations;

  const fullSearchParams = new URLSearchParams();
  if (filters.fastChargersOnly) fullSearchParams.set("fast", "1");
  for (const v of filters.trailerVerdict) fullSearchParams.set(`trailer_${v}`, "1");

  const markers = stations.map((s) => ({
    id: s.id,
    latitude: s.lat,
    longitude: s.lon,
    label: s.name ?? s.operator ?? "",
    iconSrc: TRAILER_PIN_ICON_SRC[getTrailerPinState(s.trailer)],
  }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 sm:flex sm:items-center sm:justify-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white dark:bg-neutral-900 sm:h-[85vh] sm:max-h-[720px] sm:w-full sm:max-w-2xl sm:rounded-lg">
        <div className="flex items-center justify-between border-b border-black/10 p-4 pt-[calc(1rem+var(--safe-top))] dark:border-white/10 sm:pt-4">
          <h2 className="text-lg font-semibold">Ladesäule in der Nähe suchen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 items-center justify-center rounded-md text-xl text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative h-[45vh] min-h-[220px] shrink-0">
            <MapView
              markers={markers}
              cluster
              onBoundsChange={handleBoundsChange}
              fitBoundsOnMarkersChange={false}
              initialCenter={userLocation ?? GERMANY_OVERVIEW_CENTER}
              initialZoom={userLocation ? 13 : GERMANY_OVERVIEW_ZOOM}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
              <span className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-sm font-medium shadow-md dark:bg-neutral-900/95">
                {isLoading ? "Lädt…" : `${stations.length} Ladepunkte`}
              </span>
            </div>
            {locationDenied && !userLocation && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 z-10">
                <p className="pointer-events-auto rounded-md bg-white/95 px-3 py-2 text-xs text-black/60 shadow-md dark:bg-neutral-900/95 dark:text-white/60">
                  Standort konnte nicht ermittelt werden -- über den Standort-Button oben rechts in der Karte
                  erneut versuchen, oder einfach zum gewünschten Bereich schwenken.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-black/10 px-4 py-3 text-sm dark:border-white/10">
            {TRAILER_VERDICT_VALUES.map((value) => (
              <label key={value} className="flex min-h-11 items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={filters.trailerVerdict.includes(value)}
                  onChange={() => toggleTrailerVerdict(value)}
                />
                {TRAILER_VERDICT_LABELS[value]}
              </label>
            ))}
            <label className="flex min-h-11 items-center gap-1.5">
              <input type="checkbox" checked={filters.fastChargersOnly} onChange={toggleFastOnly} />
              Nur Schnelllader (≥100 kW)
            </label>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {requiresLogin ? (
              <p className="text-sm text-black/50 dark:text-white/50">
                <Link href="/login?redirect=/ladepunkte" className="text-route hover:underline" onClick={onClose}>
                  Anmelden
                </Link>{" "}
                um Ladepunkte zu sehen.
              </p>
            ) : sortedStations.length === 0 ? (
              <p className="text-sm text-black/50 dark:text-white/50">
                {isLoading ? "Lädt…" : "Keine Ladepunkte im aktuellen Kartenausschnitt -- Karte verschieben oder Filter anpassen."}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {sortedStations.slice(0, 20).map((s) => {
                  const pinState = getTrailerPinState(s.trailer);
                  const km = userLocation ? distanceKm(userLocation, { latitude: s.lat, longitude: s.lon }) : null;
                  return (
                    <li key={s.id}>
                      <Link
                        href={`/ladepunkte/${s.id}`}
                        onClick={onClose}
                        className="flex items-center justify-between gap-3 rounded-md border border-black/10 p-3 hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
                      >
                        <div>
                          <p className="font-medium">{s.name ?? s.operator}</p>
                          <span
                            className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs text-white"
                            style={{ backgroundColor: TRAILER_PIN_COLORS[pinState] }}
                          >
                            {TRAILER_PIN_LABELS[pinState]}
                          </span>
                        </div>
                        {km !== null && <span className="shrink-0 text-sm text-black/50 dark:text-white/50">{km.toFixed(1)} km</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-black/10 p-4 pb-[calc(1rem+var(--safe-bottom))] dark:border-white/10">
            <Link
              href={`/ladepunkte${fullSearchParams.toString() ? `?${fullSearchParams.toString()}` : ""}`}
              onClick={onClose}
              className="flex min-h-12 w-full items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              Alle Ergebnisse & weitere Filter ansehen →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
