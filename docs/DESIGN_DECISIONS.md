# Design Decision Log — charge2camp

Format nach `\\MyCloud\work\charge2camp\Design\BrandDesign.rtf` §29:
**Decision / Reason / Alternatives / Impact / Date.** Neueste Einträge
oben. Jede wichtige Design-/Architekturentscheidung aus dem
Design-Prozess (Phasen 1–16, `docs/PRODUCT_AUDIT.md` und
`docs/design/*.md`) wird hier festgehalten, damit spätere Arbeit
nachvollziehen kann, *warum* eine Entscheidung getroffen wurde — nicht nur
*was* entschieden wurde.

---

## Letzte offene Button-Lücken: `route-outline`-Variante, `iconShape`

- **Decision:** Neue `ButtonVariant` `"route-outline"` (`border-route
  text-route hover:bg-route/10`) für die 2 identischen "Als Start
  verwenden"-Buttons (`favorites-picker-dialog.tsx`,
  `home-address-picker-dialog.tsx`). Neue `iconOnly`-Option
  `iconShape="circle"` (`rounded-full` statt `rounded-md`) für
  freischwebende Bedienelemente über Karten/Bottom-Sheets — damit die 2
  `rounded-full`-Icon-Buttons in `station-bottom-sheet.tsx` sowie der
  kantenlose Close-Button in `nearby-charge-points.tsx` (auf den
  `square`-Standard vereinheitlicht) migriert.
- **Reason:** Schließt die beiden zuletzt in `DESIGN_SYSTEM.md`
  benannten Lücken. Statt sie weiter offen zu lassen: `route-outline`
  hatte bereits 2 identische Fundstellen (Schwelle für eine eigene
  Variante analog zu den bisherigen Entscheidungen), `iconShape` ist
  eine kleine, in sich konsistente Erweiterung von `iconOnly` statt
  einer komplett neuen Komponente für einen Formfaktor-Unterschied.
- **Impact:** 4 Dateien geändert (2 Migrationen + `button.tsx` +
  `nearby-charge-points.tsx`). Typecheck grün, Server-Build ohne
  Fehler, `/` live geprüft (kein Compile-/Runtime-Fehler). Damit sind
  aus den zuletzt in `DESIGN_SYSTEM.md` "Bewusst offen"
  gelisteten Punkten nur noch Toast, Bottom Sheet als eigene
  Komponente, Slider, Progress, Toggle, Checkbox und Empty/Error State
  unangefasst — alles eigenständige, noch nicht angefragte
  Komponententypen, kein Nacharbeiten bestehender Entscheidungen mehr.
- **Date:** 2026-09-26 (Phase 16).

---

## Große `border-black/10`-Aufräumrunde

- **Decision:** Alle verbliebenen `border-black/10`/`divide-black/10`-
  Fundstellen (26 Dateien, inkl. `md:`-Präfix-Varianten) auf
  `border-line`/`divide-line` migriert — bis auf `route-wizard-tabs.tsx`
  (bewusstes 3-Stufen-Zustandssystem, s. Phase-9-Rest-Entscheidung).
- **Reason:** Diese Migration war seit der ersten Token-Migration in
  Phase 9 als Nebenbefund bekannt (dort mit "eigener Folgeschritt"
  vermerkt) und wurde seitdem in jeder Runde ein Stück weiter
  reduziert (Phase 12, Phase-9-Rest, Button/Input-Migrationsrunden 3/5).
  Jetzt der verbliebene Rest in einem gebündelten, expliziten Schritt,
  statt ihn weiter über Zufallsfunde abzutragen.
- **Nebenbefund beim Ausführen:** Der erste sed-Lauf ersetzte
  versehentlich auch den Text in zwei eigenen Erklärkommentaren
  (`modal.tsx`, `card.tsx`), die `border-black/10` als Beispieltext
  zitierten, nicht als Klasse verwendeten — direkt bemerkt und
  korrigiert (Kommentare lesen wieder korrekt "hartcodiertes
  border-black/10").
- **Impact:** 27 Dateien geändert. Reine Klassennamen-Ersetzung, keine
  Logikänderung. Typecheck grün, keine doppelten Leerzeichen, Server-
  Build ohne Fehler, `/legende` (öffentlich) visuell geprüft — Karten
  mit sichtbaren Rahmen, keine Regression. UX-05.1 (`border-black/10`-
  Anteil) damit bis auf die eine bewusste Ausnahme vollständig erledigt.
- **Date:** 2026-09-26 (Phase 16).

---

## Neue Komponente `Modal`, 5 Dialoge migriert

- **Decision:** Neue Komponente `src/components/ui/modal.tsx` fasst das
  bisher in mehreren Dialogen identisch duplizierte Wrapper-Markup
  zusammen (Sheet auf Mobile, zentriertes Panel ab `sm:`, Kopfzeile mit
  Titel + `Button variant="ghost" iconOnly`-Schließen-Button,
  scrollbarer Inhaltsbereich mit Safe-Area-Padding). Nutzt `bg-card`/
  `border-line` statt der zuvor hartcodierten `bg-white dark:bg-
  neutral-900`/`border-black/10`. 5 Dialoge migriert:
  `caravan-edit-dialog.tsx`, `vehicle-edit-dialog.tsx`,
  `favorites-picker-dialog.tsx`, `home-address-picker-dialog.tsx`,
  `saved-route-picker-dialog.tsx`. Dabei nebenbei weitere
  `border-black/10`-Fundstellen (Listeneinträge in
  `favorites-picker-dialog.tsx`/`saved-route-picker-dialog.tsx`) auf
  `border-line` migriert und einige der bereits identifizierten
  "Als Ziel verwenden"-Buttons auf `Button` umgestellt.
- **Reason:** Deckt "Modal" aus §14 des Design-Briefs ab — der erste der
  bisher fehlenden ~16 weiteren Komponententypen. Die 5 migrierten
  Dialoge hatten praktisch identisches Wrapper-Markup, eine klare
  Konsolidierungs-Gelegenheit.
- **Was bewusst NICHT migriert wurde:** `nearby-charging-modal.tsx`
  braucht eine abweichende feste Höhe (Kartenausschnitt,
  `sm:h-[85vh] sm:max-h-[720px]`), die mit `Modal`s fest verdrahteter
  `sm:h-auto`-Annahme kollidieren würde — dort bleibt das Markup
  bewusst eigenständig (im Komponentenkommentar dokumentiert, damit das
  nicht wie ein übersehener Fall wirkt). "Als Start verwenden"
  (route-farbiger Outline-Button, `border-route text-route
  hover:bg-route/10`) hat noch keine passende `Button`-Variante —
  bewusst nicht erzwungen, ein Einzelfall bisher, keine eigene Variante
  gerechtfertigt.
- **Impact:** 6 Dateien geändert (5 Migrationen + `modal.tsx`).
  Typecheck grün, Server-Build ohne Fehler, `/routenplaner` leitet
  korrekt zu `/login` weiter (kein Compile-/Runtime-Fehler). Die
  migrierten Dialoge sind login-gated, nicht einzeln live getestet —
  das Muster wurde bereits am `NearbyChargingModal`-Schließen-Button
  (Runde 6) live verifiziert.
- **Date:** 2026-09-26 (Phase 16).

---

## Button-Variante `ghost` ergänzt, Icon-Only-Schließen-Buttons migriert

- **Decision:** Neue `ButtonVariant` `"ghost"` (`text-text-muted
  hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10`, ohne
  Rahmen/Fläche) in `src/components/ui/button.tsx`. Damit 7 der 10
  gefundenen Icon-Only-Schließen-Buttons migriert (`variant="ghost"
  iconOnly`): `caravan-edit-dialog.tsx`, `vehicle-edit-dialog.tsx`,
  `favorites-picker-dialog.tsx`, `home-address-picker-dialog.tsx`,
  `saved-route-picker-dialog.tsx`, `nearby-charging-modal.tsx`,
  `profile-sidebar.tsx`. Dabei zugleich das in Runde 4 notierte
  `text-black/50`-statt-`text-text-muted`-Problem an 6 dieser 7 Stellen
  behoben (der Token kommt jetzt zentral aus der Komponente, nicht mehr
  hartcodiert).
- **Reason:** Schließt die in Runde 4 dokumentierte Lücke. 10
  Fundstellen mit praktisch identischem Muster rechtfertigen eine
  eigene Variante (kein Einzelfall).
- **Was bewusst NICHT migriert wurde:** 2 Stellen in
  `station-bottom-sheet.tsx` nutzen `rounded-full` statt `rounded-md`
  (rundes statt eckiges Icon, vermutlich bewusst für den Kontext dort)
  sowie 1 Stelle in `nearby-charge-points.tsx`, der das `rounded-md`
  gänzlich fehlt (eckige statt jeder Ecken-Rundung) — beides eigene
  Formvarianten, kein 1:1-Match zu `iconOnly`, hier nicht ungeprüft
  vereinheitlicht.
- **Impact:** 8 Dateien geändert (7 Migrationen + `button.tsx`). Reine
  Wrapper-/Farbklassen-Ersetzung. Typecheck grün, Server-Build ohne
  Fehler, live auf `/` getestet (öffentlich erreichbar über "Ladesäule
  in der Nähe suchen"): Modal öffnet, Ghost-Button rendert korrekt,
  Schließen-Funktion arbeitet.
- **Date:** 2026-09-26 (Phase 16).

---

## Button/Input-Migration Runde 5: `route-planner-form.tsx` (größte Einzeldatei)

- **Decision:** Die zuvor als "größte verbliebene Einzeldatei" benannte
  `route-planner-form.tsx` (1457 Zeilen) migriert: alle regulären Text-/
  Zahlenfelder (`Field`+`Input`), alle Standard-Buttons (`Button`,
  Varianten `primary`/`secondary`, Größen `sm`/`md`, plus `iconOnly` für
  den Zwischenstopp-Entfernen-Button), zwei weitere `border-black/10`-
  Fundstellen auf `border-line`. `Input` dabei um `forwardRef` erweitert
  (`src/components/ui/input.tsx`) — notwendig für den bestehenden
  nicht-passiven `wheel`-Listener (`useNumberFieldWheel`, Mausrad-
  Feinsteuerung für Verbrauch/Ladeleistung), den ein Funktions-Prop ohne
  echten DOM-Ref nicht abbilden kann.
- **Reason:** Fortsetzung der bereichsweisen §14-Migration; diese Datei
  war explizit als nächster Schritt benannt.
- **Was bewusst NICHT migriert wurde:** `SocSlider` (eigene
  Range-Input-Komponente, kein Text-/Select-Feld — `type="range"`
  passt konzeptionell nicht zu `Input`s Rolle), die Anbieter-
  Checkboxen (`type="checkbox"`, ebenfalls außerhalb von `Input`s
  Rolle), `NavigationLink`-Elemente (eigene Link-Komponente mit
  `href`, kein `<button>`) sowie mehrere Stellen mit vom
  `Button`-Default abweichendem Padding (`px-5 py-3` statt `px-4 py-3`,
  `px-2`/`px-3` statt `px-3`/`px-4`) — Komponenten-Default übernommen
  statt per `className` zu erzwingen (derselbe Tailwind-Klassenkonflikt-
  Grund wie in Runde 2).
- **Impact:** 1 großer Diff in einer Datei plus `input.tsx` (forwardRef).
  Reine Wrapper-Ersetzung, keine Logikänderung — `useNumberFieldWheel`
  funktioniert unverändert, da der Ref jetzt korrekt bis zum echten
  `<input>`-Element durchgereicht wird. Typecheck grün (deckte den
  fehlenden `forwardRef` sofort auf), Server-Build ohne Fehler,
  `/routenplaner` leitet korrekt zu `/login` weiter (kein Compile-/
  Runtime-Fehler). Login-gated, Formular selbst nicht live getestet.
- **Date:** 2026-09-26 (Phase 16).

---

## Button-Größe `link` ergänzt, Lücke aus Runde 3 geschlossen

- **Decision:** Neue `ButtonSize` `"link"` (`flex min-h-11 items-center
  gap-1 px-2 -mx-2 text-sm`, immer mit `variant="plain"` kombiniert) in
  `src/components/ui/button.tsx`. Damit 9 weitere Link-Buttons migriert:
  "Bearbeiten"/"Löschen" in `campsite-review-list.tsx` und
  `charging-review-list.tsx`, "Wieder freigeben" in
  `blocked-stations-list.tsx`, "Entfernen" in
  `delete-saved-route-button.tsx`, sowie die Lösch-Bestätigungsdialoge in
  `caravan-edit-dialog.tsx`/`vehicle-edit-dialog.tsx` ("Ja, löschen" →
  `destructive`, "Abbrechen" → `plain`, der einleitende
  "… löschen"-Link-Button → `plain`+`link`).
- **Reason:** Schließt die in Runde 3 dokumentierte Lücke ("passt zu
  keiner Button-Größe"). Statt weiter unmigriert zu lassen: eine echte
  dritte Größe für exakt diese wiederkehrende Rolle (Link-Button)
  ergänzt, keine erfundene neue Optik — Klassen 1:1 aus den
  bestehenden, bereits identischen Fundstellen übernommen.
- **Was bewusst NICHT migriert wurde:** Die Icon-Only-Schließen-Buttons
  in denselben beiden Edit-Dialogen (`text-black/50 hover:bg-black/5`)
  passen weder zu `secondary` (hätte fälschlich einen Rahmen ergänzt)
  noch zu einer bestehenden Variante — ein "ghost"/ohne-Rahmen-Icon-Button
  ist eine vierte Variante, die hier nicht nebenbei erfunden werden
  sollte. Bleibt offen; nebenbei fiel dabei auf, dass diese Stellen noch
  hartcodiertes `text-black/50` statt `text-text-muted` nutzen (weiterer
  kleiner Fund für einen künftigen Schritt).
- **Impact:** 6 Dateien geändert (plus `button.tsx` selbst). Typecheck
  grün, Server-Build ohne Fehler. Login-gated, nicht live getestet.
- **Date:** 2026-09-26 (Phase 16).

---

## Button/Input-Migration Runde 3: Bewertungsformulare

- **Decision:** Weitere 5 Dateien migriert:
  `campsite-review-list.tsx` und `charging-review-list.tsx`
  (Inline-Bearbeitungsformulare, `Textarea`/`Field`/`Input`/`Button`),
  `campsites/review-form.tsx` und `charging-stations/review-form.tsx`
  (vollständig, inkl. `Select` für Fahrzeug/Wohnwagen-Auswahl),
  `blocked-stations-list.tsx` (nur Card-Rahmen `border-line` statt
  `border-black/10`, kein Input-Inhalt).
- **Reason:** Fortsetzung der bereichsweisen §14-Migration (Runde 3
  nach Auth-Seiten und Profil-Formularen).
- **Was bewusst NICHT migriert wurde:** Reine "Bearbeiten"/"Löschen"/
  "Wieder freigeben"-Link-Buttons (`flex min-h-11 items-center px-2
  -mx-2 ... hover:underline`, mehrfach in `campsite-review-list.tsx`,
  `charging-review-list.tsx`, `blocked-stations-list.tsx`) — ihr
  Padding-Muster passt zu keiner der `Button`-Größen (`sm`/`md`), ein
  Erzwingen per `className` hätte denselben Tailwind-Klassenkonflikt
  riskiert wie bereits bei Runde 2 vermieden. Bleibt offen für eine
  eigene `Button`-Größe/-Variante ("link"?) in einem späteren Schritt,
  statt hier eine schlecht passende Lösung zu erzwingen.
- **Impact:** 5 Dateien geändert, dabei nebenbei drei weitere
  `border-black/10`-Fundstellen (Teil der 64 aus Runde 1) auf
  `border-line` migriert. Reine Wrapper-Ersetzung, keine
  Logikänderung. Typecheck grün. Login-gated, nicht live getestet
  (kein Test-Account) — Server-Build ohne Fehler (`preview_logs`),
  identisches, bereits verifiziertes Muster.
- **Date:** 2026-09-26 (Phase 16).

---

## Button/Input-Migration Runde 2: Profil-Formulare

- **Decision:** Weitere 8 Formulardateien auf `Button`/`Field`/`Input`/
  `Select`/`Textarea` umgestellt: `vehicle-form.tsx`, `caravan-form.tsx`,
  `change-email-form.tsx`, `change-password-form.tsx`,
  `home-address-form.tsx`, `delete-account-form.tsx`,
  `missing-station-report-form.tsx`, `preferred-providers-form.tsx`.
- **Reason:** Fortsetzung der in Phase 16 begonnenen, bewusst
  bereichsweisen Migration (§34 des Briefs) — nach den Auth-Seiten jetzt
  die Profil-Formulare, die zusammen den größten Teil der ~50
  Input-Fundstellen ausmachen.
- **Was bewusst NICHT migriert wurde:** `AddressAutocomplete` in
  `home-address-form.tsx` ist eine eigenständige Komponente mit eigener
  interner Eingabelogik, kein einfaches `<input>` — nur der
  Label-Wrapper (`Field`) wurde umgestellt, die Komponente selbst
  bleibt unverändert. Bei Buttons mit vom Standard abweichenden
  Opazitäts-/Cursor-Werten (`disabled:opacity-40/60` statt der in
  `Button` fest hinterlegten `50`) wurde der Abweichungswert **nicht**
  per `className` erzwungen (Tailwind-Footgun: zwei Utility-Klassen
  derselben CSS-Eigenschaft im selben `className`-String haben keine
  vorhersagbare Gewinner-Reihenfolge ohne `tailwind-merge`, bewusst
  nicht eingeführt, s. vorheriger Commit) — stattdessen der
  Komponenten-Default übernommen, eine minimale, nicht wahrnehmbare
  Vereinheitlichung.
- **Noch offen für einen weiteren Schritt:** Inline-Bearbeitungsformulare
  in `campsite-review-list.tsx`/`charging-review-list.tsx`,
  `review-form.tsx` (campsites/charging-stations), `route-planner-form.tsx`
  (mit 17 Input-Fundstellen die größte verbliebene Einzeldatei),
  `blocked-stations-list.tsx` sowie alle übrigen ~16 Komponententypen
  aus §14.
- **Impact:** 8 Dateien geändert, reine Ersetzung des Anzeige-Wrappers
  (keine Logikänderung an Formularverhalten). Typecheck grün. Login-
  gated (Profil-Formulare) nicht live im Browser getestet — kein
  Test-Account in dieser Umgebung, identisches, bereits an den
  Auth-Seiten verifiziertes Muster mechanisch angewendet. `/login`
  erneut visuell geprüft (unverändert), keine Konsolen-/Serverfehler.
- **Date:** 2026-09-26 (Phase 16).

---

## §14 UI Component Library: erste Primitives (Button, Card, Badge, Input)

- **Decision:** Neue `src/components/ui/`-Ordner mit vier Primitives:
  `Button`, `Card`, `Badge`, `Input`/`Select`/`Textarea`/`Field`. Auf
  `/login`, `/register`, `/passwort-vergessen`,
  `/passwort-zuruecksetzen` und `trust-preview.tsx` bereits eingesetzt
  (Vorher/Nachher-Nachweis). Dabei nebenbei einen echten Bug behoben:
  `trust-preview.tsx` nutzte `rounded-card`, eine nicht existierende
  Tailwind-Klasse (kein `--radius-card`-Token je definiert) — wirkungslos
  seit der ersten Version dieser Komponente, der Rahmen war nie
  gerundet. Per `getComputedStyle` verifiziert: jetzt korrekt 8px
  (`rounded-lg`).
- **Reason:** §14 des Design-Briefs verlangt eine formale
  Komponentenbibliothek (~20 Typen: Button, Card, Badge, Input, Modal,
  Toast, Empty/Error State, …) — bisher nur informelle, wiederholte
  Tailwind-Klassenketten pro Datei (s. `docs/DESIGN_SYSTEM.md`
  Abschnitt 5, vor dieser Änderung als offene Lücke benannt). Auf
  Nutzerwunsch mit der kleinen, hochfrequenten Basis begonnen (Button,
  Card, Badge, Input — die mit Abstand am häufigsten wiederholten
  Muster laut Code-Survey) statt aller ~20 Typen auf einmal, entspricht
  §34 des Briefs ("nicht alles auf einmal umschreiben").
- **Alternatives:** (1) alle ~20 Komponententypen aus §14 sofort
  anlegen (verworfen: Nutzerentscheidung explizit gegen diesen Umfang,
  hohes Risiko eines unkontrollierten Diffs); (2) bestehende
  Klassenketten 1:1 in die neuen Komponenten übernehmen, ohne den
  Code-Survey zur Konsolidierung zu nutzen (verworfen: der Survey zeigte
  reale Varianz — z. B. `border-black/10` vs. `border-line` bei Cards,
  `bg-action` vs. hellere/dunklere Abstufungen bei Buttons —, blinde
  Übernahme hätte die Inkonsistenz nur in eine Komponente verlagert
  statt sie zu lösen); (3) eine Utility-Library wie `tailwind-merge` für
  sauberes ClassName-Overriding einführen (verworfen: neue Abhängigkeit
  für ein Problem, das sich durch bewusste Variant-Gestaltung [Padding
  nicht separat von Variant trennen] und punktuelles Nachjustieren beim
  Einsatz vermeiden lässt, §32 Kostenoptimierung/Einfachheit).
- **Was bewusst NICHT übernommen wurde:** `TRAILER_PIN_COLORS`-basierte
  Badges und `ReviewStateBadge` bleiben eigenständig (feste
  Domänen-Semantik, keine generische Badge-Farbe angemessen, §3
  brand-guide.md). Card-Radius nutzt bewusst Tailwinds `rounded-lg`
  (8px, dem tatsächlich im Code dominanten Wert laut Survey) statt des
  in `tokens.json` dokumentierten `radius.card = 12` (Tailwind
  `rounded-xl`) — eine Diskrepanz zwischen Doku und gelebter Praxis, die
  hier bewusst nicht im selben Schritt aufgelöst wurde (eigene
  Entscheidung: Token an Praxis anpassen oder Praxis an Token
  angleichen), sondern unten als offener Punkt vermerkt.
- **Offener Punkt — geklärt (Folge-Commit, 2026-09-26):** Beim
  genaueren Hinsehen stellte sich heraus, dass auch `radius.control`
  (dokumentiert 10px) betroffen war — Buttons/Inputs nutzen durchgängig
  `rounded-md` (6px), nicht nur Cards. Beide Werte waren nie in dieser
  Form umgesetzt. Statt app-weit alle Radien auf die dokumentierten
  10px/12px umzustellen (sichtbare Änderung an ~130+ Stellen ohne
  erkennbaren Auslöser/Nutzerwunsch), wurde die Dokumentation an die
  tatsächlich gelebte Praxis angepasst: `docs/design/brand-guide.md` §5
  und `tokens.json` `radius` jetzt `control: 6`/`card: 8`, entsprechend
  Tailwinds `rounded-md`/`rounded-lg`. Entspricht demselben
  "ehrlicher Ist-Zustand statt Wunschbild"-Prinzip, das schon für
  `DESIGN_SYSTEM.md` Abschnitt 5 galt.
- **Impact:** 4 neue Dateien (`src/components/ui/button.tsx`,
  `card.tsx`, `badge.tsx`, `input.tsx`), 5 Dateien auf die neuen
  Komponenten umgestellt. Typecheck grün. Live geprüft: `/` (Card-Radius
  jetzt korrekt via `getComputedStyle`), `/login` (Formularfelder,
  Button `type="submit"` korrekt gesetzt, visuell unverändert gegenüber
  vorher). Restliche ~45 Input- und ~45 Button-Fundstellen sowie die
  übrigen ~16 Komponententypen aus §14 bleiben offen für weitere
  Schritte, s. `docs/DESIGN_SYSTEM.md` Abschnitt 5.
- **Date:** 2026-09-26 (Phase 16).

---

## Ladepunkte-Filter: Sofort-anwendende Chips statt Formular-Submit

- **Decision:** Das komplette Filter-Panel auf `/ladepunkte`
  (Anhängertauglichkeit, Ladeleistung, Steckertyp, Ladeanbieter,
  Favoriten) wurde von Checkboxen in einem `<form action="/ladepunkte">`
  mit separatem „Filtern"-Submit-Button auf sofort-anwendende Chips
  (`FilterChip`, `aria-pressed`) umgestellt — jeder Tap wirkt direkt,
  kein Absenden nötig, das Panel bleibt dabei offen. Neue Dateien:
  `src/lib/charging-station-filters.ts` (`computeActiveFilterCount`,
  `buildChargingStationFilterParams` — bewusst NICHT in
  `charging-stations.ts`, das importiert server-only Code über
  `next/headers`, siehe Kommentar dort) und
  `src/components/charging-stations/filter-chip.tsx`. Der Live-Filterzustand
  liegt jetzt client-seitig in `ChargingStationMapExplorer`
  (`liveFilters`), URL-Synchronisierung läuft über `router.replace`
  (normale Filter) bzw. `router.push` (Favoriten-Umschalten, Zurücksetzen
  — beide brauchen frische Server-Daten ohne Kartenausschnitt-Äquivalent).
- **Reason:** UX-Vergleich mit evcaravan.de (direkter Wettbewerber,
  gleiche Zielgruppe E-Auto+Wohnwagen) zeigte, dass deren Filter-Panel
  (ebenfalls Button → Bottom-Sheet, wie unseres) mit Sofort-Chips statt
  Formular-Submit spürbar weniger Taps für mehrere Filteränderungen
  hintereinander braucht — das Panel muss nicht nach jeder Änderung neu
  geöffnet werden. Passt zu CLAUDE.md Prinzip 8 (Mobile-first/Touch).
- **Alternatives:** (1) Nur die zwei Top-Filter (Anhängertauglichkeit,
  Schnelllader) umstellen, Steckertyp/Anbieter als Checkbox-Formular
  belassen (ursprünglich erwogen, dann auf Nutzerwunsch auf das ganze
  Panel ausgeweitet); (2) `window.history.replaceState` statt
  `router.replace` für die URL-Synchronisierung bei normalen Taps, um den
  zusätzlichen RSC-Request pro Tap zu sparen — **verworfen nach Bug**: das
  bringt Next.js' internen Navigationszustand durcheinander (Next merkt
  sich selbst die "aktuelle" URL unabhängig vom echten Browser-Verlauf),
  ein späterer echter `router.push`/`replace` (z. B. „Zurücksetzen")
  wurde dadurch als No-Op behandelt — URL änderte sich, Chips blieben
  optisch auf altem Stand. Durchgängig über den Next-Router korrekt,
  akzeptierter Mehraufwand: ein zusätzlicher (schlanker) Server-Request
  pro Chip-Tap neben dem ohnehin laufenden
  `/api/charge-points/viewport`-Request.
- **Impact:** `filter-fields.tsx` und `name-suggest-field.tsx` sind jetzt
  "use client" bzw. um einen kontrollierten Modus erweitert (rückwärtskompatibel
  für die weiterhin formularbasierte Campingplatz-Suche,
  `campsites/filter-form.tsx`). `ladepunkte/page.tsx` berechnet
  `activeFilterCount` nicht mehr selbst (jetzt client-seitig live über
  `computeActiveFilterCount`). Kein `<form>` mehr im Filter-Panel — das
  frühere Problem verschachtelter `<form>`-Elemente (Bewertungsformular im
  Bottom-Sheet) entfällt dadurch von selbst.
- **Date:** 2026-09-26

---

## Symbol bei Formularfehlern: neue Komponente `FormError`

- **Decision:** Neue Komponente `src/components/form-error.tsx` — zeigt
  ein ⚠-Symbol (`aria-hidden`, dekorativ, der Text bleibt die
  eigentliche Information für Screenreader) neben der Fehlermeldung.
  26 Fundstellen in 22 Dateien (alle Formular-/Aktionsfehler:
  Login/Register/Passwort-Formulare, Bewertungsformulare,
  Fahrzeug-/Wohnwagen-Formulare, Lösch-Bestätigungen, Routenplaner,
  Standortfehler) darauf umgestellt.
- **Reason:** UX-07.1 letzter offener Punkt — brand-guide.md §9 ("Farbe
  nie als einziger Informationsträger") und §3 ("Farbe steht nie allein
  — immer mit Text und/oder Symbol") waren für Formularfehler bisher
  nicht erfüllt: nur `text-error`-Farbe, kein Symbol. Bei
  Farbsehschwäche ist eine rote Fehlermeldung ohne Symbol schwerer von
  normalem Text zu unterscheiden. Eine zentrale Komponente statt 26
  Einzel-Patches, da das Muster (bedingtes `<p>`/`<span
  className="text-error">`) bereits einmal unkontrolliert an vielen
  Stellen kopiert wurde (s. UX-05.1-Historie) — soll sich nicht
  wiederholen.
- **Alternatives:** (1) Symbol nur an ausgewählten, "wichtigen" Stellen
  ergänzen (verworfen: brand-guide.md §3 gilt ausnahmslos, eine
  Teilmenge hätte dieselbe Inkonsistenz nur verschoben); (2) Symbol
  direkt in `--c-error`/`text-error` per CSS `::before` einblenden statt
  einer React-Komponente (verworfen: nicht barrierefrei steuerbar
  [kein sauberes `aria-hidden` für generiertes CSS-Content], und nicht
  jede `text-error`-Stelle ist eine Fehlermeldung — z. B. Löschen-Buttons,
  Badges, siehe vorherige Migration — ein globales CSS-Symbol hätte
  diese falsch mit-markiert); (3) unterschiedliche Symbole je nach
  Fehlerart (verworfen: unnötige Komplexität für eine einzige Rolle
  "Formularfehler", §32 Kostenoptimierung/Einfachheit).
- **Was bewusst NICHT geändert wurde:** `text-error` als reine Button-/
  Link-Farbe (z. B. "Löschen"-Aktionen, "Vermeiden"-Checkbox-Label),
  Lösch-Bestätigungsfragen ("Wirklich löschen?") und Status-Badges
  (bereits mit begleitendem Text/Icon versehen) — das sind keine
  Fehlermeldungen im Sinne von UX-07.1, sondern andere UI-Rollen, die
  weiterhin ohne Symbol auskommen.
- **Impact:** `src/components/form-error.tsx` neu, 22 Dateien angepasst
  (reine Ersetzung des Anzeige-Wrappers, keine Logikänderung an
  Fehlerzuständen selbst). Typecheck grün. Live auf `/login` mit echtem
  Fehlerfall (falsche Zugangsdaten) geprüft — Symbol + Text rendern
  korrekt. Übrige 25 Stellen sind login-/formularpflichtig, nicht
  einzeln live ausgelöst — mechanisch identische, bereits verifizierte
  Komponente. UX-07.1 damit vollständig erledigt.
- **Date:** 2026-09-26 (Phase 16).

---

## Neuer Token `--c-warning-text`: 11 hartcodierte `text-amber-*`-Stellen migriert

- **Decision:** Neuer Token `--c-warning-text` (#B45309) in
  `globals.css`/`tokens.json`/`brand-guide.md` ergänzt. Alle 11
  hartcodierten `text-amber-*`/`bg-amber-*`/`border-amber-*`-Fundstellen
  (9 Dateien) darauf bzw. auf `border-warning/30 bg-warning/5`
  (Warnboxen) und `bg-warning/15 text-warning-text` (Status-Pills)
  migriert.
- **Reason:** Beim vorigen Schritt (UX-05.1/UX-07.1 Rest) entdeckt: exakt
  dasselbe Muster wie bei `bg-red-*` — hartcodierte Farbe statt
  vorhandenem Rollen-Token. Anders als bei Error genügte hier aber kein
  reiner Klassentausch: `--c-warning` (#E8A33D, seit Phase 8) ist bewusst
  als helle Flächenfarbe für Badges/Pins gewählt (brand-guide.md §3) und
  hat als Fließtextfarbe auf `--c-surface`/`--c-card` keinen
  ausreichenden Kontrast. Der bestehende Code behalf sich pragmatisch
  bereits mit einem dunkleren Ton (`text-amber-700`, #B45309) — dieser
  Wert wird jetzt exakt als Token übernommen (keine neue Designentscheidung,
  nur die Quelle wird verbindlich), damit sich am Erscheinungsbild nichts
  ändert.
- **Alternatives:** (1) `--c-warning` selbst dunkler machen (verworfen:
  würde die Flächenrolle — Kartenpins, Status-Badges — verändern, für
  die #E8A33D bereits als bewusste Markenentscheidung dokumentiert ist,
  s. Phase 8); (2) `text-warning-text` einfach mit reduzierter Opazität
  aus `--c-warning` ableiten statt eigenem Hex (verworfen: Opazität auf
  einer bereits hellen Farbe macht sie heller, nicht dunkler — löst das
  Kontrastproblem nicht); (3) den Amber-Fund unmigriert lassen, wie
  zunächst zurückgestellt (verworfen: Nutzer hat sich für sofortige
  Migration entschieden, nachdem der Fund transparent benannt wurde).
- **Impact:** `src/app/globals.css`, `docs/design/tokens.json`,
  `docs/design/brand-guide.md` (neuer Token), 9 weitere Dateien migriert.
  Reine Farbklassen-/Farbwert-Änderung, keine Logikänderung (Zielwert
  identisch zum vorherigen hartcodierten Wert). Typecheck grün. Auf
  `/legende` (öffentlich erreichbar) per `getComputedStyle` verifiziert:
  `--c-warning-text` löst korrekt zu `#b45309` auf, die
  Opazitäts-Modifier (`border-warning/30`, `bg-warning/5`) greifen
  korrekt. Übrige Stellen login-/datenpflichtig, nicht einzeln live
  getestet. UX-07.1 damit bis auf das fehlende Symbol bei
  Fehlermeldungen vollständig erledigt.
- **Date:** 2026-09-26 (Phase 16).

---

## UX-05.1/UX-07.1 Rest: `bg-red-*`/`border-red-*` und `text-black/70` einzeln migriert

- **Decision:** Alle verbliebenen `bg-red-*`/`border-red-*`/`text-red-*`-
  Fundstellen (8 Dateien) auf `bg-error`/`border-error`/`text-error`
  migriert, mit Opazitäts-Modifiern (`border-error/30`, `bg-error/10`)
  wie bereits an anderer Stelle etabliert (`border-route/30` auf
  `/legende`). "Löschen"-Buttons nutzen `hover:bg-error/90` statt eines
  erfundenen dunkleren Rot-Tons. Von den 25 `text-black/70`-Fundstellen
  wurden 8 generische Sekundärlabels/-listen auf `text-text-muted`
  migriert; 16 Stellen (Rechtstexte, Bewertungs-Zitate,
  Startseiten-Subline, Wizard-Zustandssystem, freie Betreiber-Notizen)
  bewusst nicht angefasst.
- **Reason:** Direkte Fortsetzung der in Phase 9 begonnenen, dort
  bewusst zurückgestellten Token-Migration (`docs/design/
  ux-problems.md` UX-05.1/UX-07.1). Für `bg-red-*`/`border-red-*` gab
  es — anders als bei den Text-Opazitätsstufen — keine Unklarheit über
  eine beabsichtigte Hierarchie: alle 8 Fundstellen sind eindeutig
  Fehler-/Gefahren-Semantik (Kriterien-Fehlschlag, "nicht
  betriebsbereit", destruktive Löschen-Aktionen), für die `--c-error`
  bereits seit Phase 8 exakt vorgesehen ist. Für `text-black/70` wurde
  jede der 25 Stellen einzeln gegen den Kontext geprüft (nicht wie bei
  UX-05.1 zuvor pauschal zurückgestellt) — acht davon erwiesen sich als
  gewöhnliche Sekundärtext-Stellen ohne erkennbaren Grund für die
  höhere Kontraststufe, die übrigen 16 haben einen inhaltlichen Grund
  (Zitat, Pflichttext, bewusstes Zustandssystem), heller/gedämpfter
  wäre dort eine echte Verschlechterung.
- **Alternatives:** (1) auch `text-amber-*`-Hartcodierungen (11
  Fundstellen in 9 Dateien, beim Durchsehen zusätzlich entdeckt) im
  selben Schritt migrieren (zurückgestellt: `--c-warning` ist mit
  #E8A33D zu hell für Fließtext-Kontrast — die bestehenden
  `text-amber-700`-Stellen haben keine 1:1-Tokenentsprechung, anders
  als bei Error/Route; das ist eine eigene Entscheidung [neuer
  "Warntext"-Token ja/nein], kein reiner Klassentausch — separat zu
  klären, nicht ungeprüft im selben Schritt mitgezogen); (2) bei
  `text-black/70` alle 25 Stellen pauschal migrieren, um "fertig" zu
  sein (verworfen: hätte Rechtstexte/Zitate/Zustandssystem sichtbar
  verschlechtert, exakt das Risiko, das die ursprüngliche
  Zurückstellung in Phase 9 vermeiden wollte).
- **Impact:** 15 Dateien geändert (8 für Error-Migration, 7 für
  Text-Migration), reine Klassennamen-/Farbwert-Ersetzung ohne
  Logikänderung. Typecheck grün, keine doppelten Leerzeichen. Error-
  Migration nicht live getestet (login-/datenpflichtige Komponenten,
  mechanisch identisches, bereits an anderer Stelle verifiziertes
  Muster). UX-05.1/UX-07.1 damit bis auf den bewusst offen gelassenen
  `text-amber-*`-Fund und das fehlende Symbol bei Fehlermeldungen
  vollständig erledigt.
- **Date:** 2026-09-26 (Phase 16).

---

## Lime-Kontrast-Nebenbefund behoben: `TRAILER_PIN_TEXT_CLASS`/`_HEX`

- **Decision:** Zwei neue zentrale Exports in `src/lib/trailer-verdict.ts`
  (`TRAILER_PIN_TEXT_CLASS` für JSX-Badges, `TRAILER_PIN_TEXT_HEX` für
  die per String gebauten Karten-Popups) mappen jeden Pin-Zustand auf
  die laut brand-guide.md §9 korrekte Textfarbe — dunkel (`text-text`/
  `#0F3B36`) nur für `drive_through` (Lime), hell (`text-white`/`#fff`)
  für die übrigen vier Zustände. 9 Fundstellen (7 JSX-Badges, 2
  HTML-String-Popups) darauf umgestellt.
- **Reason:** In `docs/DESIGN_SYSTEM.md`/`ux-problems.md` als
  Nebenbefund vermerkt: mehrere Lime-Badges (Drive-Through) im Code
  verwendeten hellen statt dunklem Text — Verstoß gegen die explizite
  Kontrastregel ("Lime trägt nur dunklen Text, nie hellen"). Statt jede
  der 9 Stellen einzeln mit einer lokalen Bedingung zu patchen (Risiko:
  nächste neue Badge-Stelle vergisst die Regel wieder, wie hier
  offensichtlich bereits mehrfach passiert), eine zentrale,
  wiederverwendete Quelle — passend zu `TRAILER_PIN_COLORS`/
  `_LABELS`/`_ICON_SRC`, die bereits genauso zentral gehalten werden.
- **Alternatives:** (1) pro Stelle einzeln `pinState === "drive_through"
  ? "text-text" : "text-white"` inline schreiben (verworfen: exakt das
  Muster, das zur Inkonsistenz geführt hat — sieben Kopien derselben
  Bedingung statt einer Quelle); (2) nur die JSX-Stellen fixen, die
  beiden HTML-String-Popups (Leaflet/MapLibre, kein Tailwind dort)
  auslassen (verworfen: Nutzer sehen genau dort denselben
  Kontrastfehler, kein Grund für eine Ausnahme).
- **Impact:** `src/lib/trailer-verdict.ts` erweitert, 8 weitere Dateien
  angepasst (`src/app/ladepunkte/[id]/page.tsx`,
  `charging-station-map-explorer.tsx` [JSX + Popup-HTML],
  `route-planner-form.tsx` [JSX + Popup-HTML], `station-bottom-sheet.tsx`,
  `route-overview-panel.tsx`, `nearby-charging-modal.tsx`,
  `trust-preview.tsx` [von lokaler Sonderlösung auf die neue zentrale
  Quelle umgestellt]). Reine Farbklassen-/Farbwert-Änderung, keine
  Logikänderung. Typecheck grün, `/legende` und `/` (Drive-Through-Badge)
  visuell geprüft; die übrigen Stellen sind login-/datenpflichtig (echte
  Ladestation/Routenergebnis nötig) und nicht einzeln live getestet —
  identisches, mechanisch angewandtes Muster wie die geprüften Stellen,
  Typecheck deckt Tippfehler in den Imports ab. Nebenbefund aus
  `docs/DESIGN_SYSTEM.md`/`ux-problems.md` damit erledigt.
- **Date:** 2026-09-25.

---

## Phase 14 (Developer Handoff) gilt als erledigt ohne Figma-Export

- **Decision:** Phase 14 des Design-Briefs ("Developer Handoff
  vorbereiten") gilt inhaltlich als erfüllt durch die bereits
  vorhandenen `docs/design/tokens.json`, `docs/DESIGN_SYSTEM.md` und
  CLAUDE.md Prinzip 9 (Phase 15) — kein zusätzlicher Schritt jetzt nötig.
- **Reason:** Der Brief konzipiert "Developer Handoff" konkret als
  Figma-Seite 13 (§24: Redlines/Specs, aus Figma exportiert für
  Entwickler). Ohne angelegte Figma-Datei (s. `docs/design/
  figma-integration.md`) ist dieser wörtliche Weg blockiert — wie bei
  Phase 11/13. Der eigentliche *Zweck* von Developer Handoff (Entwickler
  bzw. hier Claude Code haben eine maschinenlesbare, verbindliche
  Spezifikation, statt raten zu müssen) ist aber bereits durch
  `tokens.json` (maschinenlesbare Werte), `DESIGN_SYSTEM.md`
  (konsolidierte Referenz) und CLAUDE.md Prinzip 9 (verbindliche
  Berücksichtigungspflicht + Konfliktmeldepflicht) erfüllt — nur eben
  code-nativ statt über einen Figma-Export.
- **Alternatives:** (1) wie Phase 11/13 explizit vertagen, kein
  Ersatz (verworfen: im Unterschied zu Phase 11/13 — echtes
  Figma-Design-System bauen bzw. Flows in Figma prototypisieren, beides
  ohne Figma-Datei technisch unmöglich — lässt sich der *Zweck* von
  Developer Handoff hier bereits ohne Figma erreichen, "warten" hätte
  keinen Mehrwert); (2) ein zusätzliches, separates
  Handoff-Dokument erstellen (verworfen: würde `tokens.json`/
  `DESIGN_SYSTEM.md` inhaltlich duplizieren, ohne neuen Nutzen).
- **Impact:** keine neuen Dateien, reine Einordnung. Sobald eine
  Figma-Datei existiert, kann eine eigene Figma-Seite "13 Developer
  Handoff" ergänzt werden (verlustfrei, da die zugrunde liegenden Werte
  bereits vollständig in `tokens.json` stehen, s.
  `docs/design/figma-integration.md`).
- **Date:** 2026-09-25 (Phase 14).

---

## Phase 9 Rest: weitere Opazitätsstufen migriert, `--c-line-strong` neu (UX-05.1)

- **Decision:** `text-black/40` und `text-black/60` (jeweils mit
  `dark:text-white/*`) auf `text-text-muted` migriert (61 Fundstellen).
  Neuer Token `--c-line-strong` (#CFCCC0, `border-line-strong`) für
  `border-black/15` (85 Fundstellen) — nicht auf `border-line`
  migriert, sondern eigener Token. `text-black/70`, `text-black/30`
  und `border-black/25` bewusst unangetastet gelassen.
- **Reason:** Die in Phase 9 offen gelassene Frage ("bildet die
  Opazitätsabstufung eine beabsichtigte Hierarchie ab oder ist sie
  selbst Teil der Inkonsistenz?") lässt sich pro Fall beantworten:
  - `/40`/`/60`: keine erkennbare eigene Bedeutung, reine
    Fließtext-Abstufung. Kontrast-Rechnung (Alpha-Overlay auf
    `--c-surface`/`--c-card`) zeigt: `/40` ist heller/kontrastärmer als
    das bereits migrierte `/50`, eine Migration auf `text-text-muted`
    ist dort eine Kontrast-*Verbesserung*. `/60` bleibt nach Migration
    weiterhin über der 4.5:1-Mindestanforderung (brand-guide.md §9).
    Beide sicher konsolidierbar.
  - `border-black/15`: beim Durchsehen aller 85 Fundstellen zeigt sich
    ein durchgängiges, konsistentes Muster — der Standardrahmen für
    praktisch jedes Formularfeld und jeden umrandeten Button app-weit,
    erkennbar getrennt von `border-line` (reine Inhalts-Trennlinien,
    `border-black/10`). Ein Zusammenlegen mit `border-line` hätte
    Eingabefelder auf `--c-surface`/`--c-card` kaum noch als solche
    erkennbar gemacht (zu geringer Kontrast) — echtes Usability-Risiko,
    kein reines Konsistenzthema. Verdient einen eigenen Token, nicht
    Wiederverwendung eines bestehenden mit anderer Rolle (§3
    brand-guide.md: "Jede Farbe hat genau eine Rolle").
  - `text-black/70`: mindestens eine Stelle (`route-wizard-tabs.tsx`,
    Zeile ~49/60) nutzt `/70` nachweislich als bewusste mittlere Stufe
    eines 3-Zustands-Systems für Wizard-Tabs (aktiv/`route` →
    erreichbar/`/70`+`border-black/25` → nicht erreichbar/`/30`+
    `border-black/10`) — eine tatsächlich beabsichtigte Hierarchie,
    keine Inkonsistenz. Die übrigen `/70`-Stellen (Rechtstexte in
    `impressum`/`datenschutz`, Bewertungs-Zitate, Startseiten-Subline)
    sind zudem die kontrastreichste der vier Stufen — eine Migration
    auf den helleren `text-text-muted`-Ton wäre das einzige Risiko
    einer echten Kontrast-*Verschlechterung* unter den vier Stufen
    gewesen, gerade bei rechtlich vorgeschriebenem Text unerwünscht.
    Bleibt offen.
- **Alternatives:** (1) alle vier Text-Opazitätsstufen undifferenziert
  auf `text-text-muted` reduzieren (verworfen: hätte das
  Tab-Zustandssystem in `route-wizard-tabs.tsx` zerstört und Rechtstexte
  kontrastärmer gemacht, ohne belegten Vorteil); (2) `border-black/15`
  ebenfalls auf `border-line` migrieren, um keinen neuen Token
  einzuführen (verworfen: hätte alle Formularfelder der App sichtbar
  unauffälliger/schwerer erkennbar gemacht — ein echtes
  Usability-Risiko für einen rein kosmetischen Konsistenzgewinn); (3)
  eigenen Token auch für `/70` einführen, um "fertig" migriert zu sein
  (verworfen: `/70` ist teils eine bewusste Komponenten-lokale
  Zustandssemantik, kein wiederkehrendes globales Muster wie `/40`,
  `/60` oder `border-black/15` — eine Tokenisierung wäre verfrüht ohne
  weitere Einzelfallprüfung, §34 des Briefs: inkrementell).
- **Impact:** `src/app/globals.css`, `docs/design/tokens.json`,
  `docs/design/brand-guide.md` (neuer Token + §5-Ergänzung). ~60 Dateien
  per Skript migriert (reine Klassennamen-Ersetzung, zweistufig: Farbklasse
  und `dark:`-Pendant separat ersetzt, da beide im Code meist durch
  andere Utility-Klassen getrennt standen, nicht direkt benachbart wie
  beim ersten Migrationsschritt in Phase 9). Typecheck grün, keine
  doppelten Leerzeichen durch die Ersetzung, visuell auf `/login`
  (Formularfelder) und `/` (Legende-Box) im Browser geprüft. `/40`,
  `/60`, `border-black/15` aus UX-05.1 damit vollständig erledigt;
  `/70`, `/30`, `border-black/25` bleiben bewusst offen, jeweils
  begründet (s. `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Fortsetzung Phase 9).

---

## Ehrlicher Hinweis statt Benachrichtigung bei Meldestatus (UX-05.7)

- **Decision:** In `missing-station-report-form.tsx` (Erfolgsmeldung
  nach dem Melden) und `profil/fehlende-saeule/page.tsx` (Liste "Meine
  Meldungen") jeweils einen Satz ergänzt, der explizit sagt: keine
  Benachrichtigung per E-Mail/Push, Status nur beim erneuten
  Seitenbesuch aktuell.
- **Reason:** Die eigentliche, vollständige Lösung von UX-05.7 (eine
  echte Benachrichtigung) verlangt Infrastruktur, die es noch nicht
  gibt — Supabase-Transaktions-E-Mail oder ein Edge-Function-Trigger,
  der bei `moderate_missing_station_report`-artigen Statuswechseln im
  Admin-Backend auslöst. Das ist zu groß für "Screens gestalten"
  (Phase 12) und laut Priorisierungstabelle ohnehin niedrigste
  Dringlichkeit ("Meldefunktion ist ein Nebenpfad, kein Kernflow"). Statt
  nichts zu tun oder eine unpassend große Änderung anzufangen: das
  eigentliche UX-Problem ist nicht nur "es gibt keine Benachrichtigung",
  sondern "niemand sagt das" — Nutzer könnten sonst annehmen, es käme
  noch eine Rückmeldung, die nie kommt. brand-guide.md §8 ("Fehler sagen,
  was passiert ist und was zu tun ist") gilt sinngemäß auch hier: ehrlich
  über die Grenze der Funktion statt Stille.
- **Alternatives:** (1) volle Benachrichtigungsfunktion jetzt umsetzen
  (verworfen: Aufwand "mittel" laut eigener Priorisierung, unverhältnismäßig
  für einen Nebenpfad, zusätzlich neue Kosten/Komplexität ohne klar
  nachgewiesenen Nutzerbedarf, vgl. CLAUDE.md Prinzip 4
  Kostenoptimierung); (2) nichts tun, Punkt als "akzeptiertes Risiko"
  auf niedriger Priorität stehen lassen (verworfen: eine Zwei-Satz-
  Ergänzung ist so gering im Aufwand, dass "nichts tun" keinen
  Vorteil hätte); (3) Hinweis nur an einer der beiden Stellen
  (verworfen: die Erfolgsmeldung erreicht nur den Moment des Meldens,
  die Listenansicht nur bei Rückkehr -- unterschiedliche Momente,
  beide relevant).
- **Impact:** 2 Dateien, reine Textergänzung, keine Logik-/Datenänderung.
  Typecheck grün. Kein Live-Test (login-pflichtig, DB-Schreibzugriff
  beim Melden, kein Test-Account in dieser Umgebung) — bei reinem
  Text ohne neue Bedingungen/Zustände vertretbar. Die eigentliche
  Benachrichtigungsfunktion bleibt offen für einen späteren,
  eigenständigen Schritt (s. `docs/design/ux-problems.md`).
- **Date:** 2026-09-25 (Phase 12, Screens gestalten).

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
