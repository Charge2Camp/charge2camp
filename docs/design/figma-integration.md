# Figma-Integration — Status

Stand: 2026-09-25. Phase 10 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §23–§27).

**Update 2026-09-25 (später am selben Tag):** Weg B ist eingerichtet.
`.mcp.json` ist konfiguriert, `FIGMA_API_KEY` gesetzt, die Tools
`mcp__figma__get_figma_data` und `mcp__figma__download_figma_images`
sind in dieser Sitzung geladen und erreichbar (per Tool-Suche
verifiziert). Was noch fehlt: eine konkrete Figma-Datei — es existiert
noch keine. Entscheidung: statt selbst (unautorisiert) eine Datei
anzulegen — kann ich technisch ohnehin nicht, MCP-Tools hier sind
lesend (`get_figma_data`, `download_figma_images`), kein Schreibzugriff
auf Figma —, folgt unten ein konkreter Struktur-Vorschlag zum manuellen
Nachbau in Figma, 1:1 an `tokens.json`/`brand-guide.md` ausgerichtet.

**Ergebnis der ursprünglichen Prüfung (§23, wörtlich befolgt — keine
erfundene Verbindung), zum Zeitpunkt vor obigem Update:**

## Was funktioniert

- ~~Nichts im Sinne einer aktiven Figma-Verbindung.~~ Siehe Update oben
  — die Verbindung steht inzwischen, nur die Datei fehlt noch.
- Alle Design-Inhalte, die Figma später abbilden würde, liegen bereits
  strukturiert und maschinenlesbar vor: `docs/design/brand-guide.md`,
  `docs/design/tokens.json`, `docs/design/ci-branding-audit.md`,
  `docs/design/information-architecture.md`, `docs/design/user-flows.md`.
  Das deckt inhaltlich große Teile von Figma-Abschnitt "01 Brand", "02
  Colors", "03 Typography", "05 Design Tokens" ab (§24) — nur eben nicht
  in Figma selbst.

## Was fehlt

1. **Ein Figma-Account.** Wird für jede Variante der Integration benötigt
   (sowohl für Figmas eigenen Dev-Mode-MCP-Server als auch für
   Community-Alternativen per Personal Access Token). Ich kann kein
   Konto für dich anlegen oder Zugangsdaten für dich eingeben — das ist
   eine grundsätzliche Grenze meiner Werkzeuge, unabhängig vom Brief.
2. **Eine laufende MCP-Server-Konfiguration** für Figma in diesem
   Environment. Zwei gängige Wege (Stand meines Wissensstands, nicht
   live verifiziert — bitte bei Einrichtung die aktuelle Figma-
   Dokumentation gegenprüfen):
   - **Figma Dev Mode MCP Server** (offiziell von Figma, läuft lokal aus
     der Figma-Desktop-App heraus): benötigt Figma-Account mit
     Professional-/Organisation-/Enterprise-Plan (Dev Mode ist nicht in
     jedem kostenlosen Plan verfügbar), die Desktop-App muss laufen und
     "Enable Dev Mode MCP Server" muss in den Figma-Einstellungen aktiv
     sein. Kein API-Key nötig, dafür muss Figma parallel offen sein.
   - **Community-MCP-Server** (z. B. auf Basis eines Figma Personal
     Access Tokens, das du selbst in deinem Figma-Account unter
     Einstellungen → Security erzeugst): kostenlos nutzbar auch ohne
     Bezahl-Plan, aber du müsstest den Token selbst erzeugen und mir nur
     so viel davon mitteilen, wie zur Konfiguration nötig ist (Token
     selbst gehört in `.env.local`/eine lokale Umgebungsvariable, nicht
     in den Chat oder ins Repo — analog zu CLAUDE.md Prinzip 5 "keine
     Secrets im Code").
3. **Eine konkrete Figma-Datei**, die als "Charge2Camp Design System"
   dient (neu oder bereits vorhanden — §8.15 des Briefs: falls du bereits
   eine Logo-/Designreferenz-Datei hast, würde ich sie zuerst analysieren,
   auch wenn sie nur als Screenshot vorliegt).

## Welche Alternative existiert

Ohne Figma-Zugriff kann die Arbeit **inhaltlich unverändert** weiterlaufen:
`docs/design/*.md` und `tokens.json` bleiben die einzige Quelle, Phase 11
("Figma Design System erstellen") würde inhaltlich vorweggenommen als
Text-/Token-Dokumentation, ohne die visuelle Figma-Ebene selbst. Sobald
eine Figma-Verbindung steht, lassen sich die bestehenden Tokens 1:1
importieren (keine Nacharbeit an den Grundwerten nötig, da bereits
vollständig und konsistent benannt, s. Phase 8).

---

## Für die Entscheidung nötig

Ich kann diese Phase nicht allein zu Ende bringen — das hängt von zwei
Dingen ab, die nur du bereitstellen kannst: ein Figma-Account (falls noch
keiner existiert) und/oder eine bestehende Logo-/Designreferenz-Datei.

**Entschieden (2026-09-25):** Figma-Account-Einrichtung durch dich
selbst, s. Anleitung unten.

---

## Setup-Anleitung (von dir auszuführen)

Ich kann keinen Account anlegen, keine Zugangsdaten eingeben und keinen
API-Token für dich erzeugen (feste Grenze, unabhängig vom Brief) — die
folgenden Schritte musst du selbst durchführen. Sag mir danach nur,
**welcher Weg** es geworden ist und **dass** die Einrichtung steht (nicht
den Token selbst im Chat teilen).

### Weg A — Figma Dev Mode MCP Server (wenn du Figma Professional/Org/Enterprise hast oder anschaffen willst)

1. Figma-Desktop-App installieren (nicht nur die Web-Version) und
   einloggen.
2. In der Figma-Desktop-App: Einstellungen → "Enable Dev Mode MCP
   Server" aktivieren (Bezeichnung kann je nach Figma-Version leicht
   abweichen — falls nicht auffindbar, in der aktuellen Figma-
   Dokumentation nach "Dev Mode MCP Server" suchen, das ist eine
   verhältnismäßig neue Funktion).
3. Figma-Desktop-App muss beim Arbeiten mit mir **geöffnet und
   eingeloggt** bleiben — der Server läuft lokal aus der App heraus.
4. Danach mir Bescheid geben — ich prüfe dann per Tool-Suche erneut, ob
   der MCP-Server in dieser Umgebung sichtbar wird (das hängt zusätzlich
   davon ab, ob dieses Environment/dieser Host Zugriff auf den lokal
   laufenden Server hat, z. B. bei Cloud-/Remote-Sessions ggf.
   eingeschränkt).

### Weg B — Personal Access Token + Community-MCP-Server (funktioniert auch im kostenlosen Figma-Plan)

1. In deinem Figma-Account: Einstellungen → Security → "Personal access
   tokens" → neuen Token erzeugen (Lesezugriff auf die relevante(n)
   Datei(en) reicht, kein Schreibzugriff nötig, solange nur analysiert
   werden soll).
2. Token **nicht** hier im Chat einfügen. Stattdessen als
   Umgebungsvariable lokal ablegen (analog zu CLAUDE.md Prinzip 5), z. B.
   in `.env.local` oder direkt in der MCP-Server-Konfiguration deines
   Claude-Code-Environments (außerhalb dieses Repos, je nach Setup —
   frag im Zweifel nach, ich kann beim Wo nicht raten).
3. Einen Figma-Community-MCP-Server (z. B. "Framelink" oder
   vergleichbar) gemäß dessen eigener Anleitung mit diesem Token
   einrichten — welcher aktuell empfohlen ist, ändert sich; bitte den
   Namen/die Quelle vor der Einrichtung kurz mit mir gegenprüfen, dann
   suche ich die aktuelle Dokumentation dazu, statt aus dem Gedächtnis
   einen möglicherweise veralteten Namen zu nennen.
4. Danach mir Bescheid geben, ich prüfe erneut per Tool-Suche.

### Weg B, konkretisiert (2026-09-25, per Websuche geprüft statt aus dem Gedächtnis übernommen)

1. Figma → Einstellungen → Security-Tab → "Personal access tokens" →
   neuen Token erzeugen. Empfohlene Berechtigungen: **File content**,
   **File metadata**, **Current user**.
2. `.mcp.json` im Projektstamm wurde bereits angelegt (Server
   `figma`, nutzt das Paket `figma-developer-mcp` über `npx`, liest den
   Token ausschließlich aus der Umgebungsvariable `FIGMA_API_KEY` — der
   Token selbst steht **nicht** in der Datei und wird nicht committet
   ohne dass er in `.gitignore` landet, siehe unten).
3. **Von dir auszuführen:** `FIGMA_API_KEY` als Umgebungsvariable setzen
   (lokal, z. B. in der PowerShell-Session oder dauerhaft in den
   Windows-Umgebungsvariablen) — **nicht** in eine Datei im Repo
   eintragen, **nicht** hier im Chat einfügen.
4. Claude-Code-Sitzung neu starten/neu laden, damit die neue
   `.mcp.json` gelesen wird.
5. Danach Bescheid geben — ich prüfe per Tool-Suche erneut.

**Offene Quellenlage (ehrlich benannt, nicht selbst aufgelöst):** Meine
Recherche fand widersprüchliche Angaben, ob Figmas *offizieller* gehosteter
Remote-MCP-Server (`https://mcp.figma.com/mcp`) Personal-Access-Tokens
akzeptiert oder zwingend OAuth verlangt. Deshalb wurde hier bewusst das
community-basierte `figma-developer-mcp`-Paket gewählt (lokal, per
PAT, gut dokumentiert) statt des offiziellen Remote-Servers — bei
Bedarf später wechselbar, siehe Quellen unten.

### In beiden Fällen

- Falls schon eine Logo-/Designreferenz-Datei existiert (Figma-Link oder
  auch nur ein Screenshot/PDF/Bild), kannst du sie mir unabhängig vom
  MCP-Setup schon jetzt zeigen (§8.15 des Briefs) — das ist kein
  Blocker, der auf die MCP-Einrichtung warten muss.

---

## Vorschlag: Struktur der neuen Figma-Datei "Charge2Camp Design System"

Zum manuellen Nachbau durch dich (ich kann nicht schreibend auf Figma
zugreifen). Ziel: jede Benennung ist identisch zu `tokens.json`, damit
sich Werte später verlustfrei abgleichen lassen (§24: Figma bildet
Tokens ab, ersetzt sie nicht).

### Seiten (Pages)

**Update 2026-09-25:** Figma Free/Starter-Plan begrenzt Design-Dateien
auf 3 Seiten (Nutzerbeobachtung, live geprüft — nicht aus meinem
Wissensstand übernommen; erste Annahme von 2 Seiten war falsch, hier
korrigiert). Struktur entsprechend auf drei Seiten verteilt, Cover
bleibt Teil von Foundations, da Variablen und Text Styles ohnehin
dateiweit gelten, nicht seitengebunden:

1. **01 Foundations** — Cover-Inhalt (Markenclaim aus `brand-guide.md`
   §1, Logo-Varianten aus `assets/logo/*.svg`) als oberster Frame,
   darunter Farben, Typografie, Spacing/Radius, Icons (s.
   Variablen-Vorschlag unten).
2. **02 Components** — Buttons, Filter-Chips, Karten, Formularfelder,
   Kartenpins, Ladeanimation (Standbilder der 5 Timing-Schritte aus
   `brand-guide.md` §10).
3. **03 Screens** — Screen-Entwürfe späterer Phasen (11–14), hier
   erstmal leer anlegen.

### Figma Variables (Collection "tokens")

Eine einzige Variablen-Collection, Modus "Value", Namen exakt wie in
`tokens.json` (Punktnotation → Figma-Gruppen über `/`):

**Color** (Type: Color, 1:1 aus `tokens.json` → `color.*`):

| Figma-Variable | Hex |
|---|---|
| `color/base` | #0F3B36 |
| `color/baseDeep` | #0A2A26 |
| `color/baseSoft` | #1A5049 |
| `color/action` | #C6F24E |
| `color/actionHover` | #B2DE3A |
| `color/route` | #1D9E75 |
| `color/surface` | #F2F0E8 |
| `color/card` | #FDFCF9 |
| `color/line` | #E0DED4 |
| `color/tintTrailer` | #E8F5C0 |
| `color/text` | #0F3B36 |
| `color/textMuted` | #5C6B66 |
| `color/textInverse` | #F2F0E8 |
| `color/textInverseMuted` | #8FA8A0 |
| `color/statusFree` | #1D9E75 |
| `color/statusBusy` | #E8A33D |
| `color/statusDown` | #B4443A |
| `color/statusUnknown` | #8E9A94 |
| `color/error` | #B4443A |
| `color/warning` | #E8A33D |

**Number** (Type: Number, aus `tokens.json` → `spacing.*`, `radius.*`,
`fontSize.*`, `tapTargetMin`):

- `spacing/1..16`: 4, 8, 12, 16, 24, 32, 48, 64
- `radius/control` 10, `radius/card` 12, `radius/pill` 999
- `fontSize/display` 36, `h1` 26, `h2` 20, `body` 15, `small` 13,
  `label` 12
- `tapTargetMin` 44 (§8 des Projekt-Prinzips 8 in `CLAUDE.md` —
  Mobile/Touch)

**Text Styles** (kein Variablen-Typ in Figma, separat als Text Styles
anlegen, benannt nach Rolle aus `brand-guide.md` §4): `Display`, `H1`,
`H2`, `Body`, `Small`, `Label` — Font Manrope 700 für Display/H1, Inter
400/500 für den Rest, Line-Height wie in der Tabelle dort.

### Reihenfolge zum Anlegen

1. Variablen-Collection "tokens" mit obigen Color-/Number-Variablen.
2. Text Styles daraus ableiten (referenzieren die Number-Variablen für
   Größe, wo Figma das erlaubt).
3. Auf Seite "01 Foundations" Swatches/Beispielframes je Rolle, mit
   Variable verknüpft (nicht als Hex hart codiert) — sonst genau der
   Fehler, den die Token-Migration in Phase 9 im Code gerade behoben
   hat (s. `docs/DESIGN_DECISIONS.md`), nur in Figma.
4. Erst danach Components (Seite 02) bauen, die diese Styles/Variablen
   referenzieren.

Sobald die Datei existiert, mir Dateilink oder `fileKey` (aus der URL
`figma.com/design/<fileKey>/...`) geben — dann kann ich sie per
`get_figma_data` auslesen und gegen `tokens.json` abgleichen.
