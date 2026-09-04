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
Gespanne > 8,5 m").

## Phasenplan

1. **Grundsystem** — Next.js, TypeScript, Tailwind, Supabase, Auth, DB,
   Grundlayout ✅
2. **Nutzerprofil** — Registrierung, Login, Fahrzeug, Wohnwagen, Abmessungen ✅
   (inkl. Referenzkataloge mit Autofill für gängige Modelle)
3. **Campingplätze** — Datenbank, Kartenansicht, Liste, Suche, Filter,
   Detailseite mit EV-Camping-Score ✅
4. **Ladepunkte** — Datenmodell, Kartenansicht, Filter, Anhängertauglichkeit ✅
5. **Community** — Bewertung, Kommentar, Gespannparameter, Score
6. **Routenplanung** — Start/Ziel, Routing, Fahrzeug, Wohnwagen, Ladeplanung
7. **Gespannlogik** — Länge/Breite/Höhe/Gewicht, Straßenrestriktionen (OSM)
8. **Live-Daten** — echte Provider-Adapter anschließen

Jede Phase wird implementiert, getestet, dokumentiert, bevor die nächste
beginnt.

## Nicht im MVP (§50)

Premium-Abos, Bezahlfunktionen, Werbung, komplexes KI-System, native
iOS-/Android-Apps, Social Network, Reiseberichte, Gruppen, umfangreiches
Gamification-System.
