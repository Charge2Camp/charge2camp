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
| Warnhinweis | `--c-warning` | #E8A33D |

Zwei harte Regeln (brand-guide.md §3): Lime = "antippbar"/"Drive-Through",
nie beides uneindeutig auf einem Screen; Farbe steht nie allein, immer mit
Text/Symbol. **Bekannter Nebenbefund:** mehrere Lime-Badges im Code
verwenden hellen statt vorgeschriebenem dunklem Text (Kontrastregel §9) —
noch nicht behoben, s. `docs/DESIGN_DECISIONS.md`.

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

**Ehrlicher Ist-Zustand (kein Wunschbild):** Der Design-Brief (§14)
verlangt eine formale, wiederverwendbare UI-Komponentenbibliothek
(Button, Icon Button, Card, Badge, Input, Select, Toggle, Modal, Toast,
Empty State, Error State, …). Diese existiert **noch nicht** als
extrahierte Primitives — Komponenten sind aktuell überwiegend
Datei-lokal mit Tailwind-Utility-Klassen gestylt (Token-Disziplin seit
Phase 9 weitgehend hergestellt, s. `docs/design/ux-problems.md`
UX-05.1, aber keine gemeinsame `<Button>`/`<Card>`/`<Badge>`-Komponente).
Das ist eine offene Lücke, kein Versäumnis dieser Phase — eine echte
Komponentenbibliothek ist ein eigener, größerer Folgeschritt.

Wiederkehrende, bereits konsistente Muster (informell, nicht als
Komponente extrahiert):

- **Buttons:** primär (`bg-action`, dunkler Text, nie heller — Kontrast),
  sekundär (`border-line-strong`, transparenter Hintergrund),
  min-height 44px (`min-h-11`/`min-h-12`).
- **Formularfelder:** `border-line-strong`, `text-base` (kein
  iOS-Auto-Zoom), Fehlermeldung darunter in `text-error`.
- **Badges/Status-Pins:** feste Farbe + Symbol, nie Farbe allein
  (`TRAILER_PIN_COLORS`/`TRAILER_PIN_LABELS`, `REVIEW_STATE_COLORS`, s.
  `src/lib/trailer-verdict.ts` — zentrale, bereits wiederverwendete
  Quelle für alle Anhängertauglichkeits-Zustände).
- **Gespann-Panel:** wiederverwendete Komponente
  `src/components/gespann-panel.tsx` (Fahrzeug+Wohnwagen-Auswahl,
  identisch im Routenplaner und auf `/profil/gespann`) — einziges
  bereits echt extrahiertes, mehrfach verwendetes UI-Primitive.
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
**Bekannter Nebenbefund:** Lime-Badges mit falschem (hellem statt
dunklem) Text an mehreren Stellen — noch offen, s. Abschnitt 2.

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
- **Lime-Kontrast-Verstoß** — mehrere Stellen mit hellem statt dunklem
  Text auf Lime-Badges (s. Abschnitt 2/11).
- **UX-05.1 Rest** — `text-black/70`, `bg-red-*`/`border-red-*`
  bewusst noch nicht migriert (s. `docs/design/ux-problems.md`).
- **Figma (Phasen 10/11/13)** — MCP-Verbindung steht
  (`docs/design/figma-integration.md`), Datei selbst noch nicht angelegt.
  Phase 14 (Developer Handoff) gilt davon abweichend als erledigt: der
  eigentliche Zweck (maschinenlesbare, verbindliche Spezifikation für
  Entwickler/Claude Code) ist bereits durch `tokens.json`, dieses
  Dokument und CLAUDE.md Prinzip 9 erfüllt, auch ohne Figma-Export —
  s. `docs/DESIGN_DECISIONS.md`.
- **Echte Meldestatus-Benachrichtigung (UX-05.7)** — aktuell nur
  ehrlicher Hinweis statt echter Push/E-Mail-Funktion.
