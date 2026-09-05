# Architektur

## Ziel

eCamper ist eine Plattform für Reisende mit Elektroauto + Wohnwagen/Caravan.
Sie verbindet vier Dinge, die bisher nur getrennt existieren:
Elektroauto, Wohnwagen, Campingplatz, Ladeinfrastruktur, Gespann-Routing.

Zentraler USP:

> eCamper plant Reisen für das tatsächliche Gespann — nicht nur für das
> Elektroauto.

## MVP-Prinzip

Kein vollständiges kommerzielles Produkt. Ein realistisch nutzbarer,
lokal startbarer MVP, der iterativ in Phasen wächst und dessen Architektur
später zu einer vollen Webplattform + mobiler App ausgebaut werden kann.

## Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript | Server-/Client-Components, gute Basis für spätere API-Trennung |
| UI | Tailwind CSS | schnell, konsistent, mobile-first |
| Backend/DB | Supabase (PostgreSQL) | Auth + DB + RLS aus einer Hand, lokal via Docker, günstig |
| Auth | Supabase Auth | integriert, kostenlos im Free Tier |
| Karten | OpenStreetMap + MapLibre | offen, kostenlos, keine Vendor-Lock-in |
| Routing | Adapter für GraphHopper/Valhalla/OSRM | austauschbar, siehe unten |
| Deployment | Vercel (oder vergleichbar) | kostengünstig, passt zu Next.js |

## Schichtenmodell

```
UI (Next.js App Router, src/app/**)
   |
Domain-Logik (src/lib/**)  — EV-Score, Routing-Entscheidung, Bewertungsaggregation
   |
Adapter (src/lib/providers/**) — ChargingProvider, RoutingProvider, TrafficProvider
   |
Supabase (Postgres + Auth, src/lib/supabase/**)
```

Die Businesslogik liegt nicht ausschließlich im Frontend, damit eine
spätere native App (iOS/Android) dieselbe Backend-Logik nutzen kann.

## Adapter-Prinzip (§14, §24, §25)

Externe Datenanbieter werden nie direkt fest verdrahtet. Stattdessen:

- `ChargingProvider` — Interface für Ladepunkt-Datenquellen (Eco-Movement,
  Open Charge Map, eigene Daten). Mehrere Quellen sollen später
  zusammengeführt werden können.
- `RoutingProvider` — Interface für Routing-Engines (GraphHopper, Valhalla,
  OSRM oder externe Routing-API im MVP).
- `TrafficProvider` — Interface für Live-Verkehr (HERE, TomTom, …).

Solange kein echter Anbieter angebunden ist, liefert ein Mock-Adapter klar
gekennzeichnete Demo-Daten (siehe Regel "keine Scheindaten", §39).

## EV-Camping-Score (§11)

Regelbasiert, keine KI im MVP. Gewichtung liegt in einer zentralen,
leicht änderbaren Funktion
([src/lib/scoring/ev-camping-score.ts](../src/lib/scoring/ev-camping-score.ts)).
Faktoren: Ladepunkt auf dem Platz, Ladeleistung, Anzahl Ladepunkte,
Entfernung zu Schnellladern (Haversine-Distanz zu `charging_stations` mit
≥100 kW, [src/lib/nearby-charging.ts](../src/lib/nearby-charging.ts)),
Community-Bewertungen, Aktualität der Daten (`last_verified_at`).

## Gespann-Kompatibilität (§19, §20)

Bewertungen von Ladepunkten werden nicht nur als Ja/Nein-Quote aggregiert,
sondern im Kontext der Gespannmaße der bewertenden Nutzer interpretiert
(z. B. "geeignet für normale Gespanne, eingeschränkt für sehr große
Gespanne > 8,5 m"), siehe
[src/lib/scoring/trailer-compatibility.ts](../src/lib/scoring/trailer-compatibility.ts).
Regelbasiert (Schwellwert 8,5 m Gespannlänge, konfigurierbar): Bewertungen
werden nach Gespannlänge in "normal" und "groß" gruppiert; bei ausreichend
Bewertungen in beiden Gruppen mit deutlich unterschiedlicher Zustimmung
entsteht eine differenzierte Aussage statt einer einzelnen Quote. Ist der
Nutzer angemeldet und hat einen Wohnwagen hinterlegt, wird zusätzlich eine
persönliche Einschätzung ("Für dein Gespann: Sehr gut geeignet") angezeigt.

**Gespannlänge aus Profildaten (§18-Erweiterung):** Beim Bewerten eines
Ladepunkts wählt der Nutzer optional sein hinterlegtes Fahrzeug + Wohnwagen
aus dem Profil statt Freitext-Maße einzugeben. Die Gespannlänge wird dann
automatisch als Fahrzeuglänge + Wohnwagenlänge berechnet (dafür trägt
`vehicles` jetzt auch `length_m`). Auf der Ladepunkt-Detailseite zeigt eine
Verteilungsgrafik ("Eignung nach Gespannlänge") den Anteil der Bewertungen
je Längen-Klasse (bis 9 m / 9–11 m / 11–13 m / 13–15 m / über 15 m) sowie
die Eignung (% positiv) innerhalb jeder Klasse — z. B. "33 % der
Bewertungen: 11–13 m, davon 75 % positiv". So wird sichtbar, wie
gespanntauglich ein Ladepunkt über verschiedene Gespanngrößen hinweg
tatsächlich ist, statt nur einer einzelnen Gesamtquote. Klassengrenzen
zentral in `RIG_LENGTH_BUCKETS` (leicht anpassbar, z. B. auf datengetriebene
Quantile später).

## Routenplanung (§21–§27, Phase 6)

`/routenplaner` verbindet Geocoding, Routing und eine erste Ladeplanung:

- **Geocoding**: Nominatim (OpenStreetMap, kostenlos, kein API-Key) —
  [src/lib/providers/geocoding/nominatim.ts](../src/lib/providers/geocoding/nominatim.ts).
- **Routing**: OSRM-Adapter gegen den öffentlichen Demo-Server (kostenlos,
  kein API-Key) —
  [src/lib/providers/routing/osrm.ts](../src/lib/providers/routing/osrm.ts),
  implementiert das in [docs/api.md](api.md) definierte `RoutingProvider`-
  Interface, damit ein Wechsel auf GraphHopper/Valhalla/einen selbst
  gehosteten OSRM-Server nur einen neuen Adapter erfordert.
- **Ladeplanung**: regelbasiert, iterative Mehrstopp-Planung (kein
  globaler Optimierer über alle Stopp-Kombinationen, sondern ein
  Greedy-Verfahren: von der aktuellen Position/Ladestand aus wird jeweils
  der naechste erreichbare, moeglichst anhaengertaugliche Ladepunkt
  gesucht, bis das Ziel direkt erreichbar ist) —
  [src/lib/route-planning.ts](../src/lib/route-planning.ts). Sucht
  anhängertaugliche Ladepunkte im Streckenkorridor (`unsuitable` wird hart
  ausgeschlossen, §26/§27), berechnet je Stopp Energieverbrauch, Ladezeit
  sowie Ankunfts-Ladestand und meldet ehrlich, wenn an keiner Stelle der
  Route mehr ein passender Ladepunkt gefunden wird (max.
  `MAX_CHARGING_STOPS` Stopps als Sicherheitsgrenze), statt eine falsche
  Route vorzutäuschen.

**Routenübersicht mit manueller Kontrolle je Ladestopp:** Ein Popup
([route-overview-dialog.tsx](../src/components/routing/route-overview-dialog.tsx))
zeigt Start (Abfahrts-Ladestand), jeden Ladestopp (Ladeleistung,
allgemeine sowie persönliche Anhängertauglichkeit für das hinterlegte
Gespann nach §20, km/Fahrzeit zum nächsten Punkt) und Ziel
(Ankunfts-Ladestand). An jedem Stopp kann der vorgeschlagene Ladepunkt
gelöscht (nächstbester Kandidat wird automatisch neu gesucht) oder durch
eine von bis zu 5 Alternativen im Streckenkorridor ersetzt werden. Die
Server-Action `replanChargingStop` berechnet dafür nur die Ladeplanung
neu (kein erneutes Geocoding/Routing). Eine Löschung/Auswahl an Stopp *i*
verwirft automatisch alle späteren erzwungenen Auswahlen (Index > *i*),
da deren Position von Stopp *i* abhängt.

**SOC-Eingaben statt interner Annahmen (angelehnt an A Better Routeplanner):**
Vier Ladestand-Werte sind Formulareingaben (Schieberegler) statt fester
Konstanten — Ladestand bei Abfahrt, Mindest-Restakku bei Zwischenladung,
Ladeziel an einem Zwischenstopp und Mindest-Restakku am Ziel. Die
Reichweite zwischen zwei Ladeständen wird darüber generisch berechnet
(`rangeBetweenSoc`), damit z. B. "wie weit komme ich von 100 % auf 20 %"
und "wie weit komme ich von 80 % auf 20 % nach dem Stopp" konsistent
denselben Weg nutzen.

**Umweg-Toleranz für anhängertauglichere Ladepunkte:** Ein Schieberegler
(0–100 km, Standard 20 km) bestimmt, wie weit ein Ladepunkt abseits der
Streckengeometrie liegen darf, um noch als Kandidat zu gelten. Je höher die
Toleranz, desto eher wird ein weiter entfernter, aber besser
anhängertauglich bewerteter Ladepunkt einem näheren, schlechter bewerteten
vorgezogen (Sortierung bleibt: Anhängertauglichkeit vor Entfernung, §26/
§27). Die Korridor-Distanz der Ladesäule zur Route dient dabei als
Näherung für den tatsächlichen Umweg — eine echte Neuberechnung der Route
über die Ladesäule wäre für den MVP zu aufwändig.

**Realistischer Verbrauch statt Herstellerangaben:** Der für die
Reichweitenberechnung verwendete Verbrauch wird **nie** aus
Batteriekapazität/Hersteller-Reichweite abgeleitet (diese Werte sind
erfahrungsgemäß zu optimistisch, besonders mit Wohnwagen). Stattdessen gilt
eine feste Priorität: manuelle Eingabe im Routenplaner-Formular → Wert aus
dem Fahrzeugprofil (`vehicles.consumption_kwh_per_100km`) → Standardwert
`DEFAULT_CONSUMPTION_KWH_PER_100KM` (38 kWh/100km, angelehnt an
ADAC-Praxistests mit Gespann). Das Formular zeigt transparent an, welche
Quelle verwendet wurde.

**Route speichern & Navigation starten:** Eine fertig geplante Route kann
im Profil gespeichert werden (`saved_routes`,
[supabase/migrations/20260908000000_saved_routes.sql](../supabase/migrations/20260908000000_saved_routes.sql)) --
gespeichert werden bewusst nur Start/Ziel-Koordinaten und alle
Formular-/Ladeeinstellungen (inkl. der im Routenübersicht-Popup
geloeschten Ladepunkte bzw. gewaehlten Alternativen), NICHT die fertige
Streckengeometrie oder der fertige Ladeplan. Beim erneuten Oeffnen
(`loadSavedRoute`) wird mit denselben Einstellungen frisch neu geplant,
damit sich aktualisierte Ladepunkte/Strassendaten korrekt niederschlagen
statt eines veralteten Snapshots.

"Navigation starten" oeffnet Google Maps mit Start, Ziel und allen
Ladestopps als Zwischenziele (Directions-URL-Schema, kein API-Key noetig)
-- Adapter unter
[src/lib/providers/navigation/](../src/lib/providers/navigation/)
(`NavigationProvider`-Interface analog zu `RoutingProvider`, §14-Prinzip).
Apple Karten/Waze koennen spaeter als weitere Adapter ergaenzt werden, ohne
die aufrufende UI zu aendern. Der Adapter baut ausschliesslich die URL
(`buildUrl`) und oeffnet sie bewusst NICHT selbst -- das Oeffnen
(`window.open` im Web) ist der einzige plattformspezifische Teil, damit
dieselbe Adapter-Logik unveraendert in der geplanten nativen iOS-/
Android-App wiederverwendet werden kann (dort uebernimmt z. B. React
Natives `Linking.openURL` das Oeffnen).

**Meine Routen (Profil): Segment-Navigation.** Die Liste unter
`/profil/routen` plant jede gespeicherte Route serverseitig neu (siehe
oben) und zeigt neben "Gesamte Route navigieren" auch einen
Google-Maps-Link pro Etappe (Start → 1. Ladestopp, 1. → 2. Ladestopp,
...). Da `NavigationProvider.buildUrl` eine reine Funktion ist, werden
diese Links direkt serverseitig als `<a href>` gerendert -- kein
Client-JavaScript noetig, kein `window.open`.

## Profil-Struktur (Phase 2, erweitert)

`/profil` ist ein Hub mit Kacheln (Anzahl Fahrzeuge/Wohnwagen, gespeicherte
Routen, Favoriten, Bewertungen) und einer Unterseiten-Navigation
(`src/components/profile/profile-sub-nav.tsx`, Layout in
`src/app/profil/layout.tsx`):

- `/profil/daten` — E-Mail, Konto erstellt am (Aendern von E-Mail/Passwort
  noch nicht umgesetzt, ehrlich als "folgt spaeter" gekennzeichnet).
- `/profil/gespann` — Elektroauto(s) + Wohnwagen (bisheriger Hauptinhalt
  von `/profil`).
- `/profil/routen` — gespeicherte Routen inkl. Segment-Navigation (s. o.).
- `/profil/favoriten` — liest die bereits bestehende `favorites`-Tabelle,
  aber es gibt noch KEINEN "Merken"-Button auf Campingplatz-/
  Ladepunkt-Detailseiten -- Seite zeigt das ehrlich an, statt eine
  scheinbar funktionierende Funktion vorzutaeuschen.
- `/profil/bewertungen` — Campingplatz-/Ladepunkt-Bewertungen.
- `/profil/einstellungen` — Platzhalter ("noch keine App-Einstellungen"),
  keine Scheinfunktionen.

## Phasenplan

1. **Grundsystem** — Next.js, TypeScript, Tailwind, Supabase, Auth, DB,
   Grundlayout ✅
2. **Nutzerprofil** — Registrierung, Login, Fahrzeug, Wohnwagen, Abmessungen ✅
   (inkl. Referenzkataloge mit Autofill für gängige Modelle)
3. **Campingplätze** — Datenbank, Kartenansicht, Liste, Suche, Filter,
   Detailseite mit EV-Camping-Score ✅
4. **Ladepunkte** — Datenmodell, Kartenansicht, Filter, Anhängertauglichkeit ✅
5. **Community** — Bewertung, Kommentar, Gespannparameter, Score ✅
6. **Routenplanung** — Start/Ziel, Routing, Fahrzeug, Wohnwagen, Ladeplanung ✅
7. **Gespannlogik** — Länge/Breite/Höhe/Gewicht, Straßenrestriktionen (OSM)
8. **Live-Daten** — echte Provider-Adapter anschließen

Jede Phase wird implementiert, getestet, dokumentiert, bevor die nächste
beginnt.

## Nicht im MVP (§50)

Premium-Abos, Bezahlfunktionen, Werbung, komplexes KI-System, native
iOS-/Android-Apps, Social Network, Reiseberichte, Gruppen, umfangreiches
Gamification-System.
