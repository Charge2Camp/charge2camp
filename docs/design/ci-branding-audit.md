# CI/Branding-Audit — charge2camp

Stand: 2026-09-25. Phase 7 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §8–§11). Gemäß
[design-strategy.md](design-strategy.md) Abschnitt 1: **Prüf- und
Vervollständigungsaufgabe**, keine Neuentwicklung. Das bestehende Logo/
Designkonzept (`docs/design/brand-guide.md`, `docs/design/tokens.json`,
`public/logo/*`) ist die verbindliche Ausgangsbasis (Brief-Ergänzung vor
§8, §8.1–§8.3, §8.14: Markenidentität hat höchste Priorität vor
Referenz-Apps oder Trends).

---

## 1. Logo-System (§8.4)

| Gefordert | Vorhanden | Bewertung |
|---|---|---|
| Primärlogo (mit Wortmarke) | `public/logo/wordmark.svg` | ✅ vorhanden |
| Symbol/Mark (nur Zeichen) | `public/logo/icon-dark.svg`, `icon-light.svg` | ✅ vorhanden, in zwei Kontrast-Varianten |
| App Icon | `src/app/icon.svg`, `apple-icon.tsx`, `icon-192.png`, `icon-512.png`, `maskable-icon-512.png` | ✅ vollständig, inkl. Android-Maskable-Variante |
| Negative Version (dunkler Hintergrund) | `icon-light.svg` ("Auf dunklen Fotos und Farbflächen", brand-guide.md §2) | ✅ vorhanden, andere Bezeichnung als im Brief |
| Helle Version | `icon-dark.svg` (Standard, für helle/dunkle Flächen laut Tabelle — Bezeichnung ist gegenläufig zum Dateinamen, s. u.) | ✅ inhaltlich vorhanden |
| **Kompaktlogo** (kleinere Darstellungen) | `favicon.svg` ("ab 32 px abwärts, reduzierte Zeichnung", brand-guide.md §2) deckt dies teilweise ab | ⚠️ kein eigenständig benanntes "Kompaktlogo" — Rolle wird von `favicon.svg` mitübernommen |
| **Monochrome Version** (einfarbig) | nicht vorhanden | ❌ Lücke |

**Namensverwirrung (kein Funktionsproblem, aber dokumentationswürdig):**
`icon-dark.svg` heißt "dark", wird aber laut brand-guide.md-Tabelle als
Standard auf hellen **und** dunklen Flächen verwendet, während
`icon-light.svg` speziell für dunkle Fotos/Farbflächen gedacht ist. Die
Namen beziehen sich vermutlich auf die *Farbe des Zeichens selbst*
(dunkles vs. helles Icon), nicht auf den Hintergrund — sollte in
brand-guide.md einmal explizit klargestellt werden, um Verwechslung bei
zukünftiger Verwendung zu vermeiden.

**Lücke Monochrome Version:** Für Anwendungsfälle, die laut §8.4
ausdrücklich eine einfarbige Version verlangen (z. B. Stempel/Gravur-artige
Reproduktion, Ein-Farb-Druck), existiert keine eigene Datei. Da `icon-dark.svg`
vermutlich bereits einfarbig aufgebaut ist (nur Kontur, kein Farbverlauf,
laut brand-guide.md "keine Effekte, kein Schatten"), ist zu prüfen, ob es
diese Anforderung bereits erfüllt, bevor eine neue Datei erstellt wird.

## 2. App Icon (§8.5, §9)

Bereits laut architecture.md "bereits umgesetzt" (2026-09-23) markiert.
Abgleich gegen die konkreten Anforderungen aus §9:

| Anforderung | Bewertung |
|---|---|
| Funktioniert ohne Text | ✅ (Symbol, keine Wortmarke im App Icon) |
| iOS eindeutig erkennbar | ⚠️ nicht visuell verifiziert (kein Gerätetest in diesem Audit) |
| Android funktioniert | ✅ `maskable-icon-512.png` vorhanden (Android-Icon-Maskierung berücksichtigt) |
| Funktioniert bei 29–64 px | ⚠️ nicht separat verifiziert |
| App-Store-/Social-Media-/Instagram-tauglich | ⚠️ nicht verifiziert — keine dedizierten Exportgrößen für Store-Listing/Social Media im Repo gefunden |

**Einordnung:** Kein Hinweis auf ein überladenes Icon (Symbol ist laut
brand-guide.md bewusst reduziert: Ladesäule + Wohnwagen + Deichsel, klare
Silhouette). Die drei ⚠️-Punkte sind **Prüfaufgaben, keine bekannten
Mängel** — sie erfordern visuelle Kontrolle auf echten Geräten/in
Store-Vorschauen, was in einer reinen Code-Analyse nicht möglich ist.

## 3. Marken-/App-Konsistenz (§8.6)

Geprüft: Verwendet App Icon, UI-Farbwelt und Logo dieselbe Quelle?

- App Icon (`icon.svg`) und UI-Farbtokens (`globals.css`) referenzieren
  beide dieselben Marken-Grundfarben (`--c-base` `#0F3B36`, `--c-action`
  `#C6F24E`) — **keine Abweichung gefunden** (die im Brief als Negativbeispiel
  genannte Situation "Logo A / App Icon B / UI-Farbwelt C" liegt nicht vor).
- Die Ladeanimation (`brand-guide.md` §10, `loader.svg`) nutzt dieselbe
  Symbolik (Ladesäule → Deichsel → Wohnwagen) wie das Logo selbst — konsistent.

**Ergebnis:** Marke und App sind bereits als ein System erkennbar. Kein
Handlungsbedarf in diesem Punkt.

## 4. Farbwelt (§10) — Rollen-Mapping

Der Brief fordert eine bestimmte Rollen-Nomenklatur (Primary, Secondary,
Accent, Background, Surface, Text Primary, Text Secondary, Border,
Success, Warning, Error, Info, Charging Status, Availability, Caravan
Suitability). Das bestehende System verwendet andere, produktspezifischere
Namen. Mapping:

| Brief-Rolle | Bestehender Token | Deckung |
|---|---|---|
| Primary | `--c-base` | ✅ |
| Accent | `--c-action` | ✅ |
| Secondary | `--c-route` | ✅ (dient zugleich als "positive Zustände") |
| Background | `--c-surface` | ✅ |
| Surface (Karten) | `--c-card` | ✅ |
| Text Primary | `--c-text` | ✅ |
| Text Secondary | `--c-text-muted` | ✅ (aber s. UX-05.1: im Code oft umgangen) |
| Border | `--c-line` | ✅ |
| Charging Status | `--c-status-free/busy/down/unknown` | ✅ |
| Caravan Suitability | 5 Zustände in `trailer-verdict.ts` (`TRAILER_PIN_COLORS`) | ✅ dokumentiert in brand-guide.md §7 |
| Availability | deckt sich mit Charging Status (frei/belegt) | ✅ kein separater Token nötig |
| **Success** | `--c-route` (Doppelrolle: Route-Farbe UND "positive Zustände") | ⚠️ funktioniert, aber ohne eigenen semantischen Namen |
| **Warning** | `--c-status-busy` (`#E8A33D`) wird für Ladepunkt-Status verwendet, aber **kein allgemeiner Warning-Token für z. B. Formularhinweise** | ❌ Lücke |
| **Error** | **kein Token vorhanden** — Formulare verwenden hart codiertes Tailwind-Rot (`text-red-600`, u. a. `vehicle-form.tsx:252`, `login/page.tsx:77`) | ❌ Lücke, verstößt gegen §10-Regel "Keine Farben direkt in einzelnen Komponenten hart codieren" |
| **Info** | kein Token vorhanden, kein erkennbarer Bedarf im aktuellen UI gefunden | ❌ Lücke (geringe Priorität) |

**Konkreter, bereits belegter Verstoß gegen §10:** `text-red-600` in
Formularfehlermeldungen ist echtes hartcodiertes Rot außerhalb des
Tokensystems — dasselbe Muster wie UX-05.1 (ux-problems.md), hier aber
funktional (Fehlerfarbe), nicht nur kosmetisch (gedämpfter Text). Bewertung
als eigener Punkt **UX-07.1**, da Fehlerzustände sicherheitsrelevanter
sind als gedämpfter Text (Nutzer muss Fehler zuverlässig als Fehler
erkennen, auch bei Farbsehschwäche — brand-guide.md §9 "Farbe nie als
einziger Informationsträger" ist hier ebenfalls zu prüfen: aktuell **kein**
Icon/Symbol begleitet die roten Fehlermeldungen).

**Empfehlung für Phase 8 (Design Tokens):** `--c-error` und `--c-warning`
als neue, allgemeine Tokens ergänzen (getrennt von den bereits
Ladepunkt-spezifischen `--c-status-*`-Farben, da diese eine andere Rolle
haben — Ladestatus vs. Formular-/Systemfehler). `--c-info` nur bei
konkretem Bedarf, nicht vorsorglich.

## 5. Dark Mode (§11) — Konflikt mit bestehender Produktentscheidung

**Der Brief fordert:** Dark Mode von Beginn an mitentwickeln, mit
separaten semantischen Tokens (`background.primary/secondary`,
`surface.primary`, `text.primary/secondary`, `border.default`,
`status.success/warning/error`), keine simple Invertierung.

**Der bestehende Code trifft eine andere, explizit begründete
Entscheidung:** `globals.css` bindet Tailwinds `dark:`-Variante bewusst an
eine nie gesetzte `.dark`-Klasse — Kommentar: *"charge2camp ist EIN festes
Markendesign, kein Hell/Dunkel-Toggle"*. Das ist keine offene Baustelle,
sondern eine dokumentierte, bewusste Entscheidung (Kategorie **D** nach §5
des Briefs).

**Entschieden (2026-09-25): Bei "kein Dark Mode" bleiben.** Der
Markenkontrast (dunkelgrüner Header/Footer/Bottom-Tab-Bar, helle
Produktfläche) ist Teil der Markenidentität selbst (§8.14 des Briefs:
Markenidentität hat Priorität 1, noch vor Designtrends) — ein
UI-weiter Dark Mode würde diesen bewussten Kontrast auflösen oder
dauerhaft doppelt pflegen müssen, ohne einen im Brief genannten
Nutzerbedarf (Lesbarkeit bei Sonne/unterwegs) zu verbessern. Der
Konflikt mit §11 des Briefs wird damit nicht durch eine Umsetzung
aufgelöst, sondern durch eine bewusste, dokumentierte Ausnahme (§5
Kategorie D) — konsistent mit der bereits bestehenden Begründung in
`globals.css`. Die vorhandene technische Vorbereitung
(App-Store-/System-UI-Elemente wie `themeColor`,
`black-translucent`-Statusleiste) bleibt unberührt, betrifft nur
System-Chrome, nicht die Produktfläche.

## 6. Ergebnis

Logo-System, App Icon und Marken-/App-Konsistenz sind größtenteils bereits
brief-konform — nur zwei kleine Lücken (Kompaktlogo-Benennung, Monochrome
Version, beide niedriger Aufwand). Die Farbwelt ist inhaltlich fast
vollständig, mit zwei konkreten neuen Tokens für Phase 8 (`--c-error`,
`--c-warning`) und einem bereits belegten Verstoß gegen die
Hartcodierungs-Regel (UX-07.1, Formularfehler ohne Token **und** ohne
begleitendes Symbol). Der Dark-Mode-Punkt ist kein Lücken-, sondern ein
Entscheidungsthema und wird dem Projektverantwortlichen vorgelegt.
