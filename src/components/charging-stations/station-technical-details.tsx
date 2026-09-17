import Link from "next/link";
import { PhotoLinkButton } from "@/components/charging-stations/photo-link-button";
import { buildGoogleMapsPhotoLink } from "@/lib/google-maps-link";
import { groupConnectorsForDisplay } from "@/lib/connector-standard";
import { formatAccessType } from "@/lib/access-type";
import type { ChargingStationView } from "@/lib/charging-stations";

/** Technische Daten + Aktions-Buttons eines Ladepunkts -- arbeitet bewusst
 * NUR mit Daten, die schon im Kartenmarker stecken (ChargingStationView),
 * ohne Nachladen. Gemeinsam genutzt von der Detailseite
 * (ladepunkte/[id]/page.tsx) und dem Bottom-Sheet der Kartenansicht
 * (station-bottom-sheet.tsx), deshalb ohne "use client" -- funktioniert
 * serverseitig gerendert genauso wie client-seitig eingehaengt. */
export function StationTechnicalDetails({ station }: { station: ChargingStationView }) {
  const photoLink = buildGoogleMapsPhotoLink({
    name: station.name,
    address: station.address,
    postcode: station.postcode,
    city: station.city,
    lat: station.lat,
    lon: station.lon,
  });

  return (
    <section>
      <h2 className="font-semibold">Technische Daten</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {station.max_power_kw && <li>Max. Ladeleistung: {station.max_power_kw} kW</li>}
        {station.connectors.length > 0 && (
          <li>
            Anschlüsse:{" "}
            {groupConnectorsForDisplay(station.connectors)
              .map((c) => `${c.quantity}× ${c.label}${c.powerKw ? ` (${c.powerKw} kW)` : ""}`)
              .join(", ")}
          </li>
        )}
        {station.access_type && <li>Zugang: {formatAccessType(station.access_type)}</li>}
        {station.address && <li>Adresse: {station.address}</li>}
      </ul>
      <div className="mt-4 flex flex-wrap items-start gap-2">
        <Link
          href={`/routenplaner?destination_station_id=${station.id}`}
          className="inline-flex min-h-11 items-center rounded-md bg-action px-4 py-2 text-sm font-medium text-base hover:bg-action-hover"
        >
          Route hierher planen
        </Link>
        <PhotoLinkButton link={photoLink} externalKey={station.external_key} />
      </div>
      {!station.is_operational && (
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
          Laut Quelle aktuell nicht betriebsbereit gemeldet.
        </p>
      )}
    </section>
  );
}
