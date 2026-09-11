"use client";

import { useEffect, useRef, useState } from "react";

export interface ChargePointImage {
  url_full: string;
  url_thumb: string;
  width: number | null;
  height: number | null;
  source: string;
  license: string;
  license_url: string | null;
  attribution: string;
  captured_at: string | null;
  distance_m: number | null;
}

const DOT_TOUCH_TARGET_PX = 44;

function AttributionLine({ image, className = "" }: { image: ChargePointImage; className?: string }) {
  return (
    <p className={`truncate text-xs text-white/90 ${className}`}>
      © {image.attribution} ·{" "}
      {image.license_url ? (
        <a
          href={image.license_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white"
          onClick={(e) => e.stopPropagation()}
        >
          {image.license}
        </a>
      ) : (
        image.license
      )}
    </p>
  );
}

/** Ein Bild formatfuellend (16:10), bei mehreren Bildern horizontal
 * durchwischbar mit Dots/Fade/Peek (Nutzerwunsch, siehe
 * CLAUDE_CODE_AUFTRAG_LADESAEULEN_BILDER.md Abschnitt 6). Bilder kommen
 * von externen, lizenzkonformen Quellen (Wikimedia Commons/Mapillary) --
 * bewusst als <img> statt next/image, da die Hosts/CDN-Subdomains nicht
 * vorab bekannt sind (next/image braucht dafuer eine feste
 * remotePatterns-Allowlist). */
export function ChargePointGallery({ images }: { images: ChargePointImage[] }) {
  const [brokenIndexes, setBrokenIndexes] = useState<Set<number>>(new Set());
  const [loadedIndexes, setLoadedIndexes] = useState<Set<number>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const lightboxTrackRef = useRef<HTMLDivElement>(null);

  const displayImages = images.filter((_, i) => !brokenIndexes.has(i));
  const hasMultiple = displayImages.length > 1;

  function markBroken(originalIndex: number) {
    setBrokenIndexes((prev) => new Set(prev).add(originalIndex));
  }

  function markLoaded(originalIndex: number) {
    setLoadedIndexes((prev) => new Set(prev).add(originalIndex));
  }

  function scrollToIndex(ref: React.RefObject<HTMLDivElement | null>, index: number) {
    const track = ref.current;
    if (!track) return;
    const slide = track.children[index] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  function handleScroll(ref: React.RefObject<HTMLDivElement | null>) {
    const track = ref.current;
    if (!track || track.clientWidth === 0) return;
    const index = Math.round(track.scrollLeft / track.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, displayImages.length - 1)));
  }

  function handleKeyDown(e: React.KeyboardEvent, ref: React.RefObject<HTMLDivElement | null>) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = Math.min(activeIndex + 1, displayImages.length - 1);
      setActiveIndex(next);
      scrollToIndex(ref, next);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = Math.max(activeIndex - 1, 0);
      setActiveIndex(prev);
      scrollToIndex(ref, prev);
    } else if (e.key === "Escape") {
      setLightboxOpen(false);
    }
  }

  // Lightbox startet auf demselben Bild, das gerade in der Hauptansicht
  // aktiv ist -- beim Oeffnen einmalig dorthin scrollen (ohne Animation,
  // damit kein sichtbares "Durchlaufen" passiert).
  useEffect(() => {
    if (!lightboxOpen) return;
    const track = lightboxTrackRef.current;
    const slide = track?.children[activeIndex] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "instant" as ScrollBehavior, inline: "start", block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen]);

  if (displayImages.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-lg border border-black/10 bg-black/5 text-center dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-black/50 dark:text-white/50">Noch keine Fotos zu diesem Ladepunkt vorhanden.</p>
        <a
          href="https://commons.wikimedia.org/wiki/Commons:Upload"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-route hover:underline"
        >
          Foto beitragen
        </a>
      </div>
    );
  }

  const slideWidthClass = hasMultiple ? "w-[calc(100%-12px)]" : "w-full";

  return (
    <div className="relative">
      <div
        ref={trackRef}
        role="group"
        aria-roledescription="Bildergalerie"
        aria-label={`Fotos der Ladestation, ${displayImages.length} Bild${displayImages.length === 1 ? "" : "er"}`}
        tabIndex={0}
        onKeyDown={(e) => handleKeyDown(e, trackRef)}
        onScroll={() => handleScroll(trackRef)}
        className="charge-gallery-track flex snap-x snap-mandatory overflow-x-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-route"
      >
        {displayImages.map((image, index) => (
          <button
            key={index}
            type="button"
            onClick={() => {
              setActiveIndex(index);
              setLightboxOpen(true);
            }}
            className={`relative aspect-[16/10] shrink-0 snap-start overflow-hidden bg-black/10 dark:bg-white/10 ${slideWidthClass}`}
          >
            <img
              src={image.url_thumb}
              alt=""
              loading={index === 0 ? "eager" : "lazy"}
              onLoad={() => markLoaded(images.indexOf(image))}
              onError={() => markBroken(images.indexOf(image))}
              className="h-full w-full object-cover"
            />
            {!loadedIndexes.has(images.indexOf(image)) && (
              <div className="charge-gallery-shimmer absolute inset-0" aria-hidden="true" />
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
              <AttributionLine image={image} />
            </div>
          </button>
        ))}
      </div>

      {hasMultiple && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black/25 to-transparent"
        />
      )}

      {hasMultiple && (
        <div className="mt-2 flex items-center justify-center gap-1">
          {displayImages.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Bild ${index + 1} von ${displayImages.length}`}
              aria-current={index === activeIndex}
              onClick={() => {
                setActiveIndex(index);
                scrollToIndex(trackRef, index);
              }}
              className="flex items-center justify-center"
              style={{ minWidth: DOT_TOUCH_TARGET_PX, minHeight: DOT_TOUCH_TARGET_PX }}
            >
              <span
                className={`block h-2 w-2 rounded-full transition-colors ${
                  index === activeIndex ? "bg-route" : "bg-black/25 dark:bg-white/30"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black"
          role="dialog"
          aria-modal="true"
          aria-label="Foto-Vollbildansicht"
        >
          <div className="flex items-center justify-end p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Schließen"
              className="flex h-11 w-11 items-center justify-center rounded-md text-2xl text-white hover:bg-white/10"
            >
              ✕
            </button>
          </div>

          <div
            ref={lightboxTrackRef}
            tabIndex={0}
            onKeyDown={(e) => handleKeyDown(e, lightboxTrackRef)}
            onScroll={() => handleScroll(lightboxTrackRef)}
            className="charge-gallery-track flex flex-1 snap-x snap-mandatory overflow-x-auto outline-none"
          >
            {displayImages.map((image, index) => (
              <div key={index} className="relative w-full shrink-0 snap-start">
                <img src={image.url_full} alt="" className="h-full w-full object-contain" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  <AttributionLine image={image} className="text-sm" />
                </div>
              </div>
            ))}
          </div>

          {hasMultiple && (
            <div className="flex items-center justify-center gap-1 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
              {displayImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-label={`Bild ${index + 1} von ${displayImages.length}`}
                  aria-current={index === activeIndex}
                  onClick={() => {
                    setActiveIndex(index);
                    scrollToIndex(lightboxTrackRef, index);
                  }}
                  className="flex items-center justify-center"
                  style={{ minWidth: DOT_TOUCH_TARGET_PX, minHeight: DOT_TOUCH_TARGET_PX }}
                >
                  <span
                    className={`block h-2 w-2 rounded-full transition-colors ${
                      index === activeIndex ? "bg-route" : "bg-white/30"
                    }`}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* scroll-snap-Leisten ohne sichtbare Scrollbar (Nutzerwunsch) --
          Scrollen bleibt per Touch/Wischen/Tastatur voll funktional, nur
          die Browser-Scrollbar-Optik wird ausgeblendet. */}
      <style>{`
        .charge-gallery-track {
          scrollbar-width: none;
        }
        .charge-gallery-track::-webkit-scrollbar {
          display: none;
        }
        .charge-gallery-shimmer {
          background: linear-gradient(
            90deg,
            color-mix(in srgb, currentColor 8%, transparent) 25%,
            color-mix(in srgb, currentColor 15%, transparent) 37%,
            color-mix(in srgb, currentColor 8%, transparent) 63%
          );
          background-size: 400% 100%;
          animation: charge-gallery-shimmer 1.4s ease infinite;
        }
        @keyframes charge-gallery-shimmer {
          0% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0 50%;
          }
        }
      `}</style>
    </div>
  );
}
