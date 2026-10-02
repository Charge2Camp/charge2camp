import { NextRequest, NextResponse } from "next/server";
import { fetchChargingStations, parseChargingStationFilters, type MapBounds } from "@/lib/charging-stations";
import { requireApiUser } from "@/lib/api-guard";
import { parseBboxParam } from "@/lib/map-bounds";

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
  // Audit-Befund 2026-09-30: requireApiUser() (Login- + Rate-Limit-Check,
  // inkl. eines eigenen DB-RPC-Aufrufs) lag bisher AUSSERHALB des unten
  // stehenden try/catch -- ein dort unerwartet geworfener Fehler (z. B. eine
  // kurze DB-Stoerung beim check_rate_limit()-Aufruf) fiel dadurch nicht auf
  // die eigene, informative JSON-Fehlerantwort zurueck, sondern auf Next.js'
  // generische 500-Antwort OHNE Fehlermeldung -- fuer den Karten-Client
  // (charging-station-map-explorer.tsx) nicht von einem echten Datenfehler
  // unterscheidbar, und ohne jede Diagnose-Information in den Vercel-
  // Funktionslogs. Der try-Block umschliesst deshalb jetzt die GESAMTE
  // Anfrageverarbeitung, nicht nur den fetchChargingStations-Aufruf.
  try {
    // Sicherheits-Audit: Login + Rate-Limit Pflicht. Limit grosszuegiger als bei den
    // anderen Endpunkten (120/min statt 60/min im Dauerbetrieb): der Karten-Client ruft
    // nur bei Bewegung ausserhalb des vorgeladenen Bereichs ab (debounced, siehe
    // VIEWPORT_FETCH_DEBOUNCE_MS in charging-station-map-explorer.tsx) -- im Browser
    // gemessen loesten 20 abwechselnde Zoomschritte in ~10 s keinen einzigen Request aus.
    // Das Fenster ist FEST: wer das Limit ueberschreitet, ist bis zum Fensterende
    // gesperrt. 40 Aufrufe je 20 s entsprechen weiter 120/min im Dauerbetrieb, begrenzen
    // die Sperre aber auf hoechstens 20 s statt bis zu 60 s. Bei 429 wiederholt der
    // Karten-Client mit Wartezeit (viewport-retry.ts) und zeigt "zu viele Anfragen".
    const guard = await requireApiUser("charge-points-viewport", { windowSeconds: 20, maxRequests: 40 });
    if ("response" in guard) return guard.response;

    const sp = request.nextUrl.searchParams;

    const bboxRaw = sp.get("bbox");
    if (!bboxRaw) return NextResponse.json({ error: "bbox fehlt." }, { status: 400 });
    // Gueltige Zahlen, west <= east, south <= north; Werte ausserhalb von +-180/+-90
    // werden begrenzt statt abgelehnt (siehe parseBboxParam).
    const bbox: MapBounds | null = parseBboxParam(bboxRaw);
    if (!bbox) {
      return NextResponse.json(
        { error: "bbox muss 'west,south,east,north' sein (endliche Zahlen, west <= east, south <= north)." },
        { status: 400 }
      );
    }

    // Mehrere gleichnamige Parameter (z. B. operator=A&operator=B fuer den
    // Ladeanbieter-Filter) muessen als Array ankommen -- ein simples
    // Ueberschreiben pro Key wuerde alle bis auf den letzten Wert verwerfen.
    const searchParamsObject: Record<string, string | string[]> = {};
    for (const [key, value] of sp.entries()) {
      const existing = searchParamsObject[key];
      if (existing === undefined) searchParamsObject[key] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else searchParamsObject[key] = [existing, value];
    }
    const filters = parseChargingStationFilters(searchParamsObject);

    // Audit-Befund 2026-09-30 (Nutzermeldung, Server-Log: "canceling
    // statement due to statement timeout"): core.charge_points_in_bbox()
    // mit einem weit herausgezoomten Ausschnitt (z. B. Deutschland-weit)
    // OHNE Anhaengertauglichkeits-Filter (das UI erlaubt, beide
    // Default-Chips -- "yes"/"unhitch" -- abzuwaehlen, siehe
    // DEFAULT_TRAILER_VERDICTS) braucht bei `p_limit=5000` gemessen ~5,4s
    // (EXPLAIN ANALYZE direkt gegen Produktion) -- bei `p_limit=1500` nur
    // noch ~60-280ms. 5000 war ohnehin nur durch Supabases projektweites
    // PostgREST-max_rows-Limit motiviert (siehe Kommentar unten), nicht
    // durch einen tatsaechlichen Darstellungsbedarf -- 1500 Marker sind fuer
    // eine live interaktive Karte bereits sehr viel, die "5000+"-Kappungs-
    // UI (stationCountLabel in charging-station-map-explorer.tsx) zeigt bei
    // Ueberschreiten weiterhin korrekt an, dass nicht ALLE Treffer geladen
    // wurden (jetzt ab 1500 statt 5000).
    const VIEWPORT_LIMIT = 1500;
    // Supabase begrenzt jede PostgREST-Antwort projektweit zusaetzlich hart
    // auf max_rows = 50000 (supabase/config.toml; fuer dieses Limit ohne
    // Belang, da VIEWPORT_LIMIT deutlich darunter liegt) -- bei einem stark
    // herausgezoomten Kartenausschnitt (z. B. "ganz Italien") kann die
    // tatsaechliche Treffermenge trotz Geo-Filterung trotzdem ueber
    // VIEWPORT_LIMIT liegen (insgesamt ca. 18.900+ Ladepunkte) -- der Client
    // zeigt dann bewusst "1500+" statt eine vermeintlich vollstaendige Liste
    // vorzutaeuschen. Bei einem realistisch gezoomten Ausschnitt (z. B. eine
    // Region) bleibt die Treffermenge weit darunter -- dort ist die Kappung
    // ohne Belang und alle Ladepunkte im Ausschnitt erscheinen vollstaendig.
    const stations = await fetchChargingStations(filters, VIEWPORT_LIMIT, bbox);
    return NextResponse.json({ stations, truncated: stations.length >= VIEWPORT_LIMIT });
  } catch (err) {
    // Landet in den Vercel-Funktionslogs (Runtime Logs) -- ohne dieses Log
    // war ein hier geworfener Fehler bisher nur am Client als nackter 500
    // sichtbar, nirgends serverseitig nachvollziehbar (Audit-Befund
    // 2026-09-30, Nutzermeldung "etwas ist schiefgelaufen" auf /ladepunkte).
    console.error("[charge-points/viewport]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unbekannter Fehler." }, { status: 500 });
  }
}
