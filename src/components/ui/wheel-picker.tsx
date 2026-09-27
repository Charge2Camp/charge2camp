"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const ITEM_HEIGHT = 44;
const VISIBLE_ROWS = 5;

export interface WheelPickerOption<T extends string | number> {
  label: string;
  value: T;
}

/** Baut eine durchnummerierte Options-Liste fuer einen numerischen Bereich
 * (z. B. Verbrauch) -- Kurzform fuer WheelPickerField, wenn die Optionen
 * einfach "min, min+step, ..., max" sind statt einer manuell benannten
 * Liste wie bei der Mindest-Ladeleistung. */
export function numericWheelOptions(min: number, max: number, step: number): WheelPickerOption<number>[] {
  const arr: WheelPickerOption<number>[] = [];
  for (let v = min; v <= max + 1e-9; v += step) {
    const rounded = Math.round(v * 100) / 100;
    arr.push({ label: String(rounded), value: rounded });
  }
  return arr;
}

function nearestOptionIndex<T extends string | number>(options: WheelPickerOption<T>[], value: T): number {
  const exact = options.findIndex((o) => o.value === value);
  if (exact !== -1) return exact;
  let closest = 0;
  let closestDiff = Infinity;
  options.forEach((o, i) => {
    if (typeof o.value !== "number" || typeof value !== "number") return;
    const diff = Math.abs(o.value - value);
    if (diff < closestDiff) {
      closest = i;
      closestDiff = diff;
    }
  });
  return closest;
}

/** Das eigentliche scrollbare Wheel (CSS scroll-snap statt einer
 * npm-Abhaengigkeit wie `react-mobile-picker`, CLAUDE.md Prinzip 4) --
 * nur innerhalb des Bottom-Sheets von WheelPickerField gerendert, siehe
 * dort fuer den Kontext. */
function Wheel<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: WheelPickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const suppressScrollHandlerRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIndex = useMemo(() => nearestOptionIndex(options, value), [options, value]);
  const padding = ITEM_HEIGHT * Math.floor(VISIBLE_ROWS / 2);

  // Scrollt zur passenden Position, wenn sich `value` von AUSSEN aendert
  // (z. B. Fahrzeugwechsel setzt den Verbrauch aus dem Profil) -- nicht bei
  // jedem Render, sonst unterbricht es eigenes Scrollen des Nutzers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = selectedIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 1) return;
    suppressScrollHandlerRef.current = true;
    el.scrollTo({ top: target, behavior: "auto" });
    const raf = requestAnimationFrame(() => {
      suppressScrollHandlerRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedIndex]);

  function handleScroll() {
    if (suppressScrollHandlerRef.current) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    // Momentum-Scrolling feuert viele Events -- erst auswerten, wenn der
    // Scroll-Vorgang eine Weile stillsteht (analog zum Snap-Verhalten).
    settleTimerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const index = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)));
      const next = options[index].value;
      if (next !== value) onChange(next);
    }, 120);
  }

  function selectIndex(index: number) {
    const next = options[index].value;
    if (next !== value) onChange(next);
  }

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-line-strong"
        style={{ height: ITEM_HEIGHT }}
      />
      <div
        ref={containerRef}
        role="listbox"
        aria-label={ariaLabel}
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" && selectedIndex > 0) {
            e.preventDefault();
            selectIndex(selectedIndex - 1);
          } else if (e.key === "ArrowDown" && selectedIndex < options.length - 1) {
            e.preventDefault();
            selectIndex(selectedIndex + 1);
          }
        }}
        className="overflow-y-auto overscroll-contain focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
        style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: padding }} aria-hidden="true" />
        {options.map((option, i) => (
          <div
            key={option.label}
            role="option"
            aria-selected={i === selectedIndex}
            onClick={() => selectIndex(i)}
            className={`flex items-center justify-center text-center tabular-nums transition-opacity ${
              i === selectedIndex ? "text-lg font-semibold opacity-100" : "cursor-pointer text-base opacity-40"
            }`}
            style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
          >
            {option.label}
          </div>
        ))}
        <div style={{ height: padding }} aria-hidden="true" />
      </div>
    </div>
  );
}

/** §14 Komponentenbibliothek: urspruenglich lokal bei routing/ (Nutzerwunsch
 * 2026-09-27, Wheel-Picker-Bottom-Sheet analog zu iOS UIPickerView bzw. dem
 * Android-Aequivalent, statt eines inline eingebetteten Wheels oder einer
 * freien Zahleneingabe), seit dem selben Tag mit einem zweiten, unabhaengigen
 * Einsatzort (Mindest-Ladeleistung im Ladepunkte-Filter-Panel, identische
 * Stufenauswahl wie im Routenplaner) nach ui/ verschoben, s.
 * docs/DESIGN_DECISIONS.md. Ein kompakter Feld-Trigger (Label + aktueller
 * Wert + Chevron, sieht aus wie ein `Select`) oeffnet per Tap ein von unten
 * einfahrendes Sheet mit einem grossen Wheel. `Modal` (ui/modal.tsx) passt
 * dafuer nicht: die ist auf Mobile ein VOLLBILD-Sheet (h-full) -- hier soll
 * dagegen nur ein kompaktes, inhaltsgrosses Sheet am unteren Rand
 * erscheinen, daher ein eigenes, bewusst schlankes Sheet-Markup ohne
 * Drag-Gesten (Inhalt hat feste Hoehe, ein Drag-Handle waere hier nur
 * Dekoration ohne Funktion, anders als beim gezogenen
 * station-bottom-sheet.tsx). */
export function WheelPickerField<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
  triggerFormat,
}: {
  label: string;
  options: WheelPickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Fuer einen nativen Formular-Submit ueber FormData (z. B. planRoute im
   * Routenplaner, kein kontrolliertes React-Feld) -- verstecktes
   * Input-Element traegt den Wert. Im Ladepunkte-Filter-Panel dagegen nicht
   * gesetzt, dort wendet `onChange` den Filter direkt an (kein Formular-
   * Submit noetig, siehe charging-station-map-explorer.tsx). */
  name?: string;
  /** Wie der aktuelle Wert auf dem Feld-Trigger dargestellt wird -- per
   * Default das Label der naechstgelegenen Option. Noetig fuer den
   * Verbrauch im Routenplaner: ein aus dem Fahrzeugprofil uebernommener
   * Dezimalwert (z. B. 24.3) soll dort bis zur ersten Nutzerinteraktion
   * exakt sichtbar bleiben, nicht auf den naechsten Wheel-Schritt
   * gerundet. */
  triggerFormat?: (value: T) => string;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(() => nearestOptionIndex(options, value), [options, value]);
  const triggerLabel = triggerFormat ? triggerFormat(value) : (options[selectedIndex]?.label ?? String(value));

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
      <span>{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-line-strong px-3 py-2 text-left text-base dark:bg-transparent"
      >
        <span className="truncate">{triggerLabel}</span>
        <span aria-hidden="true" className="shrink-0 text-text-muted">
          ▾
        </span>
      </button>
      {name && <input type="hidden" name={name} value={value} />}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="w-full rounded-t-xl bg-card pb-[calc(1rem+var(--safe-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line p-4">
              <h2 className="text-base font-semibold">{label}</h2>
              <Button variant="plain" onClick={() => setOpen(false)}>
                Fertig
              </Button>
            </div>
            <div className="p-4">
              <Wheel options={options} value={value} onChange={onChange} ariaLabel={label} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
