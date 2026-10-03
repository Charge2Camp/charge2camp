# Optimierung Charge2Camp – Bestandsaufnahme (Phase 1)

Stand: 2026-10-02, Branch `optimierung-agent-skills`, Basis `435a105`.
Nur gelesen, nichts geändert (außer der Ergänzung der CLAUDE.md in Phase 0).

## Ausgangslage (gemessen)

| Prüfung | Ergebnis |
|---|---|
| `npx tsc --noEmit` | sauber |
| `npm run lint` | sauber |
| `npm test` (Vitest) | 7 Dateien, 69 Tests, alle grün |
| `npm audit --omit=dev` (App + Admin) | **1 kritisch:** `next` 16.3.4 (RCE in `next/og` ImageResponse, GHSA-vcvr-r3jv-pc5j), Fix in 16.3.8 |
| RLS (lokale DB) | alle `public.*`/`enrich.*`-Tabellen mit RLS; 6 `core.*`- und 3 `raw.*`-Tabellen ohne RLS (siehe S-3) |
| Python-Tests | `ingest/test_enrich_immutability.py`, `test_field_resolver.py` (laufen nur gegen echte DB, nicht in CI) |
| CI | nur `source-import.yml` (Importe), **keine** Lint/Test/Build-Pipeline |
| Native App | noch keine (kein Capacitor/`ios`/`android`); aktuell PWA (`manifest.ts`, `display: standalone`) |

## Befunde, priorisiert

Aufwand: S = < 1 h, M = halber Tag, L = 1+ Tage.

### Kritisch

| ID | Befund | Ort | Aufwand | Skill |
|---|---|---|---|---|
| S-1 | `next` 16.3.4 hat eine bekannte RCE in `next/og` `ImageResponse`. Die App nutzt genau das (`apple-icon.tsx`, `icon-192.png/route.tsx`, `icon-512.png/route.tsx`, `maskable-icon-512.png/route.tsx`). Admin ist auf derselben Version. Patch-Update auf 16.3.8 in beiden Projekten (exakt gepinnt, daher manuell). | `package.json`, `admin/package.json` | S | security-and-hardening |

### Hoch

| ID | Befund | Ort | Aufwand | Skill |
|---|---|---|---|---|
| D-1 | **Lizenzstatus unvollständig (harte Regel 3).** In `core.source_registry` ist `commercial_use` für `bundesnetzagentur` und `ripree` leer, die Lizenz von `ripree` fehlt ganz. Bei OCM steht in der Registry „ODbL“, `docs/data-sources.md` sagt dagegen „je Datenanbieter, überwiegend CC BY 4.0/CC0, nicht ODbL“. OCM-Datensätze tragen pro `DataProvider` eine eigene Lizenz; der Import filtert danach nicht. Lizenz je Quelle klären, Registry korrigieren, OCM-Datensätze mit nicht-kommerzieller Lizenz beim Import ausfiltern. | `20261012000000_…source_registry.sql`, `20261017000000_…ripree.sql`, `ingest/import_ocm.py`, `src/app/api/cron/ocm-import/route.ts` | M | source-driven-development, documentation-and-adrs |
| D-2 | **Priorität BNetzA vs. andere nationale Quellen (harte Regel 2).** `bundesnetzagentur`, `irve` und `ripree` haben alle `priority = 90`. Laut Vorgabe muss BNetzA darüber liegen. In Grenzregionen (DE/FR) entscheidet sonst Gleichstand. Migration: IRVE/RIPREE auf z. B. 80, plus Test für `find_and_absorb_nearby_duplicate`. | `core.source_registry` | S | test-driven-development |
| S-2 | **Keine Security-Header** in App und Admin (`next.config.ts`): kein `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`. Für Admin besonders relevant (Clickjacking). CSP wegen MapLibre/Sentry/Supabase zunächst als `Report-Only`. | `next.config.ts`, `admin/next.config.ts` | M | security-and-hardening |
| Q-1 | **Keine CI für Qualitätsprüfungen.** Lint/tsc/Vitest/Build laufen nur lokal über Hooks; ein Push ohne Hooks (oder aus `admin/`) wird nicht geprüft. GitHub Action für App + Admin (lint, tsc, test, build) auf PR/Push nach `development`. Kostenlos im GitHub-Kontingent. | `.github/workflows/` | S | ci-cd-and-automation |

### Mittel

| ID | Befund | Ort | Aufwand | Skill |
|---|---|---|---|---|
| S-3 | `core.charge_point_duplicate`, `…_auto_merge_log`, `field_change_log`, `quality_check_cache`, `rate_limit_bucket`, `source_registry` und `raw.*` haben kein RLS. Lokal hat `anon`/`authenticated` keine Grants darauf, das Schema `core` ist aber über PostgREST exponiert (`config.toml`). Defense-in-Depth: RLS ohne Policies aktivieren (nur `service_role`/Security-Definer greifen zu). Prod-Grants vorher prüfen. | Migration | S | security-and-hardening |
| D-3 | Schutz manueller Campingplatz-Merkmale hängt allein an der Zahl `confidence` (Admin 100 > OSM 80). Ein künftiger Import mit `confidence ≥ 100` würde Admin-Werte überschreiben. Explizite Bedingung `source <> 'admin'` im Upsert ergänzen und testen. | `ingest/import_osm_campsites.py:86` | S | test-driven-development |
| D-4 | `test_enrich_immutability.py` deckt nur OCM ab. Gleichen Test für BNetzA/IRVE/RIPREE und OSM-Campingplätze ergänzen; als Fixture-basierten Test lauffähig machen (lokale Docker-DB), damit er in CI laufen kann. | `ingest/` | M | test-driven-development |
| T-1 | Testabdeckung reiner Logik lückenhaft: ungetestet u. a. `trailer-verdict.ts`, `charging-station-filters.ts`, `campsite-filters.ts`, `connector-standard.ts`, `connector-categories.ts`, `access-type.ts`, `maps-link.ts`/`google-maps-link.ts`, `route-planning.ts`. `trailer-verdict` und `route-planning` zuerst (Kernlogik Anhängertauglichkeit). | `src/lib` | M | test-driven-development |
| T-2 | `admin/` hat keinen Test-Runner; `admin/lib/csv.ts` (Massenupload-Parsing) und `charge-point-write.ts` sind reine, fehleranfällige Logik. Vitest analog zur App einrichten. | `admin/` | S | test-driven-development |
| P-1 | Die Kartenabfrage `charge_points_in_bbox` wurde in ~15 aufeinanderfolgenden Migrationen umgebaut (Plan-Regressionen, Timeouts, Revert). Es fehlt ein reproduzierbarer Performance-Test (EXPLAIN-Snapshots für typische Bboxen/Filter) als Regressionsschutz. | `sql/`, Migrationen | M | performance-optimization |
| C-1 | Sehr große Dateien: `route-planner-form.tsx` (1434 Zeilen), `routenplaner/actions.ts` (954), `charging-station-map-explorer.tsx` (940), `profil/actions.ts` (647). Schrittweise in Teilkomponenten/Hooks zerlegen, ohne Verhalten zu ändern (keine Funktion entfernen). | `src/components`, `src/app` | L | code-simplification, incremental-implementation |
| C-2 | `requireApiAdmin` gibt bei DB-Fehler `profileError.message` an den Client zurück (interne Details). Generische Meldung + Sentry-Log. | `src/lib/api-guard.ts:102` | S | security-and-hardening, observability-and-instrumentation |

### Niedrig

| ID | Befund | Ort | Aufwand | Skill |
|---|---|---|---|---|
| U-1 | Admin nutzt ~10 hart codierte Tailwind-Farben statt Tokens (Prinzip 9). App sauber (Hex-Werte nur in Icon-Generatoren und MapLibre-Paint, dort technisch nötig). | `admin/app`, `admin/components` | S | frontend-ui-engineering |
| U-2 | Vorbereitung native App: Externe Navigation ist gekapselt (`providers/navigation`), Safe-Area wird genutzt. Offen ist eine Entscheidung zur Verpackung (Capacitor vs. TWA/PWA-Store). Das ist eine Produktentscheidung, kein Code-Fix; ADR in `DESIGN_DECISIONS.md` vorbereiten. | `docs/` | S | documentation-and-adrs, idea-refine |
| U-3 | Offene Punkte aus `docs/design/ux-problems.md` mit dem Skill `/mobile-check` gegen die aktuellen Screens abgleichen (Status je Problem nachziehen). | `docs/design/` | M | frontend-ui-engineering, browser-testing-with-devtools |
| Q-2 | 5 Stellen mit `any`/`@ts-ignore`/`eslint-disable`, 9 `console.*`-Aufrufe in `src/`. Einzeln prüfen, wo möglich typisieren bzw. auf Sentry umstellen. | `src/`, `admin/` | S | code-review-and-quality |
| Q-3 | `CONSTRAINTS.md` fehlt: Qualitätsschwellen (z. B. „keine neuen Suppressions“, Mindestabdeckung `src/lib`) sind nicht schriftlich fixiert. | Repo-Root | S | constraint-driven-development |

### Positiv (beibehalten)

- Klare Trennung `raw` → `core` → `enrich`; Importer berühren `enrich.*` nur über `on conflict do nothing`. Manuelle Ladepunkte bekommen keine Auto-Bewertung.
- Alle API-Routen haben Login + Rate-Limit (`requireApiUser`/`requireApiAdmin`), der Cron-Endpunkt prüft `CRON_SECRET`.
- Keine Secrets im Code gefunden; `.env.local` ist ignoriert, `.env.example` ist aktuell.
- Provider sind über Adapter gekapselt (`src/lib/providers/*`).
- Sentry ist optional und kostenlos betreibbar.

## Skills und betroffene Projektteile

| Skill | Profitierender Projektteil | Befunde |
|---|---|---|
| security-and-hardening | Next-Version, Header, RLS, API-Guards, Admin | S-1, S-2, S-3, C-2 |
| source-driven-development | Lizenzprüfung OCM/BNetzA/RIPREE, Next-16-Doku vor Änderungen | D-1, S-2 |
| test-driven-development | `src/lib`, `admin/lib`, `ingest/` | D-2, D-3, D-4, T-1, T-2 |
| ci-cd-and-automation | `.github/workflows` | Q-1, D-4 |
| performance-optimization | `charge_points_in_bbox`, Kartenexplorer | P-1 |
| code-simplification | Routenplaner, Kartenexplorer, Profil-Actions | C-1 |
| incremental-implementation | Zerlegung großer Komponenten in kleinen Schritten | C-1 |
| code-review-and-quality | Review jedes Commits dieser Optimierung | Q-2, alle |
| constraint-driven-development | Qualitätsvertrag `CONSTRAINTS.md` | Q-3 |
| documentation-and-adrs | `data-sources.md`, `DESIGN_DECISIONS.md` | D-1, U-2 |
| frontend-ui-engineering | Admin-Tokens, Mobile-UX | U-1, U-3 |
| browser-testing-with-devtools | UI-Verifikation (setzt Chrome-DevTools-MCP voraus; alternativ eingebauter Browser) | U-3 |
| observability-and-instrumentation | Fehlerpfade in API-Routen/Imports → Sentry | C-2, Q-2 |
| debugging-and-error-recovery | bei Fehlschlägen während der Umsetzung | – |
| deprecation-and-migration | Next-Update, Registry-Migration, alte SQL-Overloads | S-1, D-2 |
| api-and-interface-design | Fehlerformat der API-Routen vereinheitlichen | C-2 |
| shipping-and-launch | Release-Checkliste vor Merge/Prod-`db push` | alle Migrationen |
| git-workflow-and-versioning | ein Commit pro Thema, Branch-Hygiene | alle |
| planning-and-task-breakdown | Reihenfolge Phase 2+ | – |
| doubt-driven-development | Gegenprüfung bei Lizenz- und Prioritätsänderungen (irreversibel in Prod) | D-1, D-2 |
| context-engineering | CLAUDE.md-Ergänzung (Phase 0) | erledigt |
| spec-driven-development | nur falls U-2 (native App) beauftragt wird | U-2 |
| idea-refine / interview-me | Produktentscheidung Store-Verpackung | U-2 |
| using-agent-skills | Meta-Skill zur Auswahl | – |

## D-1 Lizenzrecherche (2026-10-03)

| Quelle | Ergebnis | Kommerziell nutzbar | Beleg |
|---|---|---|---|
| Bundesnetzagentur Ladesäulenregister | CC BY 4.0, Namensnennung erforderlich | ja | [Impressum Ladesäulenregister](https://www.bundesnetzagentur.de/impressum-lsr); in OCM als Provider 29 „CC-BY 4.0“ |
| RIPREE (MITECO, Spanien) | CC BY 4.0 laut Katalogeintrag datos.gob.es, Herausgeber MITECO; Download-URL identisch mit unserem Importer | ja | [datos.gob.es e05068001](https://datos.gob.es/es/catalogo/e05068001-puntos-de-recarga-de-vehiculos-electricos) |
| IRVE (data.gouv.fr) | Licence Ouverte (Etalab), bereits korrekt in Registry | ja | – |
| Open Charge Map (eigene Beiträge, Provider 1) | CC BY 4.0 (nicht ODbL, wie in der Registry steht) | ja | [OCM-Ankündigung 2022](https://community.openchargemap.org/t/announcing-our-new-simpler-data-license-for-ocm-data-cc-by-4-0-international/565) |
| Open Charge Map (importierte Provider) | Lizenz **je Datenanbieter**; OCM schreibt ausdrücklich, dass der Nutzer die Lizenz pro Ladepunkt prüfen muss | gemischt | OCM-Referenzdaten `/v3/referencedata` → `DataProviders[].License` |

**Problemfall OCM-Provider 26 „Oplaadpalen.nl“:** Lizenz CC BY-NC-SA 3.0 (nicht kommerziell). Live-Abfrage der OCM-API (2026-10-03) in unseren Importländern: NL 7.045, DE 307, BE 120, CH 108, AT 67, FR 24, IT 4, zusammen **≈ 7.675 Ladepunkte**. Weil der Import nicht nach Provider filtert, landen diese Daten aktuell in `core.charge_point`. Das verletzt die harte Regel 3.

Weitere Provider mit unklarer Lizenz (kein Treffer in unseren 7 Ländern, aber ohne Filter jederzeit möglich): 7 Mobie.pt („redistributed by agreement“), 25 ICAEN („General public data“), 15 CarStations (`IsOpenDataLicensed = false`), sowie alle Provider ohne Lizenzangabe.

**Vorgeschlagene Umsetzung (wartet auf Freigabe):**
1. Allow-Liste kommerziell nutzbarer OCM-Provider (CC BY, CC0, OGL, Etalab, gemeinfrei) in `ingest/import_ocm.py` und `src/app/api/cron/ocm-import/route.ts`; alles andere wird beim Import übersprungen und gezählt.
2. Migration: bereits importierte OCM-Ladepunkte nicht freigegebener Provider auf `is_active = false` setzen (nicht löschen, `enrich.*` bleibt unberührt). Prod erst nach `db push`-Freigabe.
3. `core.source_registry` korrigieren: BNetzA und RIPREE `license = 'CC BY 4.0'`, `commercial_use = true`, `attribution_required = true`; OCM `license = 'CC BY 4.0 (OCM-Beiträge); importierte Provider je eigene Lizenz, gefiltert'`.
4. Namensnennung für BNetzA/RIPREE in `docs/LIZENZEN.md` und auf der Legende-/Impressum-Seite prüfen.

## Vorschlag Reihenfolge Phase 2+

1. **S-1** Next 16.3.8 (App + Admin) → Build/Lint/Test.
2. **Q-1** CI-Pipeline, damit alle folgenden Commits automatisch geprüft werden.
3. **D-2** Prioritäten-Migration mit Test, dann **D-1** Lizenzklärung. D-1 braucht deine Recherche-Freigabe bzw. Entscheidung zu RIPREE/BNetzA und gegebenenfalls einen OCM-Filter.
4. **S-2** Security-Header (CSP zuerst Report-Only), **S-3** RLS auf `core`/`raw`.
5. **D-3**, **D-4**, **T-1**, **T-2**: Tests und expliziter Admin-Schutz.
6. **C-2**, **Q-2**, **Q-3**, **P-1**, danach **C-1** schrittweise.
7. **U-1** bis **U-3**.

Migrationen werden nur lokal angewendet; `db push` nach Prod erst nach deiner ausdrücklichen Freigabe (CLAUDE.md, Falle 4).
