/** Ladeanimation aus docs/design/brand-guide.md Abschnitt 10: der
 * Wohnwagen laedt sich selbst auf statt eines Spinners. `text` ist
 * Pflicht (siehe Guide: "Ein Indikator ohne Erklaerung erhoeht die
 * gefuehlte Wartezeit") -- wird von useDelayedLoading gesteuert
 * (400ms-Verzoegerung, 900ms Mindestanzeigedauer), nicht direkt an
 * `loading`-Zustaende gekoppelt. `prefers-reduced-motion` ist in der
 * SVG-Datei selbst beruecksichtigt (haelt am gefuellten Endzustand). */
export function LoadingIndicator({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-3 text-sm text-text-muted" role="status" aria-live="polite">
      {/* eslint-disable-next-line @next/next/no-img-element -- selbstanimiertes SVG mit eingebetteten CSS-Keyframes, kein next/image-Fall */}
      <img src="/logo/loader.svg" width={64} height={64} alt="" />
      <p>{text}</p>
    </div>
  );
}
