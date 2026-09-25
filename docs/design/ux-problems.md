# UX-Probleme und Verbesserungspotenziale — charge2camp

Stand: 2026-09-25. Phase 5 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §33). Konsolidiert
Befunde aus [PRODUCT_AUDIT.md](../PRODUCT_AUDIT.md),
[information-architecture.md](information-architecture.md) und
[user-flows.md](user-flows.md), ergänzt um neue Befunde aus dieser Phase.

**Kategorisierung nach §5 des Design-Briefs**, verbindlich für jeden
Punkt: **A** technisches Problem · **B** UX-Problem · **C** Designproblem ·
**D** bewusste Produktentscheidung. Nur zur Kenntnisnahme/Diskussion —
**keine Umsetzung in dieser Phase**, Priorisierung erfolgt erst in Phase 6
(Designstrategie).

---

## Offene Punkte aus den vorherigen Phasen zuerst geklärt

Die beiden in user-flows.md als "offen" markierten Punkte wurden in dieser
Phase geprüft:

- **Leerzustände existieren durchgängig** und sind konsistent formuliert
  ("Noch keine Route gespeichert…", "Noch keine Favoriten gemerkt.",
  "Noch keine Bewertungen vorhanden.", "Noch keine Bewertungen mit
  Gespannlänge vorhanden.") — **kein Problem gefunden**, hier keine
  weitere Maßnahme nötig.
- **Tab 3 des Routenplaner-Wizards** ("Fertig") zeigt eine
  Kennzahlen-Zeile (Strecke, Reisezeit, Ladestopps, Anteil Ladezeit) plus
  vollständige Zeitleiste — entspricht dem in user-flows.md Flow 5
  angenommenen Zusammenfassungs-/Speichern-Schritt. **Kein Problem
  gefunden.**

---

## Neu identifiziert in Phase 5

### UX-05.1 — Design-Tokens werden im Code größtenteils umgangen (C)

- **Zustand:** `docs/design/brand-guide.md` definiert `--c-text-muted`
  (`#5C6B66`) als einzige Rolle für sekundären/gedämpften Text, verfügbar
  als Tailwind-Klasse `text-text-muted`. In der Praxis nutzen **33
  Komponenten-/Seitendateien** stattdessen rohe Utility-Klassen wie
  `text-black/50 dark:text-white/50` bzw. `border-black/10
  dark:border-white/10` — nur **2 Dateien** verwenden `text-text-muted`
  korrekt.
- **Problem:** `text-black/50` ist eine Transparenz-Abschwächung von
  Schwarz, kein fester Farbwert — sie sieht auf `--c-card` (`#FDFCF9`)
  anders aus als auf `--c-surface` (`#F2F0E8`) und weicht vom
  spezifizierten `#5C6B66` ab. Der `dark:`-Anteil ist zusätzlich toter
  Code (siehe UX-05.2). Ergebnis: sekundärer Text ist im gesamten Produkt
  uneinheitlich, ohne dass das visuell sofort auffällt (kleine
  Abweichungen).
- **Betroffen u. a.:** `campsite-review-list.tsx`, `charging-review-list.tsx`,
  `station-reviews-list.tsx`, `rig-length-distribution.tsx`,
  `profile-sub-nav.tsx` (Rest-Farbe für inaktive Tabs), viele weitere.
- **Vorgeschlagene Richtung (nicht umgesetzt):** schrittweise Ersetzung
  durch `text-text-muted`/`border-line` im Rahmen von Phase 9 (Component
  Library) statt als isolierte Sofortmaßnahme — entspricht §34 des Briefs
  ("nicht alles auf einmal umschreiben").
- **Technische Konsequenzen:** keine Logikänderung, rein visuell;
  Risiko eines großflächigen Diffs, wenn in einem Rutsch erledigt.
- **Ergänzung (Phase 7/8):** Dasselbe Muster wurde bei Fehlerfarben
  gefunden — Dateien nutzten hart codiertes `text-red-600` statt eines
  Tokens (jetzt `--c-error`, s. UX-07.1 unten).
- **Teilweise erledigt (Phase 9, 2026-09-25):** Die exakten Muster
  `text-black/50 dark:text-white/50` (84 Fundstellen) und
  `border-black/10 dark:border-white/10` (11 Fundstellen) wurden auf
  `text-text-muted`/`border-line` migriert — Typecheck grün, visuell
  stichprobenartig geprüft (`/impressum`).
- **Bewusst NICHT migriert (größerer Fund als ursprünglich angenommen,
  eigener Folgeschritt nötig):** weitere Opazitätsstufen desselben Musters
  ohne 1:1-Tokenentsprechung — `text-black/40` (21×), `/60` (40×), `/70`
  (22×), `/30` (2×), jeweils mit `dark:text-white/*`-Pendant, sowie
  vereinzelte Varianten ohne `dark:`-Anteil. Dazu `border-black/15` (85×)
  und `border-black/25` (1×) ohne Entsprechung zu `border-black/10`. Diese
  Abstufungen wurden nicht ungeprüft auf den einen vorhandenen
  `text-text-muted`/`border-line`-Ton reduziert, weil unklar ist, ob sie
  eine beabsichtigte visuelle Hierarchie (z. B. "etwas gedämpfter" vs.
  "stark gedämpft") abbilden oder selbst Teil der Inkonsistenz sind — das
  ist erst zu klären (ggf. weitere abgestufte Tokens nötig), bevor eine
  Massenersetzung erfolgt.
- **Geklärt und migriert (Phase 12, 2026-09-25):**
  - `text-black/40` und `/60` (jeweils mit `dark:text-white/*`-Pendant,
    61 Fundstellen zusammen) waren beides reine Fließtext-Abstufungen
    ohne erkennbare eigene Bedeutung (Fine-Print/Zeitstempel bzw.
    Sekundärtext) — beide auf Kontrast geprüft: `/40` lag unterhalb des
    bereits migrierten `/50`-Tons (heller, also *weniger* Kontrast als
    `text-text-muted`), Migration dorthin ist also eine
    Kontrast-*Verbesserung*, kein Risiko. `/60` liegt knapp über
    `text-text-muted`, bleibt nach Migration weiterhin über der
    4.5:1-Mindestanforderung (brand-guide.md §9). Beide auf
    `text-text-muted` migriert.
  - `text-black/70` (22×) bewusst **nicht** migriert: mindestens eine
    Stelle (`route-wizard-tabs.tsx`) nutzt `/70` nachweislich als
    bewusste dritte Stufe eines Tab-Zustandssystems (aktiv → `/70`
    "erreichbar" → `/30` "nicht erreichbar", jeweils mit passendem
    `border-black/25`/`border-black/10`) — hier liegt tatsächlich eine
    beabsichtigte Hierarchie vor, keine Inkonsistenz. Die übrigen
    `/70`-Stellen (Rechtstexte, Bewertungs-Zitate, Startseiten-Subline)
    sind zudem die am wenigsten gedämpfte, kontrastreichste Stufe —
    eine Migration auf den helleren `text-text-muted`-Ton wäre hier das
    einzige Risiko einer echten Kontrast-*Verschlechterung* gewesen.
    Bleibt offen für eine spätere, gezielte Einzelfallprüfung.
  - `border-black/15` (85×) stellte sich beim genauen Hinsehen NICHT als
    Variante von `border-line` heraus, sondern als eigenständiges,
    durchgängiges Muster: der De-facto-Standardrahmen für praktisch
    jedes Formularfeld/jeden umrandeten Button app-weit, klar
    unterscheidbar von `border-line` (reine Trennlinien). Dafür neuer
    Token `--c-line-strong` (`border-line-strong`), s.
    `docs/DESIGN_DECISIONS.md`.
  - `border-black/25` (1×, `route-wizard-tabs.tsx`) bewusst nicht
    angefasst — Teil desselben bewussten Tab-Zustandssystems wie oben.
  - `text-black/30` (2×) bewusst nicht angefasst: eine Stelle ist Teil
    desselben Tab-Zustandssystems, die andere (`gespann-panel.tsx`) ein
    rein dekoratives, `aria-hidden`-Trennzeichen ohne Textbedeutung —
    beide unkritisch, kein Konsolidierungsbedarf.

### UX-07.1 — Formularfehler ohne Token und ohne begleitendes Symbol (C, aus ci-branding-audit.md übernommen)

- **Zustand:** Ursprünglich 27 Dateien mit hart codiertem `text-red-600`
  statt eines Tokens.
- **Problem:** Verstößt gegen §10 des Design-Briefs (keine hart codierten
  Farben) und gegen die eigene Regel der Marke (brand-guide.md §9: Farbe
  nie einziger Informationsträger) — bei Farbsehschwäche ist eine rote
  Fehlermeldung ohne Symbol schwerer von normalem Text zu unterscheiden.
- **Teilweise erledigt (Phase 9, 2026-09-25):** Alle 41 Fundstellen von
  `text-red-600` wurden auf `text-error` migriert (Typecheck grün, visuell
  stichprobenartig geprüft). **Noch offen:** begleitendes Symbol bei
  Fehlermeldungen (echte Barrierefreiheits-Verbesserung, kein reiner
  Farbtausch) sowie die 6 `bg-red-600`/3 `border-red-600`/3 `bg-red-700`/
  1 `bg-red-500`-Fundstellen (Button-/Flächenfarben, kein 1:1-Textmuster,
  zurückgestellt für einen eigenen Migrationsschritt).

### UX-05.2 — `dark:`-Klassen sind toter Code (C, bereits in PRODUCT_AUDIT.md §4.5 notiert)

- **Zustand:** `globals.css` bindet Tailwinds `dark:`-Variante bewusst an
  eine nie gesetzte `.dark`-Klasse (kein System-Dark-Mode-Support, ein
  festes Markendesign). Trotzdem tragen weiterhin viele Komponenten
  `dark:*`-Klassen (Teil derselben 33 Dateien wie oben).
- **Problem:** Kein funktionaler Schaden (Klassen greifen nie), aber
  Code-Rauschen, das bei jeder neuen Komponente unreflektiert kopiert
  werden kann und so weiterwächst.
- **Einordnung:** technisch harmlos (A wäre übertrieben), im Kern ein
  Design-/Codepflege-Thema (C), keine Produktentscheidung, die geändert
  werden müsste — nur Aufräumen nötig, idealerweise zusammen mit UX-05.1.

### UX-05.3 — Login-Torbogen ohne Vorschau (B, mit D-Anteil)

- **Zustand:** Wie in information-architecture.md dokumentiert, ist `/`
  der einzige öffentlich erreichbare Inhaltsbereich; jeder Klick auf
  Camping/Laden/Route/Community führt ohne Login sofort zu
  `/login?redirect=…`.
- **Problem:** Ein neuer Besucher sieht vor der Registrierung keinerlei
  Beispiel-Inhalt (keinen Campingplatz, keinen Ladepunkt) — die
  Konversionslast liegt vollständig auf der Landing-Page-Kommunikation
  ohne visuellen Beleg des Produktnutzens.
- **Einordnung:** überwiegend **D** — bewusste Sicherheitsentscheidung
  laut Code-Kommentar in `require-user.ts` ("Sicherheits-Audit"). Der
  **UX-Anteil (B)** liegt darin, dass die Konsequenz für neue Besucher
  bislang nicht als Designfrage behandelt wurde (z. B. kuratierte
  Screenshots/Beispieldaten auf `/`, die keine Live-Abfrage brauchen).
- **Vorgeschlagene Richtung:** nicht die Login-Pflicht selbst in Frage
  stellen (das wäre ein Sicherheits-Rollback, kein Design-Thema), sondern
  in Phase 6 prüfen, ob `/` genug Vertrauen/Beleg schafft, um die
  Registrierungshürde zu rechtfertigen.
- **Technische Konsequenzen:** keine, falls nur `/` gestalterisch
  angereichert wird (keine neuen Datenzugriffe nötig).
- **Erledigt (Phase 12, 2026-09-25):** Neue Komponente
  `src/components/home/trust-preview.tsx` auf `/` — zeigt die
  Anhängertauglichkeits-Legende plus ein klar als "Beispiel, keine
  echten Daten" gekennzeichnetes Beispiel, ohne Live-Datenzugriff und
  ohne Änderung an der Login-Pflicht. Details s.
  `docs/DESIGN_DECISIONS.md`.

### UX-05.4 — Zwei parallele Gespannmaß-Eingabewege ohne Verknüpfungshinweis (B, Ergänzung zu PRODUCT_AUDIT.md §4.4)

- **Zustand:** Sowohl im Routenplaner als auch im Bewertungsformular kann
  Gespannlänge entweder aus dem Profil (Fahrzeug+Wohnwagen, automatisch
  summiert) oder per Freitext eingegeben werden.
- **Problem:** Nutzer ohne hinterlegtes Fahrzeug/Wohnwagen sehen an
  keiner der beiden Stellen einen Hinweis "Trage dein Gespann im Profil
  ein, dann musst du das nicht jedes Mal eingeben" — der Komfortgewinn
  bleibt unentdeckt.
- **Vorgeschlagene Richtung:** kleiner Kontexthinweis/Link zu
  `/profil/gespann` an der Freitext-Eingabe, wenn kein Fahrzeug/Wohnwagen
  hinterlegt ist.
- **Technische Konsequenzen:** minimal (bedingtes UI-Element, kein neuer
  Datenzugriff — die Information "kein Fahrzeug/Wohnwagen hinterlegt"
  liegt an beiden Stellen bereits vor).
- **Präzisiert beim genauen Code-Lesen (Phase 12, 2026-09-25):** Der
  Routenplaner (`route-planner-form.tsx`) hatte diesen Hinweis bereits
  ("Du hast noch kein Elektroauto im Profil hinterlegt. Bitte zuerst
  unter Mein Gespann ergänzen.", mit Link) — die ursprüngliche Annahme
  "an keiner der beiden Stellen" traf dort nicht (mehr) zu. Nur das
  Bewertungsformular für Ladepunkte (`charging-stations/review-form.tsx`)
  hatte tatsächlich keinen Hinweis. Das Campingplatz-Bewertungsformular
  (`campsites/review-form.tsx`) hat gar kein Gespann-Feld, betrifft
  UX-05.4 nicht.
- **Erledigt (Phase 12, 2026-09-25):** Hinweis in
  `charging-stations/review-form.tsx` ergänzt (zeigt bei
  `vehicles.length === 0 && caravans.length === 0`), Link zu
  `/profil/gespann`, `text-warning`-Token statt hartcodiertem Amber.
  Details s. `docs/DESIGN_DECISIONS.md`.

### UX-05.5 — IA-Bruch bei `/profil/legende` und `/profil/fehlende-saeule` (B, aus information-architecture.md übernommen)

- Bereits in Phase 3 dokumentiert: beide Seiten sind inhaltlich nicht
  account-bezogen, liegen aber unter der login-pflichtigen
  `/profil/*`-Struktur. Keine neue Analyse nötig, hier nur als
  priorisierbares Item aufgenommen für Phase 6.
- **Präzisiert beim genauen Code-Lesen (Phase 12, 2026-09-25):** Die
  ursprüngliche Annahme "beide Seiten ohne Account-Bezug" trifft nur auf
  `/profil/legende` zu. `/profil/fehlende-saeule` liest tatsächlich
  `user.id`-gefilterte eigene Meldungen (`enrich.missing_station_report`,
  Abschnitt "Meine Meldungen") — das IST Account-Bezug, die Login-Pflicht
  dort ist also gerechtfertigt (zusätzlich sinnvoll gegen Spam/Missbrauch
  ohne Rate-Limit). Kein IA-Bruch, bleibt wie bisher unter `/profil/*`.
- **Erledigt für `/profil/legende` (Phase 12, 2026-09-25):** Seite nach
  `src/app/legende/page.tsx` verschoben, Login-Zwang entfernt (reiner
  Referenzinhalt, keine DB-Abfrage). Bleibt weiterhin aus der
  Profil-Navigation verlinkt (`profile-sidebar.tsx`,
  `profile-sub-nav.tsx`, `/profil`-Hub-Kacheln), jetzt zusätzlich ohne
  Login direkt erreichbar. Details s. `docs/DESIGN_DECISIONS.md`.

### UX-05.6 — Impressum/Datenschutz für nicht eingeloggte Mobile-Nutzer schwer auffindbar (B, aus information-architecture.md übernommen)

- Bereits in Phase 3 dokumentiert. Rechtlich relevant (§5 DDG "ständige
  Erreichbarkeit") — sollte in Phase 6 mit höherer Priorität behandelt
  werden als rein gestalterische Punkte.
- **Erledigt (Phase 12, 2026-09-25):** Die Lücke betraf nicht `/` selbst
  (dort waren die Links schon vorhanden), sondern die vier
  Auth-Zwischenseiten `/login`, `/register`, `/passwort-vergessen`,
  `/passwort-zuruecksetzen` — auf Mobile ohne Footer/Tab-Bar-Eintrag
  bislang ohne jeden Weg zu Impressum/Datenschutz. Neue gemeinsame
  Komponente `src/components/legal-footer-links.tsx`, auf allen fünf
  öffentlich erreichbaren Seiten eingebunden. Details s.
  `docs/DESIGN_DECISIONS.md`.

### UX-05.7 — Fehlende-Ladesäule-Meldungen ohne aktive Rückmeldung (B, aus user-flows.md übernommen)

- Bereits in Phase 4 dokumentiert: Status ändert sich nur sichtbar bei
  erneutem Besuch der Seite, kein Push/E-Mail. Niedrige Priorität
  (Meldefunktion ist ein Nebenpfad, kein Kernflow).
- **Teilweise erledigt (Phase 12, 2026-09-25):** Eine echte Push-/
  E-Mail-Benachrichtigung wäre Infrastruktur-Arbeit (Supabase-E-Mail-
  Versand oder eigener Edge-Function-Trigger bei Statuswechsel im
  Admin-Backend) — zu groß für diesen Design-Schritt und nicht Kern
  dieser Phase ("Screens gestalten"). Stattdessen minimal-invasiv
  gelöst: sowohl bei der Erfolgsmeldung nach dem Melden
  (`missing-station-report-form.tsx`) als auch bei der Liste "Meine
  Meldungen" (`fehlende-saeule/page.tsx`) steht jetzt explizit, dass es
  keine Benachrichtigung gibt und der Status nur beim erneuten
  Seitenbesuch aktuell ist — ehrlich statt stillschweigend (§8
  brand-guide.md). Die eigentliche Benachrichtigungsfunktion bleibt ein
  offener, größerer Folgeschritt (nicht Teil dieser Änderung).

---

## Zusammenfassung: Priorisierbare Liste für Phase 6

| # | Titel | Kategorie | Aufwand (grob) | Dringlichkeit |
|---|---|---|---|---|
| UX-05.6 | Impressum/Datenschutz-Erreichbarkeit (Mobile, nicht eingeloggt) | B | niedrig | **hoch (rechtlich)** |
| UX-05.5 | `/profil/legende`, `/profil/fehlende-saeule` gehören IA-lich nicht unter Profil | B | mittel | mittel |
| UX-05.1 | Design-Tokens im Code umgangen (33 Dateien, gedämpfter Text) | C | mittel–hoch | mittel (im Rahmen Phase 9) |
| UX-07.1 | Formularfehler hart codiert, ohne Symbol (27 Dateien) | C | mittel–hoch | mittel (im Rahmen Phase 9, mit UX-05.1 kombiniert) |
| UX-05.2 | Toter `dark:`-Code | C | niedrig (mit 05.1 kombinierbar) | niedrig |
| UX-05.4 | Kein Verknüpfungshinweis Profil-Gespann ↔ Freitext-Eingabe | B | niedrig | niedrig–mittel |
| UX-05.3 | Login-Torbogen ohne Vorschau auf `/` | B/D | mittel (Phase 6, nur `/`) | mittel |
| UX-05.7 | Keine aktive Rückmeldung bei Meldestatus-Änderung | B | mittel | niedrig |

Bereits entschieden und umgesetzt (nicht mehr Teil dieser Liste):
Community-Tab (D, so belassen), `/profil/einstellungen` (aus Navigation
entfernt, s. PRODUCT_AUDIT.md).
