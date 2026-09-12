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
  // Siehe Kommentar in vehicle-list.tsx: sichtbarer Bestand wird aus dem
  // `stations`-Prop abgeleitet (minus gerade freigegebener IDs), kein
  // separater useState-Zwischenspeicher.
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  const items = stations.filter((s) => !removedIds.has(s.id));

  function handleUnblock(id: string) {
    setPendingId(id);
    setErrorById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    startTransition(async () => {
      const result = await toggleChargingStationBlocked(id, false);
      if (result.ok) {
        setRemovedIds((prev) => new Set(prev).add(id));
      } else {
        setErrorById((prev) => ({ ...prev, [id]: result.error }));
      }
      setPendingId(null);
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
          className="flex flex-col gap-1 rounded-md border border-black/10 px-4 py-3 text-sm dark:border-white/10"
        >
          <div className="flex items-center justify-between gap-4">
            <Link href={`/ladepunkte/${station.id}`} className="flex min-h-11 items-center hover:underline">
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
          </div>
          {errorById[station.id] && <p className="text-xs text-red-600">{errorById[station.id]}</p>}
        </li>
      ))}
    </ul>
  );
}
