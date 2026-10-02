---
name: pre-push-check
description: Vollstaendiger Qualitaets-Check vor Push/PR fuer Charge2Camp (Lint, Typecheck, Build, Migrations-Drift, Reviewer-Agents auf dem Diff)
disable-model-invocation: true
argument-hint: [admin]
---

# Pre-Push-Check

Faengt ab, was der Edit-Hook nicht sieht: Build-Fehler, Fehler ueber mehrere Dateien und Migrations-Drift.
Fuer UI-Aenderungen zusaetzlich `/mobile-check` empfehlen (nicht automatisch ausfuehren).
Nur lesen und pruefen - **nichts committen, pushen oder `db push`en**. Mit Argument `admin` im
Verzeichnis `admin/` statt im Projekt-Root pruefen (Schritt 1-3).

## 1. Diff erfassen
```bash
git status --short
git diff --stat origin/development...HEAD
git diff --name-only HEAD
```
Merke dir, ob `src/**/*.tsx|css`, `supabase/migrations/*.sql` oder `.from()`/`.rpc()`-Code betroffen ist.

## 2. Statische Checks (parallel moeglich)
```bash
npm run lint
npx tsc --noEmit
npm test
```
`npm test` = Vitest (reine Logik unter `src/lib`: Scoring, Geo, Reisezeit, Routen-Timeline). Alle Fehler nennen, nicht nur den ersten.
Mit Argument `admin` hat `admin/` kein `npm test` - dort nur lint, tsc und build.

## 3. Build
```bash
npm run build
```
Der Build deckt Server/Client-Import-Fehler, fehlende Exporte und Route-Fehler auf, die tsc nicht sieht.
Bei Fehlschlag: Ursache aus der Ausgabe zusammenfassen, nicht raten.

## 4. Migrationen (nur wenn `supabase/migrations/` im Diff)
```bash
npx supabase migration list
```
- Leere `remote`-Werte oder Luecken = Drift (siehe `new-migration`, Abschnitt 4) - melden, nicht reparieren.
- Neue Datei: Timestamp groesser als alle vorhandenen? `create or replace function` mit geaenderter
  Signatur hat ein `drop function if exists` davor?
- **Nie** `supabase db query --linked=false` zur Pruefung nutzen (kann Prod treffen); lokal nur per `docker exec`.

## 5. Reviewer-Agents (parallel, nur bei Treffer)
- UI-Dateien (`.tsx`/`.css` unter `src/` oder `admin/`) im Diff -> Agent `design-system-reviewer`
- Migrationen, `src/app/api/**`, `*actions.ts`, `src/lib/supabase/*`, `admin/**` oder `.github/workflows/*` im Diff -> Agent `security-reviewer`
- Migrationen oder Supabase-Abfragecode im Diff -> Agent `sql-perf-reviewer`

## 6. Bericht
Kurze Tabelle: Check | Ergebnis (ok / Fehler / uebersprungen + Grund). Darunter Befunde der Agents,
nach Schwere sortiert. Ausdruecklich sagen, was **nicht** geprueft wurde (z. B. Docker aus, kein Diff).
