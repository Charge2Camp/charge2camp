# Architektur

## Ziel

Charge2Camp ist eine Plattform für Reisende mit Elektroauto + Wohnwagen/Caravan.
Sie verbindet vier Dinge, die bisher nur getrennt existieren:
Elektroauto, Wohnwagen, Campingplatz, Ladeinfrastruktur, Gespann-Routing.

Zentraler USP:

> Charge2Camp plant Reisen für das tatsächliche Gespann — nicht nur für das
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

**Anbieter-Filter, manuelle Zwischenstopps, Ladekosten, Bestätigungsdatum
(angelehnt an evcaravan.de und A Better Routeplanner):**

- Optionaler **Anbieter-Filter** (`preferredProvider` in `planTrip`) --
  schraenkt Ladestopp-Kandidaten auf einen bestimmten Betreiber ein
  (z. B. "IONITY"), analog zu `minPowerKw`.
- **Manuelle Zwischenstopps** ("Add Stop", ABRP-Vorbild): beliebig viele
  Adressen, die die Route zwingend durchfahren soll, unabhaengig vom
  Ladebedarf (z. B. ein Campingplatz). Werden als zusaetzliche Wegpunkte in
  die OSRM-Anfrage eingespeist (`RouteRequest.waypoints`,
  [src/lib/providers/routing/osrm.ts](../src/lib/providers/routing/osrm.ts));
  die zurueckgegebene Streckengeometrie enthaelt sie bereits, sodass die
  bestehende Distanz-entlang-der-Route-Logik unveraendert weiterfunktioniert.
  Anders als Ladestopps koennen sie NICHT im Routenuebersicht-Popup geloescht
  werden (das wuerde eine komplette Neuberechnung der OSRM-Route erfordern) --
  Aendern/Entfernen geschieht ueber das Hauptformular.
  [src/lib/route-timeline.ts](../src/lib/route-timeline.ts) baut aus Start,
  Ladestopps und manuellen Zwischenstopps eine gemeinsame, nach
  Streckenposition sortierte Zeitleiste -- Grundlage sowohl fuer die
  Routenuebersicht-Anzeige als auch fuer die Segment-Navigation.
- **Geschaetzte Ladekosten** pro Stopp und gesamt (`estimatedCostEur`,
  `totalEstimatedCostEur` in `TripPlan`) aus bereits vorhandenem
  `charging_stations.price` -- fehlt bei mindestens einem Stopp der Preis,
  wird die Summe ehrlich als Teilsumme markiert (`costEstimateIncomplete`)
  statt fehlende Preise stillschweigend als 0 € zu behandeln.
- **Datum der letzten Community-Bestätigung** statt Live-Status/
  Oeffnungszeiten (kein Live-Status verfuegbar, siehe Phase 8): jeder
  vorgeschlagene Ladestopp und jede Alternative zeigt das Datum der
  juengsten `charging_reviews`-Bewertung als Proxy fuer "zuletzt bestaetigt
  funktionsfaehig".
- **Strukturierte Anhaengertauglichkeits-Kriterien** in `charging_reviews`
  (`enough_space_for_rig`, `unobstructed_access`, `no_barrier_or_garage`,
  `side_mounted_charger`, jeweils optional) statt nur Freitext -- macht
  Community-Bewertungen konsistenter vergleichbar. Werden im
  Bewertungsformular ([src/components/charging-stations/review-form.tsx](../src/components/charging-stations/review-form.tsx))
  und in der Bearbeiten-Ansicht im Profil abgefragt, auf der
  Ladepunkt-Detailseite als Badges je Bewertung angezeigt.

**Meine Routen (Profil): Segment-Navigation.** Die Liste unter
`/profil/routen` plant jede gespeicherte Route serverseitig neu (siehe
oben) und zeigt neben "Gesamte Route navigieren" auch einen
Google-Maps-Link pro Etappe (Start → 1. Ladestopp, 1. → 2. Ladestopp,
...). `NavigationProvider.buildUrl` ist eine reine Funktion (die URL wird
serverseitig berechnet), das Oeffnen selbst laeuft aber ueber die kleine
Client-Komponente `NavigationLink`
([src/components/profile/navigation-link.tsx](../src/components/profile/navigation-link.tsx)):
sie ruft `window.open(url, "charge2camp-navigation-" + Date.now(), ...)` auf
statt eines simplen `<a target="_blank">` -- ein eindeutiger Fenstername
pro Klick sorgt dafuer, dass zuverlaessig ein neuer Tab entsteht (ein
wiederholt gleicher Name wuerde einen schon offenen Tab nur still im
Hintergrund umleiten) und der Charge2Camp-Tab selbst nie verlassen wird.

## Gespannlogik & Straßenrestriktionen (§28ff, Phase 7)

**Fahrzeug-Abmessungen ergänzt:** `vehicles` trägt jetzt (analog zu
`caravans`) auch `width_m`, `height_m`, `weight_kg` (alle optional,
[supabase/migrations/20260910000000_vehicle_dimensions.sql](../supabase/migrations/20260910000000_vehicle_dimensions.sql)),
abgefragt im Fahrzeugformular. Zusammen mit den Wohnwagen-Maßen ergibt sich
daraus das tatsächliche Gespann —
[src/lib/gespann-dimensions.ts](../src/lib/gespann-dimensions.ts)
(`combineGespannDimensions`) berechnet Höhe/Breite als jeweils größeres Maß
aus Fahrzeug/Wohnwagen (eine Beschränkung betrifft das gesamte Gespann) und
das Gewicht als Summe — aber **nur**, wenn sowohl Fahrzeug- als auch
Wohnwagenwert bekannt sind (eine Teilsumme wäre als "Gespanngewicht"
irreführend, §2 keine Scheindaten). Fehlt ein Maß, bleibt es `null` statt
geschätzt zu werden.

**Straßenrestriktions-Check gegen OSM (Overpass API):**
[src/lib/providers/road-restrictions/](../src/lib/providers/road-restrictions/)
(`RoadRestrictionProvider`-Interface, §14-Adapterprinzip) fragt die
öffentliche Overpass-API (overpass-api.de, kostenlos, kein API-Key) nach
Wegen im Streckenkorridor mit `maxheight`/`maxwidth`/`maxweight`-Tags und
vergleicht sie mit den Gespann-Maßen. Aus Rücksicht auf den geteilten,
öffentlichen Dienst wird die Streckengeometrie auf max. 120
Stichprobenpunkte reduziert statt jeden Geometriepunkt abzufragen.

**Bewusst nur eine Warnung, keine automatische Umfahrung:** Der
öffentliche OSRM-Demo-Server (§ Routenplanung, Phase 6) unterstützt kein
gespannspezifisches Routing-Profil; ein selbst gehosteter OSRM/Valhalla-
Server mit Höhen-/Gewichtsprofil wäre für den MVP unverhältnismäßig
aufwändig (§4 Kostenoptimierung). Gefundene Restriktionen werden deshalb
im Routenplaner-Formular (Kurzhinweis) und in der Routenübersicht
(vollständige Liste mit km-Position) als Warnung angezeigt, ausdrücklich
mit dem Hinweis, dass die OSM-Tag-Abdeckung lückenhaft ist — eine fehlende
Warnung bedeutet **nicht** "keine Beschränkung vorhanden", sondern nur
"keine bekannt". Schlägt die Overpass-Anfrage fehl (Timeout/Rate-Limit auf
dem geteilten Dienst), wird das ehrlich als "nicht geprüft" markiert statt
stillschweigend keine Warnung anzuzeigen. Der Check läuft nur, wenn ein
Wohnwagen gewählt ist und mindestens ein Gespann-Maß bekannt ist.

## Mobile/Touch-Design & Vorbereitung auf native Apps (verbindlich)

**Charge2Camp soll spaeter als native iOS-/Android-App im App Store/Play
Store vertrieben werden** (vermutlich als WebView-Wrapper, z. B.
Capacitor, um die bestehende Next.js-Codebasis wiederzuverwenden -- die
konkrete Wrapper-Technologie ist noch nicht festgelegt). Das ist ab
sofort eine **verbindliche Randbedingung fuer jede UI-Aenderung**, nicht
nur fuer den Routenplaner:

- **Mobile-first, Touch-Ziele ≥ 44px** (Apple HIG) fuer jeden
  interaktiven Button/Link -- ueber `min-h-11`/`min-h-12` plus
  grosszuegigeres Padding statt der kompakteren Desktop-Groessen. Reine
  Text-Links ohne Padding (z. B. "Bearbeiten"/"Löschen"-Aktionen) sind zu
  vermeiden.
- **Eingabefelder mit `text-base`** (16px), niemals kleiner: iOS Safari
  zoomt beim Fokussieren eines Feldes mit Schriftgroesse < 16px
  automatisch hinein. Da Label-Wrapper haeufig `text-sm` setzen (vom
  `<input>`/`<select>`/`<textarea>` per CSS-Vererbung uebernommen), muss
  das Eingabeelement selbst immer explizit `text-base` tragen.
- **Kein `hover:`-only Verhalten** fuer Funktionalitaet (nur fuer rein
  kosmetisches Feedback) -- Touchscreens kennen kein `:hover`. Wo Hover
  bisher etwas steuert (z. B. Karte↔Liste-Hervorhebung in
  `campsite-explorer.tsx`/`charging-station-explorer.tsx`), zusaetzlich
  einen Tap-Weg anbieten (dort: `onMarkerClick` auf der Karte).
  Karten-Marker (`src/components/map/map-view.tsx`) haben eine 44px
  Tap-Flaeche um einen bewusst kleiner bleibenden 16px-Punkt herum.
- **Viewport-Meta** (`export const viewport` in
  [src/app/layout.tsx](../src/app/layout.tsx), inkl. `viewportFit:
  "cover"`): ohne dieses Meta faellt iOS Safari auf eine
  Desktop-Layout-Breite von ca. 980px zurueck -- saemtliche
  Tailwind-Breakpoints (`sm:`, `md:`, ...) wuerden dann auf echten
  Handys falsch auswerten. Nutzer-Zoom bleibt bewusst erlaubt (kein
  `maximumScale`/`userScalable: false`, das waere ein
  Barrierefreiheits-Problem, WCAG 1.4.4).
- **`env(safe-area-inset-*)`** fuer fixe/vollflaechige Elemente (Header,
  Footer, Vollbild-Dialoge) -- respektiert Notch/Dynamic Island/
  Home-Indicator, sobald die Seite randlos (native App ohne Browser-
  Chrome) laeuft. Auf normalen Browsern ist der Wert 0, aendert also
  nichts. **Vorsicht beim Schreiben**: `env(safe-area-inset-top)` NICHT
  in Kommentaren als abgekuerztes Beispiel wie "env(...)" hinschreiben --
  Tailwinds Klassen-Scanner liest auch Kommentare und generiert daraus
  eine kaputte, nicht kompilierbare CSS-Regel (siehe Git-Historie).
- **Externe Navigation/Deep-Links ueber Adapter kapseln** (§14-Prinzip,
  gilt jetzt auch hierfuer): `NavigationProvider.buildUrl` baut nur die
  URL, das Oeffnen passiert in einer duennen Komponente
  ([src/components/profile/navigation-link.tsx](../src/components/profile/navigation-link.tsx)).
  So kann eine spaetere native App `window.open` durch
  `Linking.openURL`/ein natives Kartenprogramm ersetzen, ohne die
  Adapter-Logik anzufassen.
- **Vollbild-Sheets statt kleiner zentrierter Dialoge auf schmalen
  Screens**: z. B. das Routenuebersicht-Popup
  ([src/components/routing/route-overview-dialog.tsx](../src/components/routing/route-overview-dialog.tsx))
  ist unterhalb von `sm:` (640px) `inset-0` ohne abgerundete Ecken --
  bessere Erreichbarkeit mit dem Daumen. Ab `sm:` weiterhin eine
  zentrierte Karte.
- **Aktions-Button-Reihen stapeln sich vertikal** auf schmalen Screens
  (`flex-col sm:flex-row`) statt sich nebeneinander zu quetschen.

**Noch offen fuer eine echte App-Store-Veroeffentlichung** (bewusst noch
nicht umgesetzt, da echte Design-Assets fehlen -- keine Platzhalter-Icons
erfunden, siehe §39 "keine Scheindaten"): App-Icon-Set, Splashscreens,
`manifest.json` fuer PWA-Installierbarkeit, Entscheidung fuer eine
konkrete Wrapper-Technologie (Capacitor o. ae.), Push-Notification-
Strategie, Store-Listing-Texte/Screenshots.

## Profil-Struktur (Phase 2, erweitert)

`/profil` ist ein Hub mit Kacheln (Anzahl Fahrzeuge/Wohnwagen, gespeicherte
Routen, Favoriten, Bewertungen) und einer Unterseiten-Navigation
(`src/components/profile/profile-sub-nav.tsx`, Layout in
`src/app/profil/layout.tsx`):

- `/profil/daten` — E-Mail, Konto erstellt am, Zuhause-Adresse. Dazu
  E-Mail-Adresse ändern, DSGVO-Datenexport und Konto löschen (mit
  Tipp-Bestätigung) — siehe [privacy.md](privacy.md). Passwort ändern
  noch nicht umgesetzt.
- `/profil/gespann` — Elektroauto(s) + Wohnwagen (bisheriger Hauptinhalt
  von `/profil`).
- `/profil/routen` — gespeicherte Routen inkl. Segment-Navigation (s. o.).
- `/profil/favoriten` — Herz-Button auf Campingplatz-/Ladepunkt-
  Detailseiten (mit "Route hierher planen") schreibt in die `favorites`-
  Tabelle; diese Seite listet sie inkl. Auswahl-Popup im Routenplaner.
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
7. **Gespannlogik** — Länge/Breite/Höhe/Gewicht, Straßenrestriktionen (OSM) ✅
8. **Live-Daten** — echte Provider-Adapter anschließen

Jede Phase wird implementiert, getestet, dokumentiert, bevor die nächste
beginnt.

## Nicht im MVP (§50)

Premium-Abos, Bezahlfunktionen, Werbung, komplexes KI-System, native
iOS-/Android-Apps, Social Network, Reiseberichte, Gruppen, umfangreiches
Gamification-System.
