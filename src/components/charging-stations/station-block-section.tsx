import Link from "next/link";
import { ChargingStationBlockButton } from "@/components/charging-stations/block-button";

/** "Nie wieder vorschlagen"-Abschnitt am Ende der Ladepunkt-Details -- nur
 * fuer angemeldete Nutzer (Aufrufer gated mit isLoggedIn). Gemeinsam
 * genutzt von Detailseite und Bottom-Sheet. */
export function StationBlockSection({ stationId, isBlocked }: { stationId: string; isBlocked: boolean }) {
  return (
    <section className="mt-8 border-t border-black/10 pt-6 dark:border-white/10">
      <h2 className="font-semibold">Routenplanung</h2>
      <p className="mt-1 text-sm text-text-muted">
        Soll dieser Ladepunkt nie mehr als Ladestopp vorgeschlagen werden -- z. B. weil er
        unzuverlässig oder für dein Gespann ungeeignet ist? Blockierte Ladepunkte bleiben
        normal auffindbar, werden aber bei der Routenplanung übersprungen. Verwaltung aller
        blockierten Ladepunkte unter{" "}
        <Link href="/profil/einstellungen" className="text-route hover:underline">
          Profil → Einstellungen
        </Link>
        .
      </p>
      <div className="mt-3">
        <ChargingStationBlockButton stationId={stationId} initialIsBlocked={isBlocked} />
      </div>
    </section>
  );
}
