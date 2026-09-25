import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-guard";
import { fetchChargingStationDetailExtras } from "@/lib/charging-station-detail";

/**
 * Liefert die Zusatzdaten eines Ladepunkts (Bewertungen, Favorit/Blockiert-
 * Status, Gespann-Kompatibilitaet, "In der Naehe") fuer das Bottom-Sheet auf
 * der Ladepunkte-Karte (siehe station-bottom-sheet.tsx) -- NICHT Station/
 * Connectoren/Anhaengertauglichkeit selbst, die hat der Client beim
 * Antippen des Kartenmarkers bereits (ChargingStationView). `lat`/`lon` als
 * Query-Parameter aus genau diesem bereits geladenen Kartenmarker, damit
 * fetchChargingStationDetailExtras (fuer "In der Naehe") nicht extra die
 * Koordinaten aus der DB nachladen muss. Kein 404-Fall noetig: eine
 * unbekannte ID liefert schlicht leere Bewertungen/keinen Favoriten statt
 * eines Fehlers, das Sheet zeigt in dem Fall einfach keine Zusatzdaten an.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Sicherheits-Audit: Login + Rate-Limit Pflicht.
  const guard = await requireApiUser("charge-points-detail", { windowSeconds: 60, maxRequests: 120 });
  if ("response" in guard) return guard.response;

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lon = Number(request.nextUrl.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return NextResponse.json({ error: "lat/lon fehlen oder sind ungültig." }, { status: 400 });
  }

  try {
    const extras = await fetchChargingStationDetailExtras(id, guard.user.id, { latitude: lat, longitude: lon });
    return NextResponse.json(extras);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unbekannter Fehler." }, { status: 500 });
  }
}
