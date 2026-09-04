# API- und Adapter-Struktur

## Status

Phase 1 stellt Auth (Supabase Auth, direkt über den Browser-/Server-Client)
und das Datenbankschema bereit. Es gibt noch keine eigenen REST/RPC-Routen
und noch keine Provider-Adapter-Implementierung — beides folgt mit den
Phasen, die die jeweiligen Daten benötigen (Campingplätze: Phase 3,
Ladepunkte: Phase 4, Routing: Phase 6, Live-Daten: Phase 8).

Dieses Dokument beschreibt die geplante Struktur, damit spätere Phasen
konsistent darauf aufbauen.

## Supabase-Zugriff

- `src/lib/supabase/client.ts` — Browser-Client (Client Components)
- `src/lib/supabase/server.ts` — Server-Client (Server Components, Route
  Handlers, Server Actions), liest/schreibt Auth-Cookies
- `src/lib/supabase/middleware.ts` — refresht die Session bei jedem Request

Direkter Datenbankzugriff mit RLS ist für Nutzer-eigene Daten (Fahrzeuge,
Wohnwagen, Favoriten, eigene Bewertungen) ausreichend und bevorzugt —
kein zusätzlicher API-Layer nötig, solange RLS die Regeln durchsetzt.

Schreibender Zugriff auf `campsites`/`charging_stations` (Admin, Import)
läuft über den `service_role`-Key ausschließlich in Server-seitigem Code
(nie im Client-Bundle).

## Geplante Provider-Interfaces (`src/lib/providers/`)

```ts
interface ChargingProvider {
  id: string; // z.B. "eco-movement", "open-charge-map", "mock"
  fetchStations(bbox: BoundingBox): Promise<ChargingStation[]>;
  fetchLiveStatus(stationId: string): Promise<LiveStatus | null>;
}

interface RoutingProvider {
  id: string; // z.B. "graphhopper", "valhalla", "osrm", "mock"
  planRoute(request: RouteRequest): Promise<RouteResult>;
}

interface TrafficProvider {
  id: string; // z.B. "here", "tomtom", "mock"
  fetchIncidents(bbox: BoundingBox): Promise<TrafficIncident[]>;
}
```

Jeder Adapter wird gegen sein Interface getestet, sodass Provider ohne
Änderungen an der aufrufenden Domain-Logik ausgetauscht werden können.
Solange kein echter Provider konfiguriert ist (siehe `.env.example`), liefert
der `mock`-Adapter klar als Demo gekennzeichnete Daten — niemals Fake-Daten,
die wie echte Live-Daten aussehen (§39).

## Konventionen

- Keine API-Keys im Code, ausschließlich über Environment Variables.
- Jede neue externe Quelle wird in [data-sources.md](data-sources.md)
  dokumentiert, bevor sie produktiv verwendet wird.
