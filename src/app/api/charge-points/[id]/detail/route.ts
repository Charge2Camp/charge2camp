import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchChargingStationDetailExtras } from "@/lib/charging-station-detail";

/**
 * Liefert die Zusatzdaten eines Ladepunkts (Bewertungen, Favorit/Blockiert-
 * Status, Gespann-Kompatibilitaet) fuer das Bottom-Sheet auf der Ladepunkte-
 * Karte (siehe station-bottom-sheet.tsx) -- NICHT Station/Connectoren/
 * Anhaengertauglichkeit selbst, die hat der Client beim Antippen des
 * Kartenmarkers bereits (ChargingStationView). Kein 404-Fall noetig: eine
 * unbekannte ID liefert schlicht leere Bewertungen/keinen Favoriten statt
 * eines Fehlers, das Sheet zeigt in dem Fall einfach keine Zusatzdaten an.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const extras = await fetchChargingStationDetailExtras(id, user?.id);
    return NextResponse.json(extras);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unbekannter Fehler." }, { status: 500 });
  }
}
