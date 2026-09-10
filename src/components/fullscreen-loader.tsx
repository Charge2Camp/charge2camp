/** Vollflaechiger Ladescreen (Nutzerwunsch: bei jedem Vorgang, der eine
 * Ladepause erfordert -- App-Start, Routenberechnung, Laden gespeicherter
 * Daten, Seitenwechsel). Nutzt dieselbe Ladeanimation wie in
 * docs/design/brand-guide.md Abschnitt 10 beschrieben, nur groesser und
 * mittig auf eigener Flaeche platziert, damit sie als bewusster
 * "Ladebildschirm" statt als kleiner Hinweis wirkt. `position: fixed`
 * deckt Header/Bottom-Tab-Bar mit ab -- das
 * Verschwinden entscheidet ausschliesslich der Aufrufer (client-seitig
 * ueber `loading`-State + useDelayedLoading, oder automatisch durch
 * Next.js' Suspense-Streaming bei app/*\/loading.tsx: die Ziel-Seite
 * ersetzt den Ladescreen nahtlos erst, wenn alle Server-Daten dafuer
 * vorliegen). */
export function FullscreenLoader({ text }: { text: string }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-surface"
      role="status"
      aria-live="polite"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- selbstanimiertes SVG mit eingebetteten CSS-Keyframes, kein next/image-Fall */}
      <img src="/logo/loader.svg" width={128} height={128} alt="" className="drop-shadow-lg" />
      <p className="max-w-xs text-center text-base font-medium text-text">{text}</p>
    </div>
  );
}
