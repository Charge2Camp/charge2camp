# Charge2Camp Design System

Stand: 2026-09-25. Phase 15 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §28). Konsolidierende
Referenz — fasst zusammen, was in [brand-guide.md](design/brand-guide.md),
[tokens.json](design/tokens.json) und dem tatsächlichen Code bereits
existiert, statt Inhalte zu duplizieren. Bei Widerspruch zwischen dieser
Datei und dem Code gilt der Code (dieses Dokument kann veralten, die
Quellen unten sind maschinenlesbar/verbindlich).

---

## 1. Designprinzipien

- **Anhängertauglichkeit vor Kürze.** Kernversprechen der Marke
  (CLAUDE.md Prinzip 7): "passe ich da rein?" hat Vorrang vor einem
  minimal kürzeren Umweg.
- **Ehrlich statt optimistisch.** Standardzustand neuer Einträge ist
  "ungeprüft", nie "tauglich" (brand-guide.md §7). Fehlende Funktionen
  (z. B. Meldestatus-Benachrichtigung) werden benannt statt verschwiegen
  (s. `docs/DESIGN_DECISIONS.md`, UX-05.7).
- **Ruhig, sachlich, kontraststark.** Lesbar bei Sonne, mit Handschuhen,
  am Straßenrand (brand-guide.md §1). Keine Ausrufezeichen, keine
  überladene Tonalität (§8).
- **Bestehendes System ist Grundlage, nicht Entwurf.** Neue Farben/Abstände
  ordnen sich in bestehende Rollen ein, statt neue zu erfinden
  (design-strategy.md, Leitplanke 1). Token fehlt für eine echte neue
  Rolle → Token ergänzen und dokumentieren (nicht Hex/Opazität hart
  codieren, s. CLAUDE.md Prinzip 9).
- **Kein UI-weiter Dark Mode.** Fester Markenkontrast (dunkles
  Header/Footer/Tab-Bar-Grün, helle Produktfläche) ist Teil der
  Markenidentität selbst, kein fehlendes Feature (s.
  `docs/DESIGN_DECISIONS.md`, "Kein UI-weiter Dark Mode"). `dark:*`-Klassen
  im Code sind entsprechend totes Markup, wo sie noch vorkommen.
- **Inkrementell, mit Vorher/Nachher-Vergleich.** Keine große
  unkontrollierte Neuentwicklung; jede größere Änderung: sichern,
  isolieren, testen, visuell vergleichen (Brief §34).

## 2. Farben

Siehe [brand-guide.md §3](design/brand-guide.md#3-farbe) für die
vollständige, verbindliche Rollentabelle. Kurzfassung:

| Rolle | Token | Hex |
|---|---|---|
| Basis (Header, Text, dunkle Flächen) | `--c-base` | #0F3B36 |
| Aktion (Buttons, aktive Filter) | `--c-action` | #C6F24E |
| Route/Fortschritt/positiv | `--c-route` | #1D9E75 |
| Fläche | `--c-surface` | #F2F0E8 |
| Karte | `--c-card` | #FDFCF9 |
| Trennlinie | `--c-line` | #E0DED4 |
| Formular-/Bedienelement-Rahmen | `--c-line-strong` | #CFCCC0 |
| Gedämpfter Text | `--c-text-muted` | #5C6B66 |
| Formularfehler | `--c-error` | #B4443A |
| Warnhinweis (Fläche) | `--c-warning` | #E8A33D |
| Warnhinweis (Fließtext) | `--c-warning-text` | #B45309 |

Zwei harte Regeln (brand-guide.md §3): Lime = "antippbar"/"Drive-Through",
nie beides uneindeutig auf einem Screen; Farbe steht nie allein, immer mit
Text/Symbol. Textfarbe auf Anhängertauglichkeits-Badges: zentral über
`TRAILER_PIN_TEXT_CLASS`/`TRAILER_PIN_TEXT_HEX`
(`src/lib/trailer-verdict.ts`) geregelt, nicht pro Stelle einzeln
entscheiden (s. `docs/DESIGN_DECISIONS.md`).

## 3. Typografie

Siehe [brand-guide.md §4](design/brand-guide.md#4-typografie). Manrope 700
für Überschriften, Inter 400/500 für Fließtext/UI/Zahlen. Größentabelle
und Zeilenhöhen dort verbindlich, ebenso in `tokens.json` (`fontSize`,
`lineHeight`, `fontWeight`) maschinenlesbar hinterlegt.

## 4. Tokens

[tokens.json](design/tokens.json) ist die maschinenlesbare Quelle,
gespiegelt in `src/app/globals.css` als CSS-Variablen (`--c-*`) und
Tailwind-`@theme`-Mapping (`--color-*`, ergibt Klassen wie `text-error`,
`border-line-strong`). Kategorien: `color`, `font`, `fontSize`,
`fontWeight`, `lineHeight`, `spacing` (4er-Raster), `radius`, `border`,
`shadow` (bewusst `none`), `icon`, `animation` (Ladeanimation-Timing),
`tapTargetMin` (44px).

**Regel (CLAUDE.md Prinzip 9):** fehlt ein Token für eine tatsächlich
neue, wiederkehrende Rolle → Token ergänzen und in `tokens.json` +
`brand-guide.md` dokumentieren (Beispiel: `--c-line-strong`, ergänzt
Phase 12, s. `docs/DESIGN_DECISIONS.md`). Keine Opazitäts-/Hex-Variante
direkt im Code erfinden.

## 5. Komponenten & States

**Ehrlicher Ist-Zustand:** Der Design-Brief (§14) verlangt eine formale,
wiederverwendbare UI-Komponentenbibliothek (Button, Icon Button, Card,
Badge, Input, Select, Toggle, Modal, Toast, Empty State, Error State,
…). Seit Phase 16 gibt es einen ersten Satz echter Primitives in
`src/components/ui/` — bewusst mit der kleinen, hochfrequenten Basis
begonnen (§34 des Briefs: inkrementell), nicht alle ~20 Typen auf
einmal:

- **`Button`** (`src/components/ui/button.tsx`) — Varianten `primary`
  (`bg-action`), `secondary` (`border-line-strong`), `destructive`
  (`bg-error`, gefüllt), `destructive-outline` (`border-error/30`,
  Text), `route-outline` (`border-route`, Text), `plain` (nur
  `hover:underline`, Textfarbe kommt vom Aufrufer), `ghost`
  (`text-text-muted hover:bg-black/5`, für Icon-Only-Buttons ohne
  Rahmen). Größen `sm`/`md`/`link`. `iconOnly` für 44×44px-Icon-Buttons,
  `iconShape` `"square"` (Standard, `rounded-md`) oder `"circle"`
  (`rounded-full`, für freischwebende Bedienelemente über Karten/
  Bottom-Sheets). `type="button"` als sicherer Default (`type="submit"`
  explizit angeben).
- **`Card`** (`src/components/ui/card.tsx`) — Varianten `default`
  (`rounded-md border-line p-3`), `emphasis` (`rounded-lg p-4`),
  `tint-route`/`tint-warning` (getönte Hinweisflächen). Nutzt
  `border-line`, nicht das ursprünglich verbreitete hartcodierte
  `border-black/10` — mittlerweile bis auf eine bewusste Ausnahme
  (`route-wizard-tabs.tsx`, eigenes Zustandssystem) vollständig
  migriert, s. `docs/DESIGN_DECISIONS.md`.
- **`Badge`** (`src/components/ui/badge.tsx`) — generische Varianten
  `outline`/`filled`/`route`/`error`. Deckt NICHT die
  Anhängertauglichkeits-Pins (`TRAILER_PIN_COLORS`/`_LABELS`/
  `_TEXT_CLASS`, `src/lib/trailer-verdict.ts`) oder `ReviewStateBadge`
  ab — die haben eigene, feste Domänen-Semantik und bleiben bewusst
  eigenständig (§3 brand-guide.md: "Jede Farbe hat genau eine Rolle").
- **`Input`/`Select`/`Textarea`/`Field`** (`src/components/ui/input.tsx`)
  — das mit Abstand konsistenteste Altmuster im Code (ein Klassenstring
  an ~50 Stellen identisch wiederholt), jetzt eine echte Komponente.
  `Field` kapselt den Label-Wrapper (`flex flex-col gap-1 text-sm`).
  `Input` ist `forwardRef`-fähig (für bestehende Refs wie den
  nicht-passiven `wheel`-Listener in `route-planner-form.tsx`).
- **`Modal`** (`src/components/ui/modal.tsx`) — Sheet auf Mobile,
  zentriertes Panel ab `sm:`, Kopfzeile mit Titel + Ghost-Schließen-
  Button, scrollbarer Inhaltsbereich mit Safe-Area-Padding. Deckt nicht
  jeden Dialog ab — `nearby-charging-modal.tsx` hat eine abweichende
  feste Höhe (Kartenausschnitt) und bleibt bewusst eigenständig.

Über mehrere Runden migriert (Details je Runde in
`docs/DESIGN_DECISIONS.md`): alle fünf öffentlichen Auth-/Startseiten,
die meisten Profil-Formulare, die Bewertungsformulare (inkl. Inline-
Bearbeitung), `route-planner-form.tsx` (größte Einzeldatei), fünf
Dialoge auf `Modal` umgestellt, alle bekannten Icon-Only-Button-
Fundstellen (`square`/`circle`).

**Geprüft und bewusst NICHT gebaut (Phase 16, 2026-09-26):** Toast,
Progress, Toggle existieren im Code schlicht nicht — nirgends verwendet,
kein Muster zum Extrahieren. Checkboxen sind durchgängig unstylisierte
native `<input type="checkbox">` ohne eigenes wiederkehrendes
Klassenmuster (42 Fundstellen geprüft) — eine `Checkbox`-Komponente
würde hier ein neues visuelles Design erfinden, nicht bestehendes
konsolidieren. `Slider` existiert einmal, bereits als lokale Komponente
(`SocSlider` in `route-planner-form.tsx`, 5-fach intern wiederverwendet)
— für den Umzug nach `ui/` fehlt ein zweiter, unabhängiger
Einsatzort. Ein separates `EmptyState`-Primitive wäre eine dünne
Wrapper-Komponente um einen einzelnen `<p className="text-sm
text-text-muted">`-Absatz (bereits durchgängig konsistent, s.
`docs/design/ux-problems.md`, Phase 5) — kein echter
Konsolidierungsgewinn. Neue Komponenten ohne belegten, wiederkehrenden
Bedarf zu bauen widerspräche CLAUDE.md ("keine Abstraktion für
hypothetische künftige Anforderungen") — dieser Teil der
Komponentenbibliotheks-Arbeit gilt damit als abgeschlossen, nicht als
offen liegen gelassen. "Bottom Sheet" bleibt die einzige echte
Restlücke: `station-bottom-sheet.tsx` ist bereits eine funktionierende,
eigenständige Sheet-Implementierung (Drag-Gesten, Snap-Punkte) — eine
generische `ui/`-Version wäre eine grössere Neuentwicklung, kein
Extraktionsschritt, und braucht einen zweiten Einsatzort, um sich zu
lohnen.
- **Gespann-Panel:** wiederverwendete Komponente
  `src/components/gespann-panel.tsx` (Fahrzeug+Wohnwagen-Auswahl,
  identisch im Routenplaner und auf `/profil/gespann`) — bereits vor
  Phase 16 extrahiert, unabhängig von den `ui/`-Primitives.
- **Leerzustände:** durchgängig vorhanden und konsistent formuliert
  ("Noch keine Route gespeichert…", s. `docs/design/ux-problems.md`,
  Phase 5 bestätigt kein Problem).
- **Zustandssysteme:** wo tatsächlich mehrstufig (z. B.
  `route-wizard-tabs.tsx`: aktiv/erreichbar/nicht erreichbar), bewusst
  eigene Opazitätsstufen statt eines einzelnen Tokens — dokumentiert in
  `docs/DESIGN_DECISIONS.md` ("Phase 9 Rest").

## 6. Navigation

Siehe [information-architecture.md §2](design/information-architecture.md)
für das vollständige Navigationsmodell. Kurzfassung: Bottom-Tab-Bar
(< md, 5 Slots: Home/Camping/Laden/Route/Profil-oder-Anmelden) und
Header (≥ md, dieselben Links) sind inhaltsgleich. Profil-Sidebar
(Mobile-Overlay) und Profil-Sub-Nav (Desktop, inline) sind ebenfalls
inhaltsgleich, bis auf Impressum/Datenschutz/Logout (dafür existiert am
Desktop der reguläre Footer). Community bewusst ohne eigenen Tab (5-Tab-
Maximum, brand-guide.md §6).

## 7. Maps (Kartenpins)

Siehe [brand-guide.md §7](design/brand-guide.md#7-kartenpins) für die
Grundregeln. Zentrale Implementierung: `src/lib/trailer-verdict.ts`
(`TRAILER_PIN_LABELS`, `TRAILER_PIN_COLORS`, `TRAILER_PIN_ICON_SRC`,
`getTrailerPinState`) — **einzige Quelle**, an allen Kartenstellen
wiederverwendet (Explorer, Bottom-Sheet, Startseiten-Popup,
Routenübersicht). Fünf Zustände, Skala schlecht→ideal: nicht tauglich
(rot, Kreuz) → bedingt tauglich (amber, Ausrufezeichen) → ohne Abkoppeln
(grün, Haken) → Drive-Through (lime, Pfeil) → ungeprüft (grau,
Fragezeichen). Campingplatz-Pins bewusst andersfarbig (dunkelgrün +
Zelt, `CAMPSITE_PIN_ICON_SRC`), damit beide Pin-Typen auf derselben
Karte unterscheidbar bleiben.

## 8. Charging (Ladepunkte)

Detailseite/Karte zeigen (s. `docs/design/user-flows.md` Flow 2,
`ladepunkte/[id]/page.tsx`): Stammdaten, Anhängertauglichkeits-Badge
(s. Abschnitt 7), Verteilungsgrafik "Eignung nach Gespannlänge"
(`rig-length-distribution.tsx`, fünf Längenklassen, positive Bewertung
größerer Gespanne vererbt sich auf kleinere, negative nicht — s.
`legende/page.tsx`), Community-Bewertungen mit vier strukturierten
Anhängertauglichkeits-Kriterien (genug Platz, freie Rangierfläche, kein
Parkhaus/Schranke, Kabellänge). Betriebsstatus-Hinweis ausdrücklich als
"laut Quelle zuletzt gemeldet", kein Live-Status (ehrlich statt
suggeriert aktuell). Vertrauenswürdigkeit der Angabe (`ReviewState`:
nicht bewertet/Community/geprüft) ist eine von der Anhängertauglichkeit
selbst unabhängige zweite Achse.

## 9. Camping (Campingplätze)

EV-Camping-Score (0–100, `src/lib/scoring/ev-camping-score.ts`,
`EV_SCORE_WEIGHTS`): Ladepunkt direkt auf dem Platz, Ladeleistung vor
Ort, Anzahl Ladepunkte, Nähe zum nächsten Schnelllader,
Community-Bewertungen, Aktualität der Daten. Bewertungsformular fragt
bewusst nur zwei Ja/Nein-Fragen ab (Laden auf dem Platz möglich? Fußläufig
erreichbar?) statt freiem Sterne-Picker — die Sternebewertung wird daraus
abgeleitet (`deriveCampsiteRating()`).

## 10. Routing (Routenplaner)

Siehe [user-flows.md Flow 5](design/user-flows.md) für den vollständigen
Ablauf. Einzige Seite mit Wizard-Charakter (3 Tabs: Eingabe →
Routenübersicht → Zusammenfassung/Speichern), durchbricht bewusst das
sonst durchgängige Liste/Karte→Detail-Muster (design-strategy.md/
information-architecture.md §4). Kernregel: anhängertaugliche Ladestopps
werden aktiv gesucht (Greedy-Ladeplanung im Korridor), `unsuitable` hart
ausgeschlossen — Anhängertauglichkeit vor kürzerer Strecke (CLAUDE.md
Prinzip 7).

## 11. Accessibility

Siehe [brand-guide.md §9](design/brand-guide.md#9-barrierefreiheit).
Kontrast mindestens 4.5:1 (bei der Opazitätsstufen-Migration in Phase 9
aktiv geprüft, s. `docs/DESIGN_DECISIONS.md`), Farbe nie einziger
Informationsträger, sichtbarer Fokusrahmen, `prefers-reduced-motion`
respektiert, Icons mit `aria-label` oder als dekorativ markiert.
Lime-Badge-Kontrast über `TRAILER_PIN_TEXT_CLASS`/`_HEX` sichergestellt
(s. Abschnitt 2).

## 12. iOS / Android

Siehe CLAUDE.md Prinzip 8 und
[architecture.md](architecture.md), Abschnitt "Mobile/Touch-Design &
Vorbereitung auf native Apps": Tap-Ziele ≥ 44px, `text-base` in
Eingabefeldern (kein iOS-Auto-Zoom), kein rein hover-abhängiges
Verhalten, `env(safe-area-inset-*)` für Header/Footer/Vollbild-Dialoge
(gemessen über `safe-area-sync.tsx`, nicht direkt `env()`, wegen eines
bekannten WebKit-/Next.js-Verhaltens bei Standalone-Web-Apps — s.
Kommentar in `layout.tsx`), externe Navigation über Adapter gekapselt.
Bekannte, akzeptierte Einschränkung: ein nicht behebbarer 11px-Abstand
unter der iOS-Home-Screen-Standalone-Ansicht (WKWebView-Größenbegrenzung,
s. Memory/vorherige Sitzungen — nicht weiter verfolgen).

---

## Offene Lücken (ehrlich benannt)

- **§14 UI Component Library** — formale, extrahierte
  Button/Card/Badge/Input/Modal/Toast/…-Primitives existieren nicht,
  nur konsistente informelle Muster (s. Abschnitt 5). Eigener, größerer
  Folgeschritt.
- **UX-05.1/UX-07.1 vollständig erledigt** — `text-black/70` einzeln
  geprüft, `bg-red-*`/`border-red-*`/`text-amber-*` migriert (neue
  Tokens `--c-line-strong`, `--c-warning-text`), Symbol bei
  Formularfehlern ergänzt (`FormError`-Komponente). S.
  `docs/DESIGN_DECISIONS.md`.
- **Figma (Phasen 10/11/13)** — MCP-Verbindung steht
  (`docs/design/figma-integration.md`), Datei selbst noch nicht angelegt.
  Phase 14 (Developer Handoff) gilt davon abweichend als erledigt: der
  eigentliche Zweck (maschinenlesbare, verbindliche Spezifikation für
  Entwickler/Claude Code) ist bereits durch `tokens.json`, dieses
  Dokument und CLAUDE.md Prinzip 9 erfüllt, auch ohne Figma-Export —
  s. `docs/DESIGN_DECISIONS.md`.
- **Echte Meldestatus-Benachrichtigung (UX-05.7)** — aktuell nur
  ehrlicher Hinweis statt echter Push/E-Mail-Funktion.
