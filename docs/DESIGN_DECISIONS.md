# Design Decision Log — charge2camp

Format nach `\\MyCloud\work\charge2camp\Design\BrandDesign.rtf` §29:
**Decision / Reason / Alternatives / Impact / Date.** Neueste Einträge
oben. Jede wichtige Design-/Architekturentscheidung aus dem
Design-Prozess (Phasen 1–16, `docs/PRODUCT_AUDIT.md` und
`docs/design/*.md`) wird hier festgehalten, damit spätere Arbeit
nachvollziehen kann, *warum* eine Entscheidung getroffen wurde — nicht nur
*was* entschieden wurde.

---

## Verknüpfungshinweis Profil-Gespann im Ladepunkt-Bewertungsformular (UX-05.4)

- **Decision:** In `src/components/charging-stations/review-form.tsx`
  einen Hinweis ergänzt ("Trag dein Gespann unter Mein Gespann ein,
  dann musst du Länge und Breite nicht jedes Mal von Hand eingeben."),
  sichtbar wenn weder Fahrzeug noch Wohnwagen im Profil hinterlegt sind.
- **Reason:** UX-05.4 — an der Freitext-Eingabestelle fehlte bislang
  jeder Hinweis auf den Komfortgewinn eines hinterlegten Gespanns. Beim
  Nachprüfen des zweiten in der Doku genannten Orts
  (`route-planner-form.tsx`) zeigte sich: dort existierte der Hinweis
  bereits (nicht Teil dieser Änderung) — die ursprüngliche
  Audit-Annahme "an keiner der beiden Stellen" war für den Routenplaner
  nicht mehr zutreffend. Das Campingplatz-Bewertungsformular hat kein
  Gespann-Feld und ist von UX-05.4 nicht betroffen.
- **Alternatives:** (1) Hinweis nur bei Fahrzeug ODER nur bei Wohnwagen
  fehlend zeigen (verworfen: die "Sonstiges / manuell"-Option gilt für
  beide Dropdowns unabhängig, ein Hinweis nur bei vollständigem Fehlen
  beider vermeidet, bei jedem einzelnen Freitext-Feld zu nerven, wenn
  z. B. nur der Wohnwagen bewusst nicht hinterlegt werden soll); (2)
  hartcodiertes Amber wie im Routenplaner-Hinweis übernehmen (verworfen:
  seit Phase 8 existiert der Token `--c-warning`/`text-warning` genau
  für diesen Zweck, neuer Code nutzt ihn direkt statt die bereits als
  Nebenbefund dokumentierte Inkonsistenz zu wiederholen).
- **Impact:** `src/components/charging-stations/review-form.tsx`
  erweitert, keine Logikänderung sonst. Typecheck grün. Kein Live-Test
  im Browser (Komponente ist login-pflichtig, kein Test-Account in
  dieser Umgebung) — Typsicherheit und Props-Kette
  (`station-reviews-list.tsx` übergibt `vehicles`/`caravans` immer als
  Array, nie `undefined`) geprüft. UX-05.4 damit erledigt (s.
  `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Screens gestalten).

---

## `/profil/legende` → `/legende`, ohne Login (UX-05.5)

- **Decision:** Seite von `src/app/profil/legende/page.tsx` nach
  `src/app/legende/page.tsx` verschoben, die dortige
  `if (!user) redirect("/login")`-Prüfung entfernt.
  `/profil/fehlende-saeule` (der zweite in UX-05.5 genannte Fall) bleibt
  unverändert unter `/profil/*`.
- **Reason:** Bei genauem Lesen von `profil/legende/page.tsx` (nicht nur
  der Doku-Annahme aus `information-architecture.md`) bestätigt sich: die
  Seite lädt gar keine Nutzer-/DB-Daten, `user` wurde ausschließlich für
  die Zugriffsprüfung selbst abgefragt — reiner, statischer
  Referenzinhalt (Symbol-/Begriffserklärungen), der strukturell unter der
  login-pflichtigen `/profil/*`-Hierarchie lag, obwohl die Regel
  ("`/profil/*` = Accountbereich") inhaltlich nicht zutrifft. Bei
  `fehlende-saeule/page.tsx` dagegen bestätigt sich die ursprüngliche
  Doku-Annahme NICHT: die Seite liest `user.id`-gefilterte eigene
  Meldungen ("Meine Meldungen") — echter Account-Bezug, Login dort bleibt
  gerechtfertigt. Das wird hier korrigiert dokumentiert statt die
  ungeprüfte Ausgangsannahme weiterzutragen.
- **Alternatives:** (1) Seite an Ort und Stelle lassen, nur den
  Login-Zwang entfernen (verworfen: der Pfad `/profil/legende` würde
  weiterhin strukturell falsch suggerieren, es handle sich um
  Accountinhalt — IA-Bruch bliebe strukturell bestehen, nicht nur der
  Zugriffs-Aspekt); (2) komplett neue Seite ohne Bezug zur bestehenden
  IA schreiben (verworfen: unnötig, Inhalt war bereits korrekt und
  vollständig).
- **Impact:** `src/app/legende/page.tsx` (neu, vorher
  `src/app/profil/legende/page.tsx`), 3 Referenzen aktualisiert
  (`src/components/profile-sidebar.tsx`,
  `src/components/profile/profile-sub-nav.tsx`,
  `src/app/profil/page.tsx`). Alte URL `/profil/legende` existiert nicht
  mehr (fängt sich weiterhin im `/profil`-Layout-Login-Gate, dann 404
  nach Login — kein aktiver externer Link auf die alte URL bekannt).
  Typecheck grün (inkl. Next.js-Routentyp-Neugenerierung), im Browser
  ohne Login unter `/legende` geprüft (alle Sektionen rendern
  korrekt). UX-05.5 für `/profil/legende` damit erledigt, für
  `/profil/fehlende-saeule` als "kein Problem" korrigiert (s.
  `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Screens gestalten).

---

## Vertrauensbeleg auf `/` ohne Live-Daten (UX-05.3)

- **Decision:** Neue Komponente `src/components/home/trust-preview.tsx`
  auf `/` eingebunden: zeigt die vollständige
  Anhängertauglichkeits-Legende (5 Zustände, reale, immer zutreffende
  Systeminformation) plus genau ein erfundenes Beispiel ("Autobahnraststätte
  (Beispiel)", klar mit "Beispiel, keine echten Daten" beschriftet).
- **Reason:** UX-05.3 — ein neuer Besucher sieht vor der Registrierung
  aktuell keinerlei Beleg für den Kernnutzen, da jede Aktion mit echten
  Daten (`NearbyChargingModal`) sofort zu einem Login-Hinweis führt
  (`requiresLogin`-Zustand dort, `/api/charge-points/viewport` liefert
  401 ohne Session). Design-strategy.md Leitplanke 5 verlangt für `/`
  "erhöhte Sorgfalt", ohne die Login-Pflicht selbst zur Diskussion zu
  stellen (das wäre ein Sicherheits-Rollback). Diese Lösung ändert nichts
  an `require-user.ts`/`api-guard.ts`, sondern zeigt ausschließlich
  statischen, im Client fest codierten Inhalt.
- **Alternatives:** (1) echte, aber alte/aggregierte Daten ohne Login
  zeigen — verworfen, da das `require-user.ts` durchbrechen würde
  (Sicherheitsentscheidung, nicht Designfrage); (2) Screenshots der
  echten App einbetten — verworfen, aufwendiger zu pflegen als eine aus
  bestehenden Tokens/Komponenten gebaute Live-Vorschau, und Screenshots
  veralten schneller als Code; (3) mehrere Beispiel-Cards — verworfen
  zugunsten von §34 des Briefs (inkrementell, nicht überladen) und
  brand-guide.md §8 (kurz, sachlich).
- **Nebenbefund (nicht in dieser Änderung behoben):** Bestehender Code
  (`nearby-charging-modal.tsx`, `charging-station-map-explorer.tsx`)
  verwendet für Lime-Badges durchgängig hellen statt dunklen Text —
  verstößt gegen brand-guide.md §9 ("Lime trägt nur dunklen Text, nie
  hellen"). In `trust-preview.tsx` selbst korrekt umgesetzt
  (`text-text` statt `text-white`), die bestehenden Stellen bewusst
  nicht mitgeändert (eigenständiges, umfangreicheres Thema, s.
  Kommentar im Code).
- **Impact:** `src/components/home/trust-preview.tsx` neu,
  `src/app/page.tsx` erweitert. Keine neuen Datenzugriffe, kein Eingriff
  in Login-Pflicht. Typecheck grün, visuell auf 375px und Desktop-Breite
  geprüft. UX-05.3 damit erledigt (s. `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Screens gestalten).

---

## Impressum/Datenschutz auf allen Auth-Zwischenseiten (nicht nur `/`)

- **Decision:** Neue Komponente `src/components/legal-footer-links.tsx`
  (Impressum-/Datenschutz-Links) auf `/`, `/login`, `/register`,
  `/passwort-vergessen` und `/passwort-zuruecksetzen` eingebunden (vorher
  nur auf `/`).
- **Reason:** UX-05.6 (rechtlich hohe Dringlichkeit, §5 DDG "ständige
  Erreichbarkeit") war nicht vollständig behoben, nur der offensichtliche
  Teil (`/`). Die eigentliche Lücke lag bei den vier Auth-Seiten: Mobile
  hat dort weder Footer (`site-footer.tsx` bleibt `hidden` unter `md`)
  noch einen Tab-Bar-Eintrag für Impressum/Datenschutz — ein nicht
  eingeloggter Mobile-Nutzer, der z. B. von `/` zu `/login` wechselt,
  hatte dort keinen Weg mehr zurück zu den Pflichtangaben, außer über den
  Browser-Zurück-Button. Geprüft, nicht angenommen: Code direkt gelesen
  (`layout.tsx`, `site-footer.tsx`, alle vier Auth-Seiten) statt nur die
  Doku-Annahme aus `information-architecture.md` zu übernehmen.
- **Alternatives:** (1) Footer auch auf Mobile für genau diese fünf Seiten
  einblenden (verworfen: `site-footer.tsx` ist bewusst wegen der fixed
  Bottom-Tab-Bar auf Mobile ausgeblendet, s. Kommentar dort — Footer und
  Tab-Bar würden sich überlappen); (2) Link in die Bottom-Tab-Bar
  aufnehmen (verworfen: 5 Slots sind laut `brand-guide.md` §6 das
  Maximum, bereits ausgeschöpft).
- **Impact:** `src/components/legal-footer-links.tsx` neu, 5 Seiten
  angepasst (`src/app/page.tsx` dabei auf die neue Komponente
  umgestellt statt Duplikat zu behalten). Keine Logikänderung, Typecheck
  grün, alle fünf Seiten im Browser (375px-Breite) visuell geprüft,
  inklusive des "Link ungültig"-Zustands von
  `/passwort-zuruecksetzen`. UX-05.6 damit vollständig erledigt (s.
  `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Screens gestalten).

---

## Erste Token-Migration: exakte Muster von gedämpftem Text/Rahmen/Fehlerfarbe

- **Decision:** Drei exakte, hart codierte Farbmuster wurden repository-weit
  durch Tokens ersetzt: `text-black/50 dark:text-white/50` →
  `text-text-muted` (84 Fundstellen), `border-black/10
  dark:border-white/10` → `border-line` (11), `text-red-600` →
  `text-error` (41).
- **Reason:** Direkteste, risikoärmste Teilmenge der in UX-05.1/UX-07.1
  dokumentierten Token-Umgehung — exakte 1:1-Entsprechung zu bereits
  definierten Tokens, keine Interpretation nötig. Entspricht §34 des
  Briefs (inkrementell statt alles auf einmal) und der in
  `design-strategy.md` festgelegten Leitplanke 3.
- **Alternatives:** (1) alle Opazitätsstufen (30/40/50/60/70 %) und
  Border-Varianten (10/15/25 %) in einem Rutsch auf jeweils einen Token
  reduzieren — verworfen, da unklar ist, ob die Abstufungen eine
  beabsichtigte Hierarchie abbilden (Risiko stiller visueller
  Regressionen); (2) gar nichts migrieren, nur weiter dokumentieren —
  verworfen, da die exakten Muster bereits eindeutig geklärt waren.
- **Impact:** 33 Dateien geändert (reine Klassennamen-Ersetzung, keine
  Logikänderung). Typecheck grün, Stichprobe `/impressum` visuell
  geprüft. Weitere Opazitäts-/Rahmenvarianten sowie `bg-red-*`/
  `border-red-*`-Flächenfarben bleiben offen (s. `ux-problems.md`
  UX-05.1/UX-07.1) für einen eigenen, noch zu klärenden Migrationsschritt.
- **Date:** 2026-09-25 (Phase 9).

## Kein UI-weiter Dark Mode

- **Decision:** charge2camp bekommt keinen Hell/Dunkel-Toggle für die
  Produktfläche. Ein festes Markendesign bleibt bestehen.
- **Reason:** Der Markenkontrast (dunkelgrüner Header/Footer/Bottom-Tab-Bar,
  helle Produktfläche) ist Teil der Markenidentität selbst — laut §8.14
  des Design-Briefs hat die bestehende Markenidentität Priorität 1, noch
  vor Designtrends oder allgemeinen Empfehlungen (§11 des Briefs fordert
  Dark Mode allgemein). Ein Dark Mode würde diesen Kontrast auflösen oder
  dauerhaft doppelt pflegen müssen, ohne einen klaren Nutzerbedarf zu
  bedienen (Kernnutzen der Marke ist Lesbarkeit bei Sonne/unterwegs, nicht
  Bildschirmhelligkeit bei Nacht).
- **Alternatives:** (1) Dark Mode vollständig mit eigenen semantischen
  Tokens umsetzen (§11-Vorgabe wörtlich), (2) Hybrid — nur
  System-UI/Statusleiste dunkel, Produktfläche einheitlich hell.
- **Impact:** `globals.css` behält die bewusste Entkopplung von
  Tailwinds `dark:`-Variante (gebunden an eine nie gesetzte `.dark`-Klasse).
  Vorhandene `dark:*`-Klassen im Code bleiben totes Codemuster, das im
  Rahmen der Token-Migration (s. u.) aufgeräumt wird. System-UI-Elemente
  (`themeColor`, `black-translucent`-Statusleiste) bleiben unberührt.
- **Date:** 2026-09-25 (Phase 7, `docs/design/ci-branding-audit.md`
  Abschnitt 5).

## `--c-error`/`--c-warning` als eigene Formular-/Systemfeedback-Tokens

- **Decision:** Zwei neue Farbtokens (`--c-error` #B4443A,
  `--c-warning` #E8A33D) ergänzen das bestehende System, mit denselben
  Hex-Werten wie `--c-status-down`/`--c-status-busy`, aber als
  eigenständige Rollen.
- **Reason:** §10 des Design-Briefs verlangt allgemeine Error-/
  Warning-Tokens; der bestehende Code nutzte stattdessen hart codiertes
  Tailwind-Rot (`text-red-600`, 27 Dateien) für Formularfehler — ein
  direkter Verstoß gegen die Token-Pflicht ("keine Farben direkt in
  Komponenten hart codieren"). Eigene Tokens statt Wiederverwendung der
  Ladepunkt-Status-Tokens, damit Formularfehler nicht an die
  Ladepunkt-Status-Semantik gekoppelt sind (unterschiedliche Bedeutung,
  auch wenn die Farbe zufällig identisch ist).
- **Alternatives:** (1) `--c-status-down`/`--c-status-busy` direkt für
  Formulare wiederverwenden (verworfen: koppelt zwei unabhängige
  Bedeutungen), (2) neue, andere Farbe für Error/Warning einführen
  (verworfen: unnötige Erweiterung der Palette, §32 Kostenoptimierung —
  Rot/Amber sind bereits etabliert und bedeuten bereits Gefahr/Vorsicht).
- **Impact:** `docs/design/tokens.json`, `src/app/globals.css` (neue
  CSS-Variablen + Tailwind-Mapping `text-error`/`text-warning` etc.),
  `docs/design/brand-guide.md` §3 ergänzt. Die eigentliche Migration der
  27 betroffenen Dateien von `text-red-600` auf `text-error` erfolgt
  **nicht** in diesem Schritt, sondern gebündelt in Phase 9 (Component
  Library), zusammen mit der in UX-05.1 dokumentierten
  Token-Umgehung bei gedämpftem Text (§34 des Briefs: nicht alles auf
  einmal umschreiben).
- **Date:** 2026-09-25 (Phase 8, `docs/design/tokens.json`).

## Figma für den MVP nutzen

- **Decision:** Figma wird zusätzlich zu `brand-guide.md`/`tokens.json`
  als visuelles Design System aufgebaut (Phasen 10–14 des Briefs).
- **Reason:** Der Design-Brief sieht Figma explizit als "visuelle Source
  of Truth" vor (§24), Claude Code/Code-Repo als technische Source of
  Truth (§25) — beide Rollen ergänzen sich, wenn Figma die bestehenden
  Tokens abbildet statt neue Werte vorzugeben.
- **Alternatives:** kein Figma, `brand-guide.md`/`tokens.json` bleiben
  einzige Design-Quelle (geringerer Pflegeaufwand, aber ohne visuelles
  Prototyping-Werkzeug für Screen-Entwürfe in späteren Phasen).
- **Impact:** Umsetzung erst in Phase 10, nach Phase 3–9 (Reihenfolge
  laut §33 des Briefs). Figma-Werte müssen mit bestehenden Tokens
  übereinstimmen, nicht sie ersetzen.
- **Date:** 2026-09-25 (Phase 2, `docs/PRODUCT_AUDIT.md`).

## Community bleibt ohne eigenen Tab in der Hauptnavigation

- **Decision:** `/community` bleibt wie bisher nur über direkte URL bzw.
  Verweise erreichbar, kein 6. Tab in der Bottom-Tab-Bar.
- **Reason:** Fünf Tabs sind laut `brand-guide.md` §6 das Maximum auf
  schmalen Geräten — bereits eine bewusste, dokumentierte
  Produktentscheidung vor diesem Prozess, hier bestätigt statt revidiert.
- **Alternatives:** Sichtbarkeit verbessern (z. B. Verlinkung aus Profil
  ergänzen) ohne 6. Tab — zurückgestellt, keine akute Notwendigkeit
  erkannt.
- **Impact:** keiner (Status quo bestätigt).
- **Date:** 2026-09-25 (Phase 2, `docs/PRODUCT_AUDIT.md`).

## `/profil/einstellungen` aus der Navigation entfernt

- **Decision:** Der Navigationslink zu `/profil/einstellungen` wurde aus
  `profile-sidebar.tsx`, `profile-sub-nav.tsx` und der Profil-Hub-Kachel
  entfernt. Die Route/Seite selbst bleibt im Code bestehen.
- **Reason:** Die Seite war ein reiner Platzhalter ohne Funktion ("noch
  keine App-Einstellungen") — eine Sackgasse ohne erkennbaren Nutzen in
  der Navigation (ux-problems.md, Audit §4.4).
- **Alternatives:** als sichtbarer Platzhalter/Ankündigung belassen —
  verworfen, da CLAUDE.md-Prinzip 2 ("keine Scheindaten"/-funktionen)
  sinngemäß auch auf beworbene Leerfunktionen übertragen wurde.
- **Impact:** keine Funktionsänderung, keine Datenverluste. Bei Bedarf
  später wieder verlinkbar, sobald echte Einstellungen existieren.
- **Date:** 2026-09-25 (Phase 2, `docs/PRODUCT_AUDIT.md`).
