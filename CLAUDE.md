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
9. **Charge2Camp Design System ist bindend, nicht optional.** Jede
   UI-Aufgabe (neue Komponente, neuer Screen, Änderung an bestehendem
   Markup/Styling) berücksichtigt automatisch:
   - [docs/design/brand-guide.md](docs/design/brand-guide.md) — Logo,
     Farbe, Typografie, Icons, Sprache, Kartenpins, Ladeanimation.
   - [docs/design/tokens.json](docs/design/tokens.json) /
     `src/app/globals.css` (`--c-*`-Variablen) — Design Tokens. Farben nie
     hart codieren (kein `text-red-600`, `text-black/40` o. Ä.), immer
     den passenden Tailwind-Token (`text-error`, `text-text-muted`,
     `border-line-strong`, …) verwenden oder — falls die bestehenden
     Tokens die benötigte Rolle nicht abdecken — einen neuen Token
     ergänzen und in `brand-guide.md`/`tokens.json` dokumentieren, statt
     eine Opazitäts-/Hex-Variante direkt im Code zu erfinden.
   - [docs/design/information-architecture.md](docs/design/information-architecture.md)
     und [docs/design/user-flows.md](docs/design/user-flows.md) —
     bestehende Seitenstruktur, Navigation und Kernflows nicht
     stillschweigend ändern.
   - [docs/design/ux-problems.md](docs/design/ux-problems.md) und
     [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) — bereits
     identifizierte UX-Probleme und der Grund hinter bisherigen
     Design-/Architekturentscheidungen (Decision/Reason/Alternatives/
     Impact/Date je Eintrag).

   **Widerspricht eine Aufgabe dem bestehenden Designsystem, wird der
   Konflikt benannt, bevor eine neue individuelle Lösung gebaut wird** —
   nicht stillschweigend etwas Abweichendes implementieren. Jede neue,
   nicht triviale Design-/Architekturentscheidung wird in
   `docs/DESIGN_DECISIONS.md` ergänzt (Format: Decision/Reason/
   Alternatives/Impact/Date), damit spätere Arbeit nachvollziehen kann,
   *warum* etwas so entschieden wurde.

## Harte Regeln (niemals verletzen)

1. **Manuelle Caravan-Tauglichkeitsbewertungen sind unantastbar.** Weder
   OSM- noch API-/Importdaten dürfen sie überschreiben
   (`enrich.trailer_suitability` mit `manual_override`/`origin <> 'auto'`,
   Campingplatz-Merkmale mit `source = 'admin'`). Technische Felder
   (aktiv/inaktiv, Anschlüsse, Leistung) dürfen aktualisiert werden.
   Absicherung: `ingest/test_enrich_immutability.py`.
2. **Datenpriorität Ladestationen:** manuell kuratiert
   (`admin_manual`, `sascha_list`) > Bundesnetzagentur > weitere frei
   kommerziell nutzbare nationale Quellen (IRVE, RIPREE, …) > OSM.
   Abgebildet über `core.source_registry.priority`.
3. **Keine Datenquellen mit kommerziellen Nutzungsbeschränkungen**
   (Lizenz in `core.source_registry` und
   [docs/data-sources.md](docs/data-sources.md) dokumentieren).
4. **Bestehende Architekturentscheidungen fortführen.** Keine
   Framework-Wechsel oder großen Umbauten ohne ausdrückliche Zustimmung.
5. **Keine Funktionalität entfernen.**

## Architektur (Kurzfassung)

- Datenschichten in Postgres: `raw.*` (Rohimporte je Quelle) → `core.*`
  (normalisierte Ladepunkte/Campingplätze, von Importern überschreibbar) →
  `enrich.*` (redaktionelle/Nutzer-Bewertungen, verknüpft über
  `external_key`, von Importern nie verändert). `public.*` = Nutzerdaten
  (Profile, Gespann, Routen, Reviews), alle mit RLS.
- Lesezugriff der App über API-Routen mit `requireApiUser`/`requireApiAdmin`
  (`src/lib/api-guard.ts`: Login + Rate-Limit) und SQL-Funktionen
  (`core.charge_points_in_bbox`, `search_*`).
- Importe: OCM per Vercel-Cron (`/api/cron/ocm-import`), nationale Quellen
  per GitHub Action, OSM-Campingplätze per `ingest/`.

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

## Befehle

```bash
npm run dev            # Next.js-Dev-Server (cross-env, System-CA)
npm run lint           # ESLint
npx tsc --noEmit       # Typecheck (kein npm-Script)
npm test               # Vitest (src/**/*.test.ts), nur reine Logik in src/lib
npm run build          # Produktions-Build, faengt Server/Client-Fehler
```

Tests: Vitest fuer reine Logik (`src/lib/scoring`, `geo`, `travel-time`, `route-timeline`); keine DOM-/
Supabase-Tests, kein Playwright. `admin/` hat keinen Test-Runner. Python-Tests liegen in `ingest/`
(`test_*.py`). Neue reine Logik in `src/lib` bekommt einen Test (`<name>.test.ts` daneben).
Skills: `/pre-push-check` vor Push, `/new-migration` fuer Migrationen, `/mobile-check` fuer UI-Aenderungen.

## Repo-Struktur (Ueberblick)

- `src/` — Haupt-App (Next.js): `app/`, `components/`, `lib/` (Datenzugriff, Scoring,
  `providers/` = Adapter, `supabase/{client,server,admin,middleware}.ts`).
- `admin/` — **eigenes** Next.js-Projekt (eigenes `package.json`, `CLAUDE.md`, Lint/Build) fuer das
  Admin-Backend (Massenupload, Quellen-Import). Aenderungen dort separat pruefen.
- `ingest/` — Python-Importer (BNetzA, IRVE, OCM, OSM, Ripree …) gegen dieselbe Supabase-DB.
  Laufen produktiv per GitHub Action `.github/workflows/source-import.yml`, nicht in Vercel.
- `supabase/migrations/` — Schema; `sql/` — Qualitaetspruefungen.
- `.claude/` — Hooks (`pre-edit-guard`, `post-edit-check` = tsc/eslint/Vitest/Farb-Check,
  `client-server-boundary`; alle gelten fuer `src/` **und** `admin/`), Agents (`design-system-reviewer`,
  `sql-perf-reviewer`, `security-reviewer`), Skills (`new-migration`, `pre-push-check`, `mobile-check`).
- `.mcp.json` — `figma`, `context7` (aktuelle Bibliotheks-Doku) und `supabase-local-db` (nur lesend,
  nur `127.0.0.1:54322` = lokale Docker-DB, nie Prod; braucht `npx supabase start`).

## Bekannte Fallen (verbindlich beachten)

1. **Client/Server-Grenze:** Ein Wert-Import aus Server-only-Code (`next/headers`,
   `@/lib/supabase/server|admin`, `server-only`) in `"use client"`-Code legt die ganze App mit
   500 lahm; tsc/eslint merken es nicht (ein Hook und `npm run build` schon). Nur `import type`
   oder eine `"use server"`-Action verwenden.
2. **SQL-Funktions-Overload:** `CREATE OR REPLACE FUNCTION` mit geaenderter Parameterliste erzeugt
   einen zweiten Overload. Immer vorher `DROP FUNCTION IF EXISTS schema.name(<alte Typliste>)`.
3. **Lokalen DB-Stand pruefen:** nie `supabase db query --linked=false` (kann still die
   Produktions-DB treffen), sondern `docker exec -i supabase_db_eCamper psql …`.
4. **Migrations-Drift:** vor jedem `db push` `npx supabase migration list` pruefen; Prod-Historie
   hatte Luecken (repariert 2026-10-04). `db push` nur nach ausdruecklicher Freigabe.
5. **Funktionsrechte in `core`/`enrich`:** neue Funktionen sind seit 20261027030000 nur fuer
   `service_role` ausfuehrbar (PUBLIC per Default-Privileg entzogen). Braucht die Nutzer-Session
   eine Funktion, ausdruecklich `grant execute ... to authenticated` UND die Berechtigung in der
   Funktion selbst pruefen; nie an `anon`. Pruefung: `ingest/test_function_privileges.py`
   (Allow-Liste dort pflegen).

## Wichtige Dateien

- [docs/architecture.md](docs/architecture.md) — volle Spezifikation & Phasenplan
- [docs/database.md](docs/database.md) — Datenmodell
- [docs/api.md](docs/api.md) — API-/Adapter-Struktur
- [docs/data-sources.md](docs/data-sources.md) — externe Datenquellen & Lizenzen
- [docs/privacy.md](docs/privacy.md) — Datenschutz/DSGVO
- [docs/i18n.md](docs/i18n.md) — Mehrsprachigkeit (geplant): Bibliothek,
  URL-/Katalogstruktur, KI-gesteuerte Übersetzungspipeline, Rollout-Reihenfolge
- [supabase/migrations/](supabase/migrations/) — DB-Schema

### Charge2Camp Product Design System (verbindlich, s. Prinzip 9)

- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) — konsolidierte
  Übersicht (Prinzipien, Farben, Typografie, Tokens, Komponenten,
  Navigation, Maps, Charging, Camping, Routing, Accessibility,
  iOS/Android) — bester Einstiegspunkt, verlinkt auf die Details unten
- [docs/design/brand-guide.md](docs/design/brand-guide.md) — Logo, Farbe,
  Typografie, Icons, Sprache, Kartenpins, Ladeanimation
- [docs/design/tokens.json](docs/design/tokens.json) — Design Tokens
  maschinenlesbar (Quelle für `src/app/globals.css`)
- [docs/design/information-architecture.md](docs/design/information-architecture.md)
  — Sitemap, Navigationsmodell, Seiteninventar
- [docs/design/user-flows.md](docs/design/user-flows.md) — dokumentierte
  Kernflows (Auslöser → Schritte → Entscheidungspunkte → Fehler-/
  Leerzustände → Ergebnis)
- [docs/design/ux-problems.md](docs/design/ux-problems.md) — bekannte
  UX-Probleme, kategorisiert (A technisch/B UX/C Design/D
  Produktentscheidung) und priorisiert
- [docs/design/design-strategy.md](docs/design/design-strategy.md) —
  Leitplanken für Design-/UI-Arbeit
- [docs/DESIGN_DECISIONS.md](docs/DESIGN_DECISIONS.md) — laufendes
  Entscheidungslog (Decision/Reason/Alternatives/Impact/Date), bei jeder
  nicht-trivialen Design-/Architekturentscheidung fortzuschreiben
- [docs/PRODUCT_AUDIT.md](docs/PRODUCT_AUDIT.md) — Ist-Zustand-Audit
  (Ausgangspunkt des Design-Prozesses)
