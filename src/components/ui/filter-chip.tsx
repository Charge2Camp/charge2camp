"use client";

/** §14 Komponentenbibliothek: nach dem Ladepunkte-Filter-Panel (ersetzt dort
 * die bisherigen Checkboxen, kein Formular-Submit noetig) inzwischen auch im
 * Routenplaner fuer die Mindest-Ladeleistung-Stufenauswahl im Einsatz --
 * damit zweiter echter Verwendungskontext, deshalb nach ui/ verschoben
 * (2026-09-27, docs/DESIGN_DECISIONS.md). `aria-pressed` statt nur eines
 * Farbunterschieds, damit der aktive Zustand auch per Screenreader
 * erkennbar ist. min-h-11 (44px) nach CLAUDE.md Prinzip 8 (Touch-Ziele). */
export function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 rounded-full border px-4 text-sm font-medium transition-colors ${
        active
          ? "border-action bg-action"
          : "border-line-strong bg-transparent hover:bg-black/5 dark:hover:bg-white/10"
      }`}
    >
      {active && <span aria-hidden="true">✓</span>}
      {label}
    </button>
  );
}
