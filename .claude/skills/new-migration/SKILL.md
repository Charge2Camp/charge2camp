---
name: new-migration
description: Neue Supabase-Migration fuer Charge2Camp anlegen und sicher pruefen (Funktions-Overload, lokaler Smoke-Test, Drift-Check vor db push)
disable-model-invocation: true
argument-hint: <kurze_beschreibung_in_snake_case>
---

# Neue Supabase-Migration: $ARGUMENTS

## 1. Datei anlegen
- `supabase/migrations/<YYYYMMDDHHMMSS>_<beschreibung>.sql`; Timestamp **groesser** als die
  letzte Datei (`ls supabase/migrations | tail -3`), Beschreibung in snake_case.
- Bevorzugt idempotent (`create or replace`, `if not exists`, `drop ... if exists`).
- Bestehende Migrationen nie umschreiben - immer neue Datei.

## 2. Funktionen: Overload-Falle
`create or replace function` mit geaenderter Parameterliste (neu, entfernt, umsortiert)
erzeugt einen **zweiten Overload** statt zu ersetzen -> Laufzeitfehler
`function ... is not unique`. Deshalb direkt davor:

```sql
drop function if exists schema.func_name(<ALTE vollstaendige Typliste>);
```

Alte Signatur per `select oid::regprocedure from pg_proc where proname = 'func_name';` ermitteln.
Ein PreToolUse-Hook fragt nach, wenn ein `create or replace function` ohne `drop` geschrieben wird.

## 3. Lokal testen (Docker muss laufen)
```bash
npx supabase db reset
docker exec -i supabase_db_eCamper psql -U postgres -d postgres -c "select proname, pronargs from pg_proc where proname = '<func_name>';"
```
- Genau **eine** Zeile erwartet.
- Funktion nur mit den Argumenten aufrufen, die der App-Code wirklich sendet.
- **Nie** `supabase db query --linked=false` zur Pruefung des lokalen Stands nutzen - das kann
  still gegen die Remote-/Produktions-DB laufen. Immer `docker exec` verwenden.

## 4. Vor `db push` (Produktion) - nur nach ausdruecklicher Freigabe des Users
```bash
npx supabase migration list
```
- Leere `remote`-Werte oder Luecken = Drift (Prod hatte schon Drift, repariert 2026-10-04).
- Bei `LegacyDbPushMissingRemoteError`/`MissingLocalError` **nicht** blind
  `--include-all` oder `migration repair` nutzen: pro Datei per read-only Query pruefen, ob
  das Objekt (exakter Tabellen-/Spaltenname!) schon existiert, erst dann `repair`.

## 5. Abschluss
- Falls Schema/API betroffen: `docs/database.md` bzw. `docs/api.md` aktualisieren.
- Nicht-triviale Entscheidung -> Eintrag in `docs/DESIGN_DECISIONS.md`.
- Commit nur auf Anfrage des Users.
