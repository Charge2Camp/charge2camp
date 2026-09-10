"use client";

import { IconAuto, IconAnhaenger } from "@/components/icons/brand-icons";
import type { Caravan, Vehicle } from "@/types/database";

/** Wiederverwendete "Mein Gespann"-Box (Nutzerwunsch): Auto- und
 * Anhaenger-Icon nebeneinander symbolisieren das Gespann, darunter die
 * Elektroauto-/Wohnwagen-Auswahl nebeneinander -- bewusst auch auf
 * schmalen Bildschirmen nebeneinander statt gestapelt, auch wenn der
 * Wohnwagen-Name dadurch abgeschnitten werden kann. Identischer Aufbau an
 * zwei Stellen: im Routenplaner (Tab 1, Auswahl steuert direkt die
 * Routenplanung) und oben auf profil/gespann (Auswahl setzt das
 * persistente Standard-Gespann, siehe profil/actions.ts setDefaultGespann).
 * Getoente Flaeche (--c-tint-trailer, siehe brand-guide.md Abschnitt 3
 * "Hinweisflaechen zu Gespann-Themen") hebt den Block optisch ab. Die
 * Ueberschrift "Mein Gespann" liegt bewusst AUSSERHALB dieser Box (siehe
 * Aufrufer) -- je nach Seite in unterschiedlicher Schriftart (Feld-Titel
 * im Routenplaner vs. Section-Ueberschrift auf profil/gespann). */
export function GespannPanel({
  vehicles,
  caravans,
  vehicleId,
  caravanId,
  onVehicleChange,
  onCaravanChange,
  vehicleRequired = false,
}: {
  vehicles: Vehicle[];
  caravans: Caravan[];
  vehicleId: string;
  caravanId: string;
  onVehicleChange: (id: string) => void;
  onCaravanChange: (id: string) => void;
  vehicleRequired?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-tint-trailer/50 p-4 dark:bg-tint-trailer/10">
      <div className="flex items-center justify-center gap-5">
        <IconAuto className="h-14 w-14 text-base-deep dark:text-white" />
        <span className="text-2xl text-black/30 dark:text-white/30" aria-hidden>
          +
        </span>
        <IconAnhaenger className="h-14 w-14 text-base-deep dark:text-white" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm">
          Elektroauto{vehicleRequired ? " *" : ""}
          <select
            name="vehicle_id"
            required={vehicleRequired}
            value={vehicleId}
            onChange={(e) => onVehicleChange(e.target.value)}
            className="w-full min-w-0 rounded-md border border-black/15 bg-card px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Bitte wählen…</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.manufacturer} {v.model}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-col gap-1 text-sm">
          Wohnwagen (optional)
          <select
            name="caravan_id"
            value={caravanId}
            onChange={(e) => onCaravanChange(e.target.value)}
            className="w-full min-w-0 rounded-md border border-black/15 bg-card px-3 py-2 text-base dark:border-white/15 dark:bg-transparent"
          >
            <option value="">Kein Wohnwagen</option>
            {caravans.map((c) => (
              <option key={c.id} value={c.id}>
                {c.manufacturer} {c.model}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
