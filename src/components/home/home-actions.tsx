"use client";

import { useState } from "react";
import Link from "next/link";
import { NearbyChargingModal } from "@/components/home/nearby-charging-modal";

/** Startseiten-CTAs (Nutzerwunsch): oben nebeneinander "Ladesäule in der
 * Nähe suchen" (öffnet nearby-charging-modal.tsx) und "Campingplatz
 * finden", darunter deutlich auffälliger "Route planen" als eigentliches
 * Hauptziel der App (Gespann-Routenplanung). */
export function HomeActions() {
  const [nearbyOpen, setNearbyOpen] = useState(false);

  return (
    <div className="flex w-full flex-col items-center gap-3 pt-2">
      <div className="flex w-full flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => setNearbyOpen(true)}
          className="min-h-12 rounded-md border border-black/10 px-5 py-3 font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Ladesäule in der Nähe suchen
        </button>
        <Link
          href="/campingplaetze"
          className="flex min-h-12 items-center rounded-md border border-black/10 px-5 py-3 font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          Campingplatz finden
        </Link>
      </div>

      <Link
        href="/routenplaner"
        className="flex min-h-14 w-full max-w-sm items-center justify-center rounded-md bg-action px-6 py-4 text-lg font-semibold text-base shadow-md hover:bg-action-hover"
      >
        Route planen
      </Link>

      <NearbyChargingModal open={nearbyOpen} onClose={() => setNearbyOpen(false)} />
    </div>
  );
}
