"use client";

import { useEffect, useRef, useState } from "react";

const SHOW_DELAY_MS = 400;
const MIN_VISIBLE_MS = 900;

/** Timing-Regeln aus docs/design/brand-guide.md Abschnitt 10
 * ("Ladeanimation"): Einsatz nur bei Vorgaengen ueber 400ms (kuerzere
 * Wartezeiten bekommen gar keinen Indikator, sonst flackert die
 * Oberflaeche), Mindestanzeigedauer 900ms (ein Indikator, der sofort
 * wieder verschwindet, wirkt wie ein Fehler). `isLoading` ist der rohe,
 * sofort wechselnde Zustand (z. B. ein `loading`-useState); der
 * zurueckgegebene Wert wendet beide Regeln an. */
export function useDelayedLoading(isLoading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    if (isLoading) {
      showTimer = setTimeout(() => {
        shownAtRef.current = Date.now();
        setVisible(true);
      }, SHOW_DELAY_MS);
    } else if (shownAtRef.current !== null) {
      const elapsed = Date.now() - shownAtRef.current;
      const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
      hideTimer = setTimeout(() => {
        setVisible(false);
        shownAtRef.current = null;
      }, remaining);
    } else {
      setVisible(false);
    }

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [isLoading]);

  return visible;
}
