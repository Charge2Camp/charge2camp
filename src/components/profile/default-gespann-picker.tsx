"use client";

import { useState, useTransition } from "react";
import { setDefaultGespann } from "@/app/profil/actions";
import { GespannPanel } from "@/components/gespann-panel";
import type { Caravan, Vehicle } from "@/types/database";

/** Box "Mein Gespann" oben auf profil/gespann (Nutzerwunsch: identisch zur
 * Box im Routenplaner uebernommen) -- Auswahl hier speichert das
 * persistente Standard-Gespann direkt bei jeder Aenderung (kein
 * Speichern-Button), das der Routenplaner dann vorbelegt. */
export function DefaultGespannPicker({
  vehicles,
  caravans,
  initialVehicleId,
  initialCaravanId,
}: {
  vehicles: Vehicle[];
  caravans: Caravan[];
  initialVehicleId: string;
  initialCaravanId: string;
}) {
  const [vehicleId, setVehicleId] = useState(initialVehicleId);
  const [caravanId, setCaravanId] = useState(initialCaravanId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(nextVehicleId: string, nextCaravanId: string) {
    startTransition(async () => {
      try {
        await setDefaultGespann(nextVehicleId, nextCaravanId);
        setError(null);
      } catch {
        setError("Standard-Gespann konnte nicht gespeichert werden.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-lg font-semibold text-base-deep dark:text-white">Mein Gespann</p>
      <GespannPanel
        vehicles={vehicles}
        caravans={caravans}
        vehicleId={vehicleId}
        caravanId={caravanId}
        onVehicleChange={(id) => {
          setVehicleId(id);
          save(id, caravanId);
        }}
        onCaravanChange={(id) => {
          setCaravanId(id);
          save(vehicleId, id);
        }}
      />
      <p className="text-xs text-black/50 dark:text-white/50" aria-live="polite">
        {error ?? (isPending ? "Wird gespeichert…" : "Wird als Standard für den Routenplaner übernommen.")}
      </p>
    </div>
  );
}
