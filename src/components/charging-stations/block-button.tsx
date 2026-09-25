"use client";

import { useState, useTransition } from "react";
import { toggleChargingStationBlocked } from "@/app/ladepunkte/[id]/actions";

/** Button zum dauerhaften Blockieren/Entblockieren eines Ladepunkts fuer die
 * Routenplanung (Nutzerwunsch: "eine Art Blacklist") -- analog zu
 * ChargingStationFavoriteButton, aber mit eigener, klar abweichender
 * Farbgebung (Rot statt Herz-Rot/Grau), damit die gegensaetzliche Bedeutung
 * (nie wieder vorschlagen vs. merken) auf den ersten Blick erkennbar ist. */
export function ChargingStationBlockButton({
  stationId,
  initialIsBlocked,
}: {
  stationId: string;
  initialIsBlocked: boolean;
}) {
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !isBlocked;
    setIsBlocked(next);
    startTransition(async () => {
      const result = await toggleChargingStationBlocked(stationId, next);
      if (!result.ok) setIsBlocked(!next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={
        isBlocked
          ? "Wieder für die Routenplanung berücksichtigen"
          : "Diesen Ladepunkt zukünftig nicht mehr für die Routenplanung berücksichtigen"
      }
      aria-pressed={isBlocked}
      className={`flex min-h-11 items-center gap-1.5 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
        isBlocked
          ? "border-red-600 bg-red-600/10 text-error"
          : "border-black/15 text-black/60 dark:border-white/15 dark:text-white/60"
      }`}
    >
      <span aria-hidden="true">🚫</span>
      {isBlocked ? "Wird zukünftig nicht berücksichtigt -- wieder aufnehmen" : "Zukünftig nicht berücksichtigen"}
    </button>
  );
}
