"use client";

import type { ReactNode } from "react";

/**
 * Oeffnet einen externen Deep-Link (z. B. Google Maps) explizit per
 * window.open in einem neuen Tab, statt sich auf einen ploeglichen
 * `<a target="_blank">`-Klick zu verlassen -- damit bleibt die Charge2Camp-App
 * im urspruenglichen Tab/Fenster geoeffnet. Gleiches Muster wie der
 * "Navigation starten"-Button im Routenplaner
 * (src/components/routing/route-planner-form.tsx). In der spaeter
 * geplanten nativen iOS-/Android-App uebernimmt an dieser Stelle
 * `Linking.openURL(href)` das Oeffnen der jeweiligen Karten-App im
 * Hintergrund, waehrend die Charge2Camp-App selbst weiterlaeuft -- die
 * Adapter-Logik (buildUrl) bleibt dabei unveraendert wiederverwendbar.
 */
export function NavigationLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        // Eindeutiger Fenstername pro Klick statt "_blank": ein wiederholt
        // gleicher Name wuerde denselben bereits offenen Tab nur
        // stillschweigend im Hintergrund weiterleiten (Standardverhalten
        // benannter window.open-Ziele) -- so oeffnet jeder Klick zuverlaessig
        // einen neuen Tab, ohne den Charge2Camp-Tab zu verlassen.
        window.open(href, `charge2camp-navigation-${Date.now()}`, "noopener,noreferrer")
      }
      className={className}
    >
      {children}
    </button>
  );
}
