@AGENTS.md

# Charge2Camp — Projektkontext für Claude Code

MVP-Webplattform für Camper mit Elektroauto + Wohnwagen. Verbindet
Campingplatzsuche, Ladeinfrastruktur, Anhängertauglichkeit und
Gespann-Routing. Siehe [docs/architecture.md](docs/architecture.md) für die
volle Produkt- und Architekturspezifikation.

## Entwicklungsprinzipien (verbindlich)

1. **Iterativ nach Phasen entwickeln**, nicht alles gleichzeitig. Siehe
   Phasenplan in [docs/architecture.md](docs/architecture.md).
2. **Keine Scheindaten.** Demo-/Testdaten müssen im UI eindeutig als solche
   gekennzeichnet sein (`[DEMO]`-Präfix, `source = 'demo'`). Niemals Live-Daten
   vortäuschen, wenn keine echte API angebunden ist.
3. **Provider über Adapter kapseln.** Lade-APIs (Eco-Movement, Open Charge
   Map, …), Routing-Engines (GraphHopper/Valhalla/OSRM) und Traffic-APIs
   (HERE/TomTom) werden nie fest verdrahtet, sondern über austauschbare
   Adapter-Interfaces angebunden.
4. **Kostenoptimierung:** immer zuerst die günstigste technisch sinnvolle
   Lösung. Keine kostenpflichtige API einsetzen, wenn eine offene/kostenlose
   Alternative ausreicht.
5. **Keine Secrets im Code.** Alle Keys über Environment Variables
   (`.env.local`, nie committen). `.env.example` aktuell halten.
6. **Datenlizenzen respektieren.** Keine Daten von kommerziellen Plattformen
   (Google Maps, PiNCAMP, camping.info, …) scrapen. Bevorzugt: OpenStreetMap,
   Open Data, Community-Daten, eigene/lizenzierte Quellen. Jede externe
   Quelle wird in [docs/data-sources.md](docs/data-sources.md) dokumentiert.
7. **Anhängertauglichkeit hat Priorität** vor einem minimal kürzeren Umweg
   bei der Routen-/Ladestopp-Auswahl.
8. **Mobile-first & Touch-tauglich, mit Blick auf App Store/Play Store.**
   Charge2Camp soll später als native iOS-/Android-App vertrieben werden —
   jede UI-Änderung muss das berücksichtigen: Tap-Ziele ≥ 44px, Eingabefelder
   mit `text-base` (verhindert iOS-Auto-Zoom), kein rein
   hover-abhängiges Verhalten (Touch kennt kein `:hover`),
   `env(safe-area-inset-*)` für Header/Footer/Vollbild-Dialoge, externe
   Navigation über Adapter kapseln (§3). Details und Begründung in
   [docs/architecture.md](docs/architecture.md), Abschnitt
   "Mobile/Touch-Design & Vorbereitung auf native Apps".

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth), lokal über `supabase start` (Docker)
- Karten: OpenStreetMap + MapLibre (folgt in Phase 3/4)

## Lokale Entwicklung

```bash
npm install
npx supabase start   # benötigt Docker Desktop
npm run dev
```

Nach `supabase start` ggf. `.env.local` mit den ausgegebenen Werten
aktualisieren (Standardwerte sind bereits für lokale Entwicklung vorbelegt).

## Wichtige Dateien

- [docs/architecture.md](docs/architecture.md) — volle Spezifikation & Phasenplan
- [docs/database.md](docs/database.md) — Datenmodell
- [docs/api.md](docs/api.md) — API-/Adapter-Struktur
- [docs/data-sources.md](docs/data-sources.md) — externe Datenquellen & Lizenzen
- [docs/privacy.md](docs/privacy.md) — Datenschutz/DSGVO
- [supabase/migrations/](supabase/migrations/) — DB-Schema
