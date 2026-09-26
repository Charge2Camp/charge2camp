"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleChargingStationBlocked } from "@/app/ladepunkte/[id]/actions";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";

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
      <p className="text-sm text-text-muted">
        Keine Ladepunkte blockiert.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((station) => (
        <li
          key={station.id}
          className="flex flex-col gap-1 rounded-md border border-line px-4 py-3 text-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <Link href={`/ladepunkte/${station.id}`} className="flex min-h-11 items-center hover:underline">
              {station.name ?? station.operator ?? "Ladepunkt"}
            </Link>
            <Button
              variant="plain"
              size="link"
              onClick={() => handleUnblock(station.id)}
              disabled={pendingId === station.id}
              className="text-route"
            >
              Wieder freigeben
            </Button>
          </div>
          {errorById[station.id] && <FormError className="text-xs">{errorById[station.id]}</FormError>}
        </li>
      ))}
    </ul>
  );
}
