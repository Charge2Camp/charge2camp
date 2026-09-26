"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { StationTechnicalDetails } from "@/components/charging-stations/station-technical-details";
import { StationFavoriteRow } from "@/components/charging-stations/station-favorite-row";
import { StationCompatibilitySummary } from "@/components/charging-stations/station-compatibility";
import { RigLengthDistributionChart } from "@/components/charging-stations/rig-length-distribution";
import { StationReviewsList } from "@/components/charging-stations/station-reviews-list";
import { StationBlockSection } from "@/components/charging-stations/station-block-section";
import { StationNearbyPoi } from "@/components/charging-stations/station-nearby-poi";
import { ReviewStateBadge } from "@/components/charging-stations/review-state-badge";
import { SectionCard } from "@/components/charging-stations/section-card";
import { FormError } from "@/components/form-error";
import { TRAILER_PIN_COLORS, TRAILER_PIN_LABELS, TRAILER_PIN_TEXT_CLASS, getTrailerPinState } from "@/lib/trailer-verdict";
import {
  NEARBY_POI_CATEGORY_ICONS,
  NEARBY_POI_CATEGORY_LABELS,
  NEARBY_POI_CATEGORY_ORDER,
} from "@/lib/nearby-poi";
import { useDelayedLoading } from "@/lib/use-delayed-loading";
import { useMediaQuery } from "@/lib/use-media-query";
import type { ChargingStationView } from "@/lib/charging-stations";
import type { ChargingStationDetailExtras } from "@/lib/charging-station-detail";

type SnapState = "peek" | "half" | "full";

// Immer hoher Container (92dvh), alle drei Zustaende sind nur translateY-
// Offsets davon -- keine Hoehen-Animation zwischen den Snap-Punkten (siehe
// Kommentar an der Komponente). PEEK_VISIBLE_PX ist bewusst grosszuegig
// bemessen (Handle + Name/Betreiber + Badges + Favorit-Zeile + Tab-Bar-
// Abstand), damit im Peek-Zustand nichts abgeschnitten wirkt.
const CONTAINER_HEIGHT_VH = 92;
const PEEK_VISIBLE_PX = 220;
const HALF_VISIBLE_VH = 50;
const CLOSE_VELOCITY_PX_MS = 0.6;
const SETTLE_VELOCITY_PX_MS = 0.5;
const OVERDRAG_PAST_PEEK_PX = 80;
const TAP_MOVEMENT_THRESHOLD_PX = 6;

function snapOffsetPx(snap: SnapState, viewportH: number): number {
  const containerH = (viewportH * CONTAINER_HEIGHT_VH) / 100;
  if (snap === "full") return 0;
  if (snap === "half") return containerH - (viewportH * HALF_VISIBLE_VH) / 100;
  return containerH - PEEK_VISIBLE_PX;
}

interface DragState {
  pointerId: number;
  startClientY: number;
  startOffsetPx: number;
  lastClientY: number;
  lastT: number;
  velocity: number;
}

/** Ziehbares Bottom-Sheet fuer einen angetippten Kartenpin auf der
 * Ladepunkte-Karte (nur mobil, siehe charging-station-map-explorer.tsx) --
 * ersetzt dort die Navigation auf /ladepunkte/[id] durch ein Sheet direkt
 * ueber der Karte, das per Ziehen (oder Antippen der Kopfzeile, ohne Ziehen)
 * zwischen drei Positionen einrastet: Peek (Name/Badges/Favorit +
 * Gespann-Kompatibilitaet), Half (+ technische Daten inkl. "Route hierher
 * planen"), Full (+ Diagramm, Bewertungen, Blockieren -- scrollbar).
 *
 * `station` ist ein Snapshot aus dem bereits geladenen Kartenmarker (siehe
 * charging-station-map-explorer.tsx `selectedStationSnapshot`) -- bewusst
 * NICHT das live `stations`-Array, das sich bei jedem Kartenschwenk komplett
 * ersetzt und sonst das offene Sheet leerlaufen liesse. Peek/Half rendern
 * daher sofort ohne Nachladen; nur Bewertungen/Favorit-Status/Gespann-
 * Auswertung (fuer Half-Buttons und Full) laedt dieses Sheet selbst im
 * Hintergrund von /api/charge-points/[id]/detail nach, sequenzgesichert wie
 * handleBoundsChange im Explorer. */
export function StationBottomSheet({
  station,
  isLoggedIn,
  onClose,
}: {
  station: ChargingStationView | null;
  isLoggedIn: boolean;
  onClose: () => void;
}) {
  const [snap, setSnap] = useState<SnapState>("peek");
  const [liveOffsetPx, setLiveOffsetPx] = useState<number | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const prevStationIdRef = useRef<string | null>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const [extras, setExtras] = useState<ChargingStationDetailExtras | null>(null);
  const [extrasError, setExtrasError] = useState(false);
  const [extrasLoadingRaw, setExtrasLoadingRaw] = useState(false);
  const extrasLoading = useDelayedLoading(extrasLoadingRaw);
  const fetchSeqRef = useRef(0);

  // Neu geoeffnet (vorher kein Snapshot) -> Peek. Beim Wechsel zwischen zwei
  // verschiedenen Stationen waehrend das Sheet bereits offen ist, bleibt der
  // aktuelle Snap-Zustand dagegen bewusst erhalten (nur der Inhalt wechselt).
  useEffect(() => {
    if (station && prevStationIdRef.current === null) setSnap("peek");
    prevStationIdRef.current = station?.id ?? null;
  }, [station]);

  async function loadExtras(stationId: string, lat: number, lon: number) {
    const seq = ++fetchSeqRef.current;
    setExtras(null);
    setExtrasError(false);
    setExtrasLoadingRaw(true);
    // Go-Live-Audit (Offline-/Netzstaerke-Verhalten): ohne Timeout haengt
    // dieser Request bei schwachem statt komplett fehlendem Netz unbegrenzt
    // in "Details werden geladen...", ohne je den catch-Zweig zu erreichen.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`/api/charge-points/${stationId}/detail?lat=${lat}&lon=${lon}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = (await res.json()) as ChargingStationDetailExtras;
      if (seq !== fetchSeqRef.current) return;
      setExtras(data);
    } catch {
      if (seq !== fetchSeqRef.current) return;
      setExtrasError(true);
    } finally {
      clearTimeout(timeoutId);
      if (seq === fetchSeqRef.current) setExtrasLoadingRaw(false);
    }
  }

  useEffect(() => {
    if (!station) return;
    const stationId = station.id;
    const { lat, lon } = station;
    // Wie setStations(initialStations) in charging-station-map-explorer.tsx:
    // ueber einen Mikrotask entkoppelt, damit das anfaengliche setState
    // (Ladezustand setzen) nicht synchron im Effect-Body passiert (siehe
    // react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      void loadExtras(stationId, lat, lon);
    });
    // Bewusst nur an die ID gekoppelt, nicht an das ganze `station`-Objekt --
    // sonst wuerde jedes Kartenschwenken (neues Snapshot-Objekt derselben
    // Station) einen unnoetigen erneuten Fetch ausloesen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [station?.id]);

  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const viewportH = window.innerHeight;
    dragRef.current = {
      pointerId: e.pointerId,
      startClientY: e.clientY,
      startOffsetPx: snapOffsetPx(snap, viewportH),
      lastClientY: e.clientY,
      lastT: performance.now(),
      velocity: 0,
    };
  }

  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const now = performance.now();
    const dt = now - drag.lastT;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastClientY) / dt;
    drag.lastClientY = e.clientY;
    drag.lastT = now;

    const peek = snapOffsetPx("peek", window.innerHeight);
    const raw = drag.startOffsetPx + (e.clientY - drag.startClientY);
    setLiveOffsetPx(Math.max(0, Math.min(raw, peek + OVERDRAG_PAST_PEEK_PX)));
  }

  function settle(finalOffsetPx: number, velocity: number) {
    const viewportH = window.innerHeight;
    const peek = snapOffsetPx("peek", viewportH);
    const half = snapOffsetPx("half", viewportH);

    const isFastDownward = velocity > CLOSE_VELOCITY_PX_MS;
    if (finalOffsetPx > peek + PEEK_VISIBLE_PX * 0.6 || (snap === "peek" && isFastDownward)) {
      onClose();
      return;
    }
    if (Math.abs(velocity) > SETTLE_VELOCITY_PX_MS) {
      setSnap(velocity < 0 ? (finalOffsetPx < half ? "full" : "half") : finalOffsetPx > half ? "peek" : "half");
      return;
    }
    const distanceToFull = Math.abs(finalOffsetPx);
    const distanceToHalf = Math.abs(finalOffsetPx - half);
    const distanceToPeek = Math.abs(finalOffsetPx - peek);
    const nearest = Math.min(distanceToFull, distanceToHalf, distanceToPeek);
    setSnap(nearest === distanceToFull ? "full" : nearest === distanceToHalf ? "half" : "peek");
  }

  function handlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const netMovement = e.clientY - drag.startClientY;
    dragRef.current = null;
    setLiveOffsetPx(null);

    // Antippen ohne (nennenswertes) Ziehen -> zum naechsten Snap-Punkt
    // springen, statt es wie eine (folgenlose) Mini-Drag-Geste zu behandeln.
    // Direkt hier statt ueber einen separaten Button-onClick, da
    // setPointerCapture auf dem umschliessenden Element das nachfolgende
    // Click-Event nicht zuverlaessig ans verschachtelte <button> weiterreicht.
    if (Math.abs(netMovement) < TAP_MOVEMENT_THRESHOLD_PX) {
      cycleSnap();
      return;
    }

    const peek = snapOffsetPx("peek", window.innerHeight);
    const raw = drag.startOffsetPx + netMovement;
    const finalOffsetPx = Math.max(0, Math.min(raw, peek + OVERDRAG_PAST_PEEK_PX));
    settle(finalOffsetPx, drag.velocity);
  }

  function cycleSnap() {
    setSnap((current) => (current === "peek" ? "half" : current === "half" ? "full" : "peek"));
  }

  if (!station) return null;

  const pinState = getTrailerPinState(station.trailer);
  const restingTransform =
    snap === "full"
      ? "translateY(0)"
      : snap === "half"
        ? `translateY(${CONTAINER_HEIGHT_VH - HALF_VISIBLE_VH}dvh)`
        : `translateY(calc(${CONTAINER_HEIGHT_VH}dvh - ${PEEK_VISIBLE_PX}px))`;

  return (
    <div
      className={`fixed inset-x-0 bottom-0 flex h-[92dvh] flex-col rounded-t-2xl bg-card shadow-2xl ${
        snap === "full" ? "z-50" : "z-[35]"
      }`}
      style={{
        transform: liveOffsetPx !== null ? `translateY(${liveOffsetPx}px)` : restingTransform,
        transition:
          liveOffsetPx !== null || reducedMotion ? "none" : "transform 260ms cubic-bezier(0.32, 0.72, 0, 1)",
      }}
      role="dialog"
      aria-label={station.name ?? station.operator ?? "Ladepunkt"}
    >
      {/* Kopfzeile = ausschliesslich Zieh-/Tipp-Flaeche, strukturell getrennt
          vom scrollbaren Inhalt darunter -- dadurch keine Scroll-vs-Drag-
          Erkennung noetig (siehe Komponentenkommentar). Der zusaetzliche
          Bodenabstand haelt den eigentlichen Inhalt (Name/Badges/Button)
          oberhalb der Bottom-Tab-Bar-Zone frei, die im Peek-/Half-Zustand
          (z-40 > z-[35] hier) davor liegt. */}
      <div
        className="shrink-0 touch-none select-none pb-[calc(4rem+var(--safe-bottom))]"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="flex justify-center pt-2 pb-1">
          <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-black/15 dark:bg-white/20" />
        </div>

        <div className="flex items-start justify-between gap-2 px-4">
          {/* Bewusst OHNE eigenen Klick-Handler (kein <button>): das
              Antippen dieses Bereichs wird generisch von handlePointerUp
              oben erkannt (Tap ohne nennenswertes Ziehen -> cycleSnap) --
              ein eigener onClick hier wuerde bei jedem Tap zusaetzlich
              feuern und den Zustand doppelt weiterschalten. Bleibt
              zugleich Teil der Zieh-Flaeche (Referenz-Apps: von ueberall
              im sichtbaren Kartenbereich ziehbar, nicht nur am schmalen
              Griff). */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-text-muted">{station.operator}</p>
            <p className="truncate text-lg font-semibold">{station.name ?? station.operator}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs ${TRAILER_PIN_TEXT_CLASS[pinState]}`}
                style={{ backgroundColor: TRAILER_PIN_COLORS[pinState] }}
              >
                {TRAILER_PIN_LABELS[pinState]}
              </span>
              <ReviewStateBadge origin={station.trailer?.origin} />
              {station.max_power_kw && (
                <span className="rounded-full border border-line px-2 py-0.5 text-xs">
                  {station.max_power_kw} kW
                </span>
              )}
            </div>
            {/* Ausstattungs-Icons schon im Peek-Zustand sichtbar (Nutzerwunsch
                "alle Infos direkt einsehbar, ohne weitere Seite", an ABRP
                orientiert) -- nur Kategorien mit mind. einem Treffer im
                1-km-Umkreis, siehe lib/nearby-poi.ts. Erscheint erst, sobald
                `extras` geladen ist (kurze Verzoegerung nach dem Antippen). */}
            {extras?.nearbyPoi.status === "ok" && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {NEARBY_POI_CATEGORY_ORDER.filter((c) => extras.nearbyPoi.status === "ok" && extras.nearbyPoi.byCategory[c].length > 0).map(
                  (c) => (
                    <span
                      key={c}
                      className="rounded-full border border-line px-2 py-0.5 text-xs"
                    >
                      {NEARBY_POI_CATEGORY_ICONS[c]} {NEARBY_POI_CATEGORY_LABELS[c]}
                    </span>
                  )
                )}
              </div>
            )}
          </div>
          {/* Explizite Tastatur-/Screenreader-Bedienung fuers Ein-/
              Ausklappen (Antippen der Kopfzeile reicht dafuer nur mit
              Zeigegeraet/Touch, siehe oben) -- stopPropagation, sonst
              wuerde das umschliessende onPointerDown/Up die Zieh-Geste
              startet und cycleSnap zusaetzlich ein zweites Mal ausloesen. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={cycleSnap}
            aria-label="Ansicht vergrößern oder verkleinern"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ⌃
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            aria-label="Schließen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
          >
            ×
          </button>
        </div>

        {/* Favorit + Gespann-Kompatibilitaets-Hinweis ganz oben statt des
            frueheren "Route hierher planen"-Buttons hier (Nutzerwunsch) --
            der Route-Button bleibt weiterhin bei den technischen Daten
            unten erreichbar (StationTechnicalDetails), nur nicht mehr
            doppelt. Erst sichtbar, sobald `extras` geladen ist -- bis dahin
            bleibt der Platz leer statt eines Platzhalters. */}
        {isLoggedIn && extras && (
          <div className="px-4 pt-3" onPointerDown={(e) => e.stopPropagation()}>
            <StationFavoriteRow
              station={station}
              isFavorite={extras.isFavorite}
              personalCompatibility={extras.personalCompatibility}
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8">
        <div className="flex flex-col gap-6 pt-2">
          <SectionCard>
            <StationTechnicalDetails station={station} />
          </SectionCard>

          {extrasLoading && <p className="text-sm text-text-muted">Details werden geladen…</p>}
          {extrasError && (
            // Go-Live-Audit: Text versprach bisher "erneut versuchen" ohne
            // tatsaechliche Aktion dahinter -- gerade bei schwachem Netz
            // unterwegs (haeufigster Ausloeser dieses Fehlers) ein echter
            // Sackgassen-Zustand ohne das Sheet zu schliessen/neu zu oeffnen.
            <div className="flex items-center justify-between gap-2">
              <FormError className="text-sm">Bewertungen konnten nicht geladen werden.</FormError>
              <button
                type="button"
                onClick={() => void loadExtras(station.id, station.lat, station.lon)}
                className="min-h-11 shrink-0 rounded-md border border-error/30 px-3 text-sm font-medium text-error hover:bg-error/10"
              >
                Erneut versuchen
              </button>
            </div>
          )}

          {extras && (
            <>
              <SectionCard>
                <StationCompatibilitySummary
                  communitySummary={extras.communitySummary}
                  personalCompatibility={extras.personalCompatibility}
                  isLoggedIn={isLoggedIn}
                />
              </SectionCard>
              <SectionCard>
                <section>
                  <h2 className="font-semibold">Eignung nach Gespannlänge</h2>
                  <div className="mt-2">
                    <RigLengthDistributionChart distribution={extras.rigLengthDistribution} />
                  </div>
                </section>
              </SectionCard>
              <SectionCard>
                <StationNearbyPoi result={extras.nearbyPoi} />
              </SectionCard>
              <SectionCard>
                <StationReviewsList
                  reviews={extras.reviews}
                  isLoggedIn={isLoggedIn}
                  ownReview={extras.ownReview}
                  stationId={station.id}
                  externalKey={station.external_key}
                  vehicles={extras.ownVehicles}
                  caravans={extras.ownCaravans}
                  onReviewSubmitted={() => loadExtras(station.id, station.lat, station.lon)}
                />
              </SectionCard>
              {/* StationBlockSection bewusst OHNE SectionCard -- niedrigschwellige
                  Verwaltungsaktion, keine Inhalts-Info, soll sich nicht wie ein
                  gleichwertiger Info-Block anfuehlen (Nutzerwunsch, s. ABRP-Vergleich). */}
              {isLoggedIn && <StationBlockSection stationId={station.id} isBlocked={extras.isBlocked} />}
            </>
          )}

          <Link
            href={`/ladepunkte/${station.id}`}
            className="mb-2 inline-flex min-h-11 items-center text-sm font-medium text-route hover:underline"
          >
            Vollständige Seite öffnen →
          </Link>
        </div>
      </div>
    </div>
  );
}
