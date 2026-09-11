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
      try {
        await toggleChargingStationBlocked(stationId, next);
      } catch {
        setIsBlocked(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={
        isBlocked
          ? "Blockierung aufheben -- wieder für die Routenplanung berücksichtigen"
          : "Diesen Ladepunkt blockieren -- nie wieder für die Routenplanung vorschlagen"
      }
      aria-pressed={isBlocked}
      className={`flex h-11 items-center gap-1.5 rounded-md border px-3 text-sm font-medium disabled:opacity-50 ${
        isBlocked
          ? "border-red-600 bg-red-600/10 text-red-600"
          : "border-black/15 text-black/40 dark:border-white/15 dark:text-white/40"
      }`}
    >
      <span aria-hidden="true">🚫</span>
      {isBlocked ? "Blockiert" : "Blockieren"}
    </button>
  );
}
