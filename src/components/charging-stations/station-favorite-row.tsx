import { ChargingStationFavoriteButton } from "@/components/charging-stations/favorite-button";
import { PERSONAL_COMPATIBILITY_LABELS, type PersonalCompatibility } from "@/lib/scoring/trailer-compatibility";
import type { ChargingStationView } from "@/lib/charging-stations";

/** Herz-Button + persoenliche Gespann-Einschaetzung direkt neben dem Namen
 * -- nur fuer angemeldete Nutzer (Aufrufer gated mit isLoggedIn). Gemeinsam
 * genutzt von Detailseite und Bottom-Sheet, siehe station-technical-details.tsx. */
export function StationFavoriteRow({
  station,
  isFavorite,
  personalCompatibility,
}: {
  station: ChargingStationView;
  isFavorite: boolean;
  personalCompatibility: PersonalCompatibility;
}) {
  return (
    <div className="mt-4 flex items-center gap-2">
      <ChargingStationFavoriteButton stationId={station.id} initialIsFavorite={isFavorite} />
      <span className="rounded-lg border border-route/30 bg-route/5 p-3 text-sm font-medium text-route">
        {PERSONAL_COMPATIBILITY_LABELS[personalCompatibility]}
      </span>
    </div>
  );
}
