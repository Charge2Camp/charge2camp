import { NextRequest, NextResponse } from "next/server";
import { fetchCampsiteDestinationByName, suggestCampsites } from "@/lib/campsites";
import { requireApiUser } from "@/lib/api-guard";

/**
 * Internes Endpoint fuer die Campingplatz-Namensvorschlaege (Filter-Suche
 * /campingplaetze, Ziel-Feld im Routenplaner) -- ersetzt die frueher
 * vorgeladenen Namenslisten (siehe suggestCampsites in campsites.ts).
 *   ?q=<text>     Vorschlaege (Name enthaelt q, mind. 3 Zeichen, max. 8)
 *   ?name=<text>  genau dieser Campingplatz (gespeicherte Route wiederherstellen)
 * Antwort in beiden Faellen: { campsites: [{ id, name, latitude, longitude }] }.
 */
export async function GET(request: NextRequest) {
  try {
    // Login + Rate-Limit wie die uebrigen internen Endpunkte; die Seiten, die
    // dies aufrufen, sind ohnehin login-pflichtig (proxy.ts). 120/min, da die
    // Aufrufer waehrend des Tippens debounced anfragen (NameSuggestField 300 ms,
    // AddressAutocomplete 350 ms).
    const guard = await requireApiUser("campsites-suggest", { windowSeconds: 60, maxRequests: 120 });
    if ("response" in guard) return guard.response;

    const sp = request.nextUrl.searchParams;
    const name = sp.get("name");
    if (name !== null) {
      const match = name.trim() ? await fetchCampsiteDestinationByName(name.trim()) : null;
      return NextResponse.json({ campsites: match ? [match] : [] });
    }

    const q = sp.get("q") ?? "";
    // Obergrenze verhindert absichtlich uebergrosse Muster (Trigram-Suche).
    const campsites = await suggestCampsites(q.slice(0, 100));
    return NextResponse.json({ campsites });
  } catch (err) {
    console.error("[campsites/suggest]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unbekannter Fehler." }, { status: 500 });
  }
}
