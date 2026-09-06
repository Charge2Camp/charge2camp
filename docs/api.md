# API- und Adapter-Struktur

## Status

Seit Phase 6 sind mehrere Provider-Adapter aktiv: `RoutingProvider` (OSRM,
[src/lib/providers/routing/osrm.ts](../src/lib/providers/routing/osrm.ts)),
ein Geocoding-Adapter (Nominatim,
[src/lib/providers/geocoding/nominatim.ts](../src/lib/providers/geocoding/nominatim.ts),
noch ohne eigenes generisches Interface, da bislang nur ein Anbieter) sowie
`NavigationProvider` (Google Maps,
[src/lib/providers/navigation/](../src/lib/providers/navigation/)) für
"Navigation starten" im Routenplaner — baut nur eine Deep-Link-URL, öffnet
sie bewusst nicht selbst, damit dieselbe Logik später in der nativen App
wiederverwendet werden kann. Apple Karten/Waze folgen als weitere Adapter
in derselben Registry (`NAVIGATION_PROVIDERS`), sobald benötigt. Seit Phase
7 prüft `RoadRestrictionProvider` (Overpass API,
[src/lib/providers/road-restrictions/](../src/lib/providers/road-restrictions/))
die Streckengeometrie auf bekannte Höhen-/Breiten-/Gewichtsbeschränkungen
(Warnung, keine automatische Umfahrung — siehe
[architecture.md](architecture.md), Abschnitt "Gespannlogik &
Straßenrestriktionen").
`ChargingProvider`/`TrafficProvider` folgen mit Phase 8 (Live-Daten).

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

## Such-/Filter-API (Auftrag D/E)

Route Handlers unter `src/app/api/` (statt FastAPI wie im Auftragsdokument
angenommen — Next.js Route Handlers, per Projektentscheidung), gegen den
echten Datenlayer (`raw`/`core`/`enrich`, siehe [database.md](database.md)):

- `GET /api/campsites/search` — liest den Meilisearch-Index `campsites`
  (Auftrag E, `ingest/index_meilisearch.py`), liefert gefilterte Treffer
  **mit** Facetten-Trefferzählern (`amenities`, `charging`), ohne teure
  eigene `COUNT`-Abfragen. Adapter: `src/lib/search/meilisearch.ts`.
- `GET /api/campsites/{external_key}` — volles Objekt inkl. verknüpfter
  Ladepunkte mit Anschlüssen, direkt aus Postgres/PostgREST.
- `GET /api/charge-points/search` — analog, aber noch ohne eigenen
  Suchindex (Auftrag E deckt nur Campingplätze ab), deshalb direkt gegen
  `core.charge_point_geo` mit serverseitiger Umkreis-/Boundingbox-
  Vorfilterung und Nachfilterung in JS für Connector/Anhängertauglichkeit.

Bekannte, bewusste Lücken (siehe Code-Kommentare in den jeweiligen
`route.ts`): `connector`-Filter auf Campingplatz-Ebene nicht unterstützt
(der Suchindex kennt nur aggregierte Ladeinfos, keine Steckertypen einzelner
Ladepunkte); `trailer=yes_or_unhitch` nicht unterstützt (nur `yes`, da
`core.campsite_search` nur die Distanz zum nächsten `yes`-Ladepunkt
vorberechnet). Beide geben einen klaren 400-Fehler statt still falsche
Ergebnisse zu liefern.

Die Anreicherungs-Endpunkte (`POST /api/enrich/...`, Community-Meldungen zur
Anhängertauglichkeit / Website-Recherche) sind noch nicht umgesetzt.

## Konventionen

- Keine API-Keys im Code, ausschließlich über Environment Variables.
- Jede neue externe Quelle wird in [data-sources.md](data-sources.md)
  dokumentiert, bevor sie produktiv verwendet wird.
