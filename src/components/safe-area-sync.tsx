"use client";

import { useEffect } from "react";

/**
 * Misst env(safe-area-inset-top/bottom) per JS nach und pinnt das Ergebnis
 * als --safe-top/--safe-bottom auf <html> (siehe globals.css :root fuer die
 * env()-Fallbackwerte, bis diese Komponente zum ersten Mal laeuft). Alle
 * Tailwind-Utilities im Projekt nutzen ausschliesslich var(--safe-top)/
 * var(--safe-bottom), nirgends mehr env(...) direkt.
 *
 * Grund: auf mehreren frisch installierten iPhones (Cache geleert, Icon neu
 * hinzugefuegt, mit Web-App-Manifest + beiden apple-/mobile-web-app-capable-
 * Meta-Tags) liefert env(safe-area-inset-bottom) in der als Home-Screen-App
 * gestarteten Standalone-Ansicht durchgehend 0 -- sichtbar direkt beim
 * allerersten Render, nicht erst nach einer Client-seitigen Navigation
 * (Nutzerfeedback, per Screenshot bestaetigt: cremefarbener Streifen im
 * Home-Indicator-Bereich unterhalb der Bottom-Tab-Bar). Das ist ein
 * bekanntes WebKit-Verhalten -- der korrekte Wert wird oft erst NACH dem
 * ersten Layout-Durchlauf verlaesslich berechnet (u. a. dokumentiert im
 * Umfeld von vercel/next.js Diskussion #81264 zu genau diesem Symptom).
 * Deshalb hier: wiederholt per JS ueber ein unsichtbares Hilfselement
 * nachmessen (bei Mount, nach Layout-Wechseln, beim Zurueckkehren aus dem
 * Hintergrund, bei Drehung) und NUR einen plausiblen (> 0) Messwert
 * uebernehmen -- ein zurueckgesetztes env() liefert 0 und darf einen zuvor
 * korrekt gemessenen Wert nicht wieder ueberschreiben.
 */
function measureInsetPx(side: "top" | "bottom"): number {
  const probe = document.createElement("div");
  probe.style.position = "fixed";
  probe.style.left = "0";
  probe.style.visibility = "hidden";
  probe.style.pointerEvents = "none";
  if (side === "top") {
    probe.style.top = "0";
    probe.style.paddingTop = "env(safe-area-inset-top)";
  } else {
    probe.style.bottom = "0";
    probe.style.paddingBottom = "env(safe-area-inset-bottom)";
  }
  document.body.appendChild(probe);
  const raw = side === "top" ? getComputedStyle(probe).paddingTop : getComputedStyle(probe).paddingBottom;
  document.body.removeChild(probe);
  const value = parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

function syncSafeAreaVars() {
  const root = document.documentElement;
  const top = measureInsetPx("top");
  const bottom = measureInsetPx("bottom");
  if (top > 0) root.style.setProperty("--safe-top", `${top}px`);
  if (bottom > 0) root.style.setProperty("--safe-bottom", `${bottom}px`);
}

export function SafeAreaSync() {
  useEffect(() => {
    syncSafeAreaVars();
    // Direkt nach dem ersten Layout-Durchlauf (naechster Frame) nochmal
    // nachmessen -- falls der Wert beim allerersten Aufruf (noch waehrend
    // React hydriert) zu frueh war, um von iOS schon korrekt berechnet zu
    // sein.
    const raf = requestAnimationFrame(syncSafeAreaVars);

    window.addEventListener("pageshow", syncSafeAreaVars);
    window.addEventListener("orientationchange", syncSafeAreaVars);
    document.addEventListener("visibilitychange", syncSafeAreaVars);
    window.visualViewport?.addEventListener("resize", syncSafeAreaVars);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pageshow", syncSafeAreaVars);
      window.removeEventListener("orientationchange", syncSafeAreaVars);
      document.removeEventListener("visibilitychange", syncSafeAreaVars);
      window.visualViewport?.removeEventListener("resize", syncSafeAreaVars);
    };
  }, []);

  return null;
}
