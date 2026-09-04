# eCamper

MVP / Testversion einer Webplattform für Reisende mit Elektroauto +
Wohnwagen/Caravan. Verbindet Campingplatzsuche, Ladeinfrastruktur,
Anhängertauglichkeit und Gespann-Routing an einem Ort.

> eCamper plant Reisen für das tatsächliche Gespann — nicht nur für das
> Elektroauto.

Volle Spezifikation und Phasenplan: [docs/architecture.md](docs/architecture.md).

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + Supabase (Postgres + Auth).

## Voraussetzungen

- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (für die
  lokale Supabase-Instanz)

## Setup

```bash
npm install
npx supabase start
npm run dev
```

`npx supabase start` startet Postgres, Auth und die weiteren Supabase-Dienste
lokal über Docker und wendet die Migrationen aus `supabase/migrations/`
sowie die Seed-Daten aus `supabase/seeds/*.sql` an (Demo-Campingplätze/
-Ladepunkte sowie die Fahrzeug-/Wohnwagen-Referenzkataloge). `.env.local` ist
bereits mit den Standard-Werten für die lokale Instanz vorbelegt.

Die App läuft danach unter http://localhost:3000, die lokale Supabase
Studio-Oberfläche unter der von `supabase start` ausgegebenen URL
(Standard: http://127.0.0.1:54323).

## Projektstatus

Phase 1 (Grundsystem) abgeschlossen: Projekt-Setup, Datenbankschema, Auth
(Registrierung/Login/Logout), responsives Grundlayout mit Navigation zu
allen Hauptbereichen. Die übrigen Bereiche (Campingplätze, Ladepunkte,
Routenplaner, Community) sind als Platzhalter angelegt und folgen in den
nächsten Phasen — siehe [docs/architecture.md](docs/architecture.md).

## Dokumentation

- [docs/architecture.md](docs/architecture.md) — Architektur & Phasenplan
- [docs/database.md](docs/database.md) — Datenmodell
- [docs/api.md](docs/api.md) — API-/Adapter-Struktur
- [docs/data-sources.md](docs/data-sources.md) — externe Datenquellen & Lizenzen
- [docs/privacy.md](docs/privacy.md) — Datenschutz/DSGVO
- [CLAUDE.md](CLAUDE.md) — Arbeitsanweisungen für Claude Code
