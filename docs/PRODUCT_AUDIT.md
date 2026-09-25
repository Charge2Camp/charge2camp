# Product Audit — charge2camp

Stand: 2026-09-25. Grundlage: vollständige Analyse des bestehenden Repos
(`src/app`, `src/components`, `src/lib`, `docs/`, `supabase/migrations/`),
insbesondere [docs/architecture.md](architecture.md),
[docs/database.md](database.md) und [docs/design/brand-guide.md](design/brand-guide.md).

Dieses Dokument ist die Grundlage für den in
`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf` beschriebenen Prozess
(Phase 1+2 von 16: Analyse + Product Audit). Es beschreibt den **Ist-Zustand**,
keine Vorschläge — Design-/UX-Verbesserungen folgen in einem separaten Schritt
(§5 des Briefs: technisches Problem / UX-Problem / Designproblem / bewusste
Produktentscheidung sind bei jeder Änderung zu unterscheiden).

**Wichtiger Befund vorab:** Anders als der Design-Brief annimmt, existiert
bereits ein ausgearbeitetes Markendesign-System
([docs/design/brand-guide.md](design/brand-guide.md),
[docs/design/tokens.json](design/tokens.json), umgesetzt in
`src/app/globals.css`). Phase 7 (CI/Branding) und große Teile von Phase 8
(Design Tokens) sind faktisch bereits erledigt. Die Arbeit sollte auf diesem
System aufbauen, es nicht neu erfinden.

---

## 4.1 Aktuelle Produktstruktur

Next.js App-Router-Projekt (`src/app`), Bereiche:

| Bereich | Routen | Zweck |
|---|---|---|
| Start | `/` | Landing/Einstieg, `home-actions.tsx`, "Ladepunkte in der Nähe"-Modal — **einziger öffentliche Bereich außer Auth/Recht** |
| Campingplätze | `/campingplaetze`, `/campingplaetze/[id]` | Suche/Liste/Karte, Detailseite mit EV-Camping-Score — **login-pflichtig** |
| Ladepunkte | `/ladepunkte`, `/ladepunkte/[id]` | Suche/Liste/Karte, Detailseite mit Anhängertauglichkeit — **login-pflichtig** |
| Routenplaner | `/routenplaner` | Wizard: Start/Ziel, Fahrzeug/Wohnwagen, Ladeplanung, Routenübersicht — **login-pflichtig** |
| Community | `/community` | Bewertungen/Erfahrungsberichte übergreifend (kein eigener Tab, s. u.) — **login-pflichtig** |
| Profil | `/profil/*` | Hub + Unterseiten: `daten`, `gespann`, `routen`, `favoriten`, `bewertungen`, `einstellungen`, `legende`, `fehlende-saeule` |
| Auth | `/login`, `/register`, `/passwort-vergessen`, `/passwort-zuruecksetzen`, `/auth/callback` | Supabase Auth |
| Rechtliches | `/datenschutz`, `/impressum` | DSGVO/Pflichtangaben |
| Admin/API | `src/app/api/admin/*`, `src/app/api/enrich/*`, `src/app/api/cron/*` | Datenqualität, Anreicherung (Anhängertauglichkeit moderieren, Research-Queue), OCM-Import-Cronjob — kein eigenes Admin-UI außer `admin-button.tsx` (Link, sichtbar wenn `profiles.is_admin`) |
| Öffentliche API | `src/app/api/campsites/*`, `src/app/api/charge-points/*` | Suche/Viewport/Detail, von Client-Komponenten genutzt |

Domain-Logik liegt in `src/lib/**` (Scoring, Routing, Trailer-Verdict,
Provider-Adapter), nicht in den Seiten selbst — entspricht dem in
architecture.md beschriebenen Schichtenmodell (UI → Domain-Logik → Adapter →
Supabase).

**Login-Pflicht für alle Kerninhalte (Sicherheits-Audit):** `/campingplaetze`,
`/ladepunkte`, `/community` und `/routenplaner` verlangen durchgängig ein
Konto (`src/lib/require-user.ts` je Seite, `src/lib/api-guard.ts`
`requireApiUser` je API-Route mit zusätzlichem nutzerbasiertem
Rate-Limit). Nicht eingeloggt wird zu `/login?redirect=…` umgeleitet.
Öffentlich bleiben nur `/`, Auth-Seiten und `/impressum`/`/datenschutz`.
Details und IA-Konsequenzen: [information-architecture.md](design/information-architecture.md).

## 4.2 Aktuelle Navigation

Zwei parallele Navigationsebenen, abhängig von Viewport:

- **Mobil (< md, `bottom-tab-bar-client.tsx`):** 4 Tabs — Home, Camping,
  Laden, Route — plus Profil/Anmelden als 5. Slot. Der `SiteHeader` ist auf
  Mobilgeräten komplett ausgeblendet (`site-header.tsx`); auf schmalen
  Geräten übernimmt der Home-Tab die Rolle des Logos.
- **Desktop (≥ md, `site-header.tsx`):** klassische Kopfzeile mit denselben
  Links plus Profil/Login/Register.

Community ist bewusst **kein** eigener Tab (Begründung in brand-guide.md §6:
"Fünf Tabs sind das Maximum auf schmalen Geräten") — Zugriff läuft über
`/community` direkt bzw. über Profil-Unterseiten. Innerhalb von `/profil`
gibt es eine eigene Sub-Navigation (`profile-sub-nav.tsx`, Layout in
`profil/layout.tsx`) mit 7 Unterseiten.

`admin-button.tsx` ist der einzige sichtbare Einstieg ins Admin-/
Qualitätssicherungs-Tooling — kein eigener Navigationsbereich, nur ein
bedingt sichtbarer Link.

## 4.3 Aktuelle User Flows (Kernwege)

Ausführlich in architecture.md dokumentiert; zusammengefasst:

1. **Routenplanung (Kernflow):** Fahrzeug/Wohnwagen wählen (oder Freitext-
   Maße) → Start/Ziel eingeben (Geocoding via Nominatim) → SOC-Parameter
   einstellen (4 Schieberegler) → Route berechnen (OSRM) → anhängertaugliche
   Ladestopps werden automatisch geplant (Greedy-Verfahren, `unsuitable`
   hart ausgeschlossen) → Routenübersicht mit manueller Kontrolle je Stopp
   (löschen/Alternative wählen) → Straßenrestriktions-Warnungen (OSM,
   Overpass) → Route speichern und/oder Navigation extern starten (Google
   Maps, je Segment oder gesamt).
2. **Ladepunkt-/Campingplatz-Suche:** Liste/Karte mit Filtern → Detailseite
   mit EV-Camping-Score bzw. Anhängertauglichkeits-Badges → Favorisieren
   (Herz-Button, schreibt in `favorites`) → optional "Route hierher planen".
3. **Community-Bewertung:** Auf einer Ladepunkt-/Campingplatz-Detailseite
   bewerten, inkl. strukturierter Anhängertauglichkeits-Kriterien
   (`enough_space_for_rig`, `unobstructed_access`, …) und optional eigenem
   Fahrzeug/Wohnwagen aus dem Profil (füllt Gespannlänge automatisch).
4. **Profil-Setup:** Registrieren → Fahrzeug anlegen (mit Autofill aus
   `vehicle_models`) → Wohnwagen anlegen (Autofill aus `caravan_models`) →
   Zuhause-Adresse hinterlegen (`/profil/daten`).
5. **Fehlende Ladesäule melden:** `/profil/fehlende-saeule` — eigener
   isolierter Flow außerhalb des normalen Bewertungs-/Suchpfads.

## 4.4 Bestehende UX-Probleme (beobachtet, ohne Bewertung der Ursache)

- **Community ist strukturell versteckt.** `/community` existiert als Route,
  ist aber in keiner der beiden Hauptnavigationen (Tab-Bar, Header)
  verlinkt — nur über direkte URL oder ggf. Verweise innerhalb anderer
  Seiten erreichbar. Ob dies eine bewusste Kapazitätsentscheidung (5-Tab-
  Limit, brand-guide.md §6) oder eine Lücke ist, ist zu klären, bevor daran
  etwas geändert wird.
- **`/profil/einstellungen` ist ein reiner Platzhalter** ("noch keine
  App-Einstellungen", laut architecture.md bewusst ohne Scheinfunktion) —
  aus Nutzersicht eine Sackgasse ohne erkennbaren Zweck, solange sie
  sichtbar in der Sub-Navigation steht.
- **Zwei getrennte Eingabewege für Gespannmaße** (hinterlegtes
  Fahrzeug/Wohnwagen aus dem Profil vs. Freitext-Maße) existieren
  parallel an mehreren Stellen (Routenplaner, Bewertungsformular) — für
  nicht angemeldete oder unvollständig eingerichtete Profile potenziell
  verwirrend, da der "einfache" Weg (hinterlegtes Gespann) erst nach
  vollständiger Profil-Einrichtung verfügbar ist.
- **`profil/legende` und `profil/fehlende-saeule`** sind funktional keine
  "Profil"-Inhalte (keine Nutzerdaten, kein Account-Bezug), stecken aber in
  der Profil-Unterseiten-Navigation — Informationsarchitektur-Frage, ob sie
  dort inhaltlich hingehören oder nur technisch dort abgelegt wurden.
  **Update Phase 12 (2026-09-25):** Beim genauen Code-Lesen bestätigt
  sich "kein Account-Bezug" nur für `legende` (verschoben nach
  `/legende`, ohne Login) — `fehlende-saeule` liest tatsächlich
  `user.id`-gefilterte eigene Meldungen, also doch Account-Bezug, bleibt
  unverändert. S. `docs/design/ux-problems.md` UX-05.5,
  `docs/DESIGN_DECISIONS.md`.
- **7 Unterseiten in der Profil-Sub-Navigation** (`daten`, `gespann`,
  `routen`, `favoriten`, `bewertungen`, `einstellungen`, `legende`,
  `fehlende-saeule` — tatsächlich 8) sind für eine mobile mit Daumen
  bedienbare Sub-Navigation viel; ob das noch übersichtlich ist, wurde
  nicht separat getestet.
- **Admin-Zugang ist ein einzelner Link ohne eigene IA.** Für eine
  wachsende Zahl von Qualitätssicherungs-Aufgaben (`quality-report`,
  Trailer-Moderation, Research-Queue) existiert kein zusammenhängendes
  Admin-Navigationskonzept, nur einzelne API-Routen.

## 4.5 Designprobleme (Ist-Zustand vs. brand-guide.md)

Insgesamt hoher Reifegrad: Farbsystem, Typografie, Spacing, Icons,
Kartenpin-Zustände (`src/lib/trailer-verdict.ts`, `getTrailerPinState`) und
Ladeanimations-Spezifikation sind dokumentiert **und** in Tokens/CSS
(`src/app/globals.css`, `docs/design/tokens.json`) umgesetzt. Konkret
beobachtete Lücken:

- **Kein Light/Dark-Toggle, aber `dark:`-Klassen im Code.**
  `globals.css` bindet Tailwinds `dark:`-Variante bewusst an eine nie
  gesetzte `.dark`-Klasse, damit vorhandene `dark:*`-Utility-Klassen im
  Code "tot" bleiben statt einzeln entfernt zu werden (Kommentar in
  globals.css). Das ist ein bewusster Kompromiss, aber technisch weiterhin
  toter Code im Bestand — Umfang nicht separat erfasst.
- ~~Ladeanimation nicht auffindbar~~ **Korrektur (Phase 7):**
  `public/logo/loader.svg` existiert und ist vollständig — die frühere
  Einschätzung war falsch (Suche erfolgte am falschen Pfad). Details:
  [ci-branding-audit.md](design/ci-branding-audit.md).
- **Kein zentrales Component-Library-Verzeichnis.** UI-Bausteine liegen
  fachlich gruppiert (`components/campsites`, `components/charging-stations`,
  `components/map`, `components/profile`, `components/routing`) statt in
  einer wiederverwendbaren, dokumentierten Basis-Komponentenschicht
  (Buttons, Inputs, Cards, Sheets als eigene, testbare Einheiten). Das
  entspricht Phase 9 des Briefs und ist noch nicht begonnen.
- **Kein Figma-Nachweis im Repo.** Der Brief sieht Figma als "Single Source
  of Truth" für visuelle Entscheidungen vor (Phasen 10–11); aktuell ist
  `docs/design/brand-guide.md` + `tokens.json` die einzige Quelle. Beides
  zu parallelisieren erfordert eine Entscheidung, siehe unten.

---

## Offene Entscheidungen vor Phase 3 ff.

1. ~~**Figma ja/nein für den MVP?**~~ **Entschieden (2026-09-25): Ja.**
   Figma wird zusätzlich zu `brand-guide.md`/`tokens.json` als visuelles
   Design System aufgebaut (Phasen 10–14 des Briefs). `brand-guide.md`/
   `tokens.json` bleiben die maschinenlesbare technische Quelle
   (§24/§25 des Briefs: Figma = visuelle Source of Truth, Claude Code =
   technische Source of Truth); Figma-Werte müssen mit den bestehenden
   Tokens übereinstimmen, nicht sie ersetzen. Umsetzung erfolgt in
   Phase 10, entsprechend der Phasenreihenfolge (§33) erst nach Phase 3–9.
2. ~~**Community-Tab**~~ **Entschieden (2026-09-25): So belassen.**
   Kein 6. Tab, kein zusätzlicher Navigationslink — das 5-Tab-Limit
   (brand-guide.md §6) bleibt bewusste Produktentscheidung, keine Lücke.
   `/community` bleibt wie bisher nur über direkte URL bzw. Verweise
   erreichbar.
3. ~~**`/profil/einstellungen`**~~ **Entschieden (2026-09-25): Entfernen,
   bis es echten Inhalt hat.**
   - Zustand: Platzhalter-Seite ohne Funktion, aber sichtbar in der
     Profil-Sub-Navigation (`profile-sub-nav.tsx`).
   - Problem: Sackgasse ohne erkennbaren Nutzen für Nutzer (§4.4).
   - Vorschlag: Link aus `profile-sub-nav.tsx` entfernen; Route/Seite
     selbst bleibt im Code bestehen (kein Datenverlust, keine
     Funktionsänderung), wird nur nicht mehr beworben. Bei Bedarf später
     wieder verlinken, sobald echte Einstellungen existieren.
   - Auswirkung: keine, da die Seite ohnehin keine Funktion hatte.
   - Technische Konsequenzen: keine — reine Navigationsänderung, keine
     Produktlogik betroffen.

Alle drei Punkte sind damit für Phase 3 geklärt.
