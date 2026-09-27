"use client";

import { useEffect, useMemo, useRef } from "react";

const ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 3;

/** Nutzerwunsch (2026-09-27): Verbrauchseingabe im Routenplaner als
 * iOS-artiger "Wheel Picker" statt freier Zahleneingabe -- CSS
 * scroll-snap statt einer zusaetzlichen Abhaengigkeit (CLAUDE.md Prinzip 4,
 * kein `react-mobile-picker` o. Ae. im Einsatz), funktioniert dadurch auf
 * Touch nativ mit Momentum-Scrolling (Prinzip 8). Lokal bei routing/
 * gehalten statt in ui/ -- bisher nur dieser eine Einsatzort (Verbrauch mit
 * Gespann), analog zur bestehenden SocSlider-Begruendung in
 * route-planner-form.tsx. */
export function WheelPicker({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  name,
}: {
  label: string;
  /** Aktueller Wert -- muss nicht exakt in `values` vorkommen (z. B. ein
   * Dezimalwert aus dem Fahrzeugprofil); wird dann auf den naechstgelegenen
   * Wheel-Schritt gerundet dargestellt, s. `nearestIndex`. */
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Fuer den nativen Formular-Submit (planRoute liest FormData, kein
   * kontrolliertes React-Feld) -- verstecktes Input-Element traegt den Wert. */
  name?: string;
}) {
  const values = useMemo(() => {
    const arr: number[] = [];
    for (let v = min; v <= max + 1e-9; v += step) arr.push(Math.round(v * 100) / 100);
    return arr;
  }, [min, max, step]);

  const containerRef = useRef<HTMLDivElement>(null);
  const suppressScrollHandlerRef = useRef(false);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const nearestIndex = useMemo(() => {
    let closest = 0;
    let closestDiff = Infinity;
    values.forEach((v, i) => {
      const diff = Math.abs(v - value);
      if (diff < closestDiff) {
        closest = i;
        closestDiff = diff;
      }
    });
    return closest;
  }, [values, value]);

  // Scrollt zur passenden Position, wenn sich `value` von AUSSEN aendert
  // (z. B. Fahrzeugwechsel setzt den Verbrauch aus dem Profil) -- nicht bei
  // jedem Render, sonst unterbricht es eigenes Scrollen des Nutzers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const target = nearestIndex * ITEM_HEIGHT;
    if (Math.abs(el.scrollTop - target) < 1) return;
    suppressScrollHandlerRef.current = true;
    el.scrollTo({ top: target, behavior: "auto" });
    const raf = requestAnimationFrame(() => {
      suppressScrollHandlerRef.current = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [nearestIndex]);

  function handleScroll() {
    if (suppressScrollHandlerRef.current) return;
    if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    // Momentum-Scrolling feuert viele Events -- erst auswerten, wenn der
    // Scroll-Vorgang eine Weile stillsteht (analog zum Snap-Verhalten).
    settleTimerRef.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      const index = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_HEIGHT)));
      const next = values[index];
      if (next !== value) onChange(next);
    }, 120);
  }

  function handleItemClick(v: number) {
    if (v !== value) onChange(v);
  }

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-md border-y border-line-strong"
          style={{ height: ITEM_HEIGHT }}
        />
        <div
          ref={containerRef}
          role="listbox"
          aria-label={label}
          tabIndex={0}
          onScroll={handleScroll}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && nearestIndex > 0) {
              e.preventDefault();
              handleItemClick(values[nearestIndex - 1]);
            } else if (e.key === "ArrowDown" && nearestIndex < values.length - 1) {
              e.preventDefault();
              handleItemClick(values[nearestIndex + 1]);
            }
          }}
          className="w-24 overflow-y-auto overscroll-contain rounded-md border border-line-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-action"
          style={{ height: ITEM_HEIGHT * VISIBLE_ROWS, scrollSnapType: "y mandatory" }}
        >
          <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
          {values.map((v) => (
            <div
              key={v}
              role="option"
              aria-selected={v === value}
              onClick={() => handleItemClick(v)}
              className={`flex items-center justify-center tabular-nums transition-opacity ${
                v === value ? "font-semibold opacity-100" : "cursor-pointer opacity-40"
              }`}
              style={{ height: ITEM_HEIGHT, scrollSnapAlign: "center" }}
            >
              {v}
              {unit}
            </div>
          ))}
          <div style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
        </div>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
    </div>
  );
}
