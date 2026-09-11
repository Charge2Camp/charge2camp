"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleChargingStationBlocked } from "@/app/ladepunkte/[id]/actions";

export interface BlockedStationOption {
  id: string;
  name: string | null;
  operator: string | null;
}

/** Liste der vom Nutzer blockierten Ladepunkte (Profil → Einstellungen,
 * Nutzerwunsch) mit "Wieder freigeben"-Option je Zeile -- ruft dieselbe
 * Server Action wie der Block-Button auf der Ladepunkt-Detailseite auf. */
export function BlockedStationsList({ stations }: { stations: BlockedStationOption[] }) {
  const [items, setItems] = useState(stations);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleUnblock(id: string) {
    setPendingId(id);
    startTransition(async () => {
      try {
        await toggleChargingStationBlocked(id, false);
        setItems((prev) => prev.filter((s) => s.id !== id));
      } finally {
        setPendingId(null);
      }
    });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-black/50 dark:text-white/50">
        Keine Ladepunkte blockiert.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((station) => (
        <li
          key={station.id}
          className="flex items-center justify-between gap-4 rounded-md border border-black/10 px-4 py-3 text-sm dark:border-white/10"
        >
          <Link href={`/ladepunkte/${station.id}`} className="hover:underline">
            {station.name ?? station.operator ?? "Ladepunkt"}
          </Link>
          <button
            type="button"
            onClick={() => handleUnblock(station.id)}
            disabled={pendingId === station.id}
            className="flex min-h-11 items-center px-2 -mx-2 text-route hover:underline disabled:opacity-50"
          >
            Wieder freigeben
          </button>
        </li>
      ))}
    </ul>
  );
}
