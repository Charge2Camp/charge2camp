"use client";

/** Sofort-anwendender Filter-Chip (kein Formular-Submit noetig) -- ersetzt
 * die bisherigen Checkboxen im Ladepunkte-Filter-Panel. `aria-pressed` statt
 * nur eines Farbunterschieds, damit der aktive Zustand auch per Screenreader
 * erkennbar ist. min-h-11 (44px) nach CLAUDE.md Prinzip 8 (Touch-Ziele).
 *
 * Kurzzeitig (2026-09-27) auch im Routenplaner fuer die Mindest-
 * Ladeleistung im Einsatz und deshalb nach ui/ verschoben -- dort noch am
 * selben Tag durch das Wheel-Picker-Bottom-Sheet (wheel-picker.tsx)
 * ersetzt, s. docs/DESIGN_DECISIONS.md. Zurueck an den urspruenglichen,
 * einzigen Einsatzort, da die ui/-Promotion ohne den zweiten
 * Verwendungskontext ihre Grundlage verloren hat. */
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
