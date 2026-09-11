import { NextRequest, NextResponse } from "next/server";
import { fetchChargingStations, parseChargingStationFilters, type MapBounds } from "@/lib/charging-stations";

/**
 * Internes Endpoint fuer die kartenausschnitt-basierte Ladepunkte-Suche
 * (siehe charging-station-map-explorer.tsx) -- nicht zu verwechseln mit dem
 * dokumentierten oeffentlichen /api/charge-points/search (Auftrag D, eigener
 * Response-Vertrag fuer externe Konsumenten). Nutzt dieselbe Filterlogik wie
 * die serverseitig gerenderte Erstansicht (fetchChargingStations,
 * parseChargingStationFilters), damit Karte/Liste beim Schwenken exakt
 * dieselben Ergebnisse liefern wie ein initialer Seitenaufruf mit denselben
 * Filtern -- vorher schnitt die Erstansicht ungefiltert bei den ersten 1500
 * (alphabetisch nach Name) ab, wodurch z. B. "SHELL FAST BRENNERSTRASSE
 * 245" beim reinen Kartenbrowsen nie auftauchte (Nutzerfeedback).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const bboxRaw = sp.get("bbox");
  if (!bboxRaw) return NextResponse.json({ error: "bbox fehlt." }, { status: 400 });
  const parts = bboxRaw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "bbox muss 'west,south,east,north' sein." }, { status: 400 });
  }
  const [west, south, east, north] = parts;
  const bbox: MapBounds = { west, south, east, north };

  const searchParamsObject: Record<string, string> = {};
  for (const [key, value] of sp.entries()) searchParamsObject[key] = value;
  const filters = parseChargingStationFilters(searchParamsObject);

  try {
    // Supabase begrenzt jede PostgREST-Antwort projektweit hart auf
    // max_rows = 5000 (supabase/config.toml) -- ein hoeheres `limit` hier
    // haette also keine Wirkung, die Datenbank kappt ohnehin. Bei einem
    // stark herausgezoomten Kartenausschnitt (z. B. "ganz Italien") kann
    // die tatsaechliche Treffermenge trotz Geo-Filterung ueber 5000 liegen
    // (insgesamt ca. 18.900 Ladepunkte) -- fuer den in diesem Fall
    // gekappten Fall zeigt der Client dann bewusst "5000+" statt eine
    // vermeintlich vollstaendige Liste vorzutaeuschen (siehe
    // charging-station-map-explorer.tsx stationCountLabel). Bei einem
    // realistisch gezoomten Ausschnitt (z. B. eine Region wie in der
    // Nutzermeldung) bleibt die Treffermenge weit darunter -- dort ist
    // die Kappung ohne Belang und alle Ladepunkte im Ausschnitt erscheinen
    // vollstaendig, unabhaengig vom Namen.
    const stations = await fetchChargingStations(filters, 5000, bbox);
    return NextResponse.json({ stations, truncated: stations.length >= 5000 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unbekannter Fehler." }, { status: 500 });
  }
}
