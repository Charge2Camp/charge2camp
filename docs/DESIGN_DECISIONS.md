# Design Decision Log — charge2camp

Format nach `\\MyCloud\work\charge2camp\Design\BrandDesign.rtf` §29:
**Decision / Reason / Alternatives / Impact / Date.** Neueste Einträge
oben. Jede wichtige Design-/Architekturentscheidung aus dem
Design-Prozess (Phasen 1–16, `docs/PRODUCT_AUDIT.md` und
`docs/design/*.md`) wird hier festgehalten, damit spätere Arbeit
nachvollziehen kann, *warum* eine Entscheidung getroffen wurde — nicht nur
*was* entschieden wurde.

---

## Mehrsprachigkeit (i18n): next-intl + KI-gesteuerte Übersetzungspipeline, DE als Quelle

- **Decision:** Für den geplanten europaweiten Rollout wird next-intl als
  i18n-Bibliothek eingesetzt (App-Router-nativ), mit `localePrefix:
  "as-needed"` (DE bleibt ohne Sprachpräfix, andere Sprachen bekommen
  `/en/...`, `/fr/...` etc.). DE ist die einzige von Menschen gepflegte
  Quelle; alle anderen Sprachkataloge werden ausschließlich über ein
  Skript erzeugt, das NUR neue/geänderte Schlüssel an die Anthropic API
  übergibt (zusammen mit einem gepflegten Fach-Glossar und dem
  Namespace/Schlüsselpfad als Kontext), nicht von Hand parallel gepflegt.
  Rollout-Reihenfolge: DE (bereits vorhanden) → EN (validiert die
  Pipeline) → FR/ES/IT/NL, synchron zu den jeweiligen
  Datenquellen-Rollouts. Volle Begründung und technische Details in
  [docs/i18n.md](i18n.md).
- **Reason:** Nutzerwunsch (2026-10-01): Plattform soll für den
  europaweiten Rollout auf die gängigsten Sprachen umstellbar sein, mit
  KI-gesteuerter Übersetzung, die die EV-Camping-spezifische
  Begrifflichkeit (z. B. "Lademöglichkeit", "Anhängertauglichkeit", "Nur
  abgekoppelt erreichbar") korrekt und konsistent trifft -- eine reine
  automatische Übersetzung ohne Glossar/Kontext würde genau diese
  Fachbegriffe verfehlen.
- **Alternatives:** `next-i18next` (Pages-Router-orientiert, passt nicht
  zum App-Router-Stack) verworfen. Sprachpräfix auch für DE
  (`localePrefix: "always"`) verworfen -- hätte alle bestehenden
  DE-URLs/Bookmarks/SEO-Signale gebrochen, ohne Mehrwert für die aktuell
  einzige unterstützte Sprache. Vollautomatische Übersetzung ohne
  menschliches Freigabe-Gate für neue Sprachen verworfen -- das erste
  Review einer komplett neuen Sprache bleibt ein bewusster Kontrollpunkt,
  nur spätere Diff-Updates einer bereits abgenommenen Sprache laufen
  risikoärmer automatisiert.
- **Impact:** Noch keine Code-Änderung -- reine Architekturplanung,
  dokumentiert in docs/i18n.md. Die Umstellung auf `src/app/[locale]/...`
  betrifft jede bestehende Route und wird als eigener Umbauschritt VOR dem
  eigentlichen europaweiten Daten-Rollout empfohlen, nicht parallel dazu.
- **Date:** 2026-10-01

---

## Ladepunkte-Kartenansicht: identische Mindest-Ladeleistung-Stufenauswahl wie Routenplaner

- **Decision:** Der bisherige einzelne "Nur Schnelllader (≥100 kW)"-Chip im
  Ladepunkte-Filter-Panel (`filter-fields.tsx`) ist ersetzt durch dieselbe
  Stufenauswahl wie im Routenplaner: "Kein Minimum" / "≥ 50 kW" /
  "≥ 150 kW" / "≥ 300 kW", als `WheelPickerField`-Bottom-Sheet. Default bei
  einem frischen Seitenaufruf ist jetzt ≥150 kW (vorher ≥100 kW) --
  identisch zum Routenplaner-Default (`DEFAULT_MIN_POWER_KW`,
  `route-planning.ts`).
  - `ChargingStationFilters.fastChargersOnly: boolean` ersetzt durch
    `minPowerKw: number` (0 = kein Minimum) in `charging-stations.ts` --
    `resolveFastChargersOnly` (Default bisher `true`) wird zu
    `resolveMinPowerKw` (Default bisher 150), Query-Parameter `fast=1`
    wird zu `min_power=<kW>`. `p_min_power_kw`/`.gte("max_power_kw", ...)`
    nehmen jetzt den tatsaechlichen Stufenwert statt einer festen
    Konstante.
  - `computeActiveFilterCount`/`buildChargingStationFilterParams`
    (`charging-station-filters.ts`) entsprechend angepasst.
  - `WheelPickerField`/`numericWheelOptions`/`WheelPickerOption` von
    `routing/wheel-picker.tsx` nach `ui/wheel-picker.tsx` verschoben --
    durch den zweiten, unabhaengigen Einsatzort (Ladepunkte-Filter-Panel
    zusaetzlich zum Routenplaner) erfuellt die Komponente jetzt die in
    dieser Session etablierte Promotion-Schwelle.
  - `NearbyChargingModal` (Startseiten-Popup "Ladesäule in der Nähe
    suchen") intern ebenfalls von `fastChargersOnly`/`fast=1` auf
    `minPowerKw`/`min_power=<kW>` umgestellt (identischer Server-Vertrag),
    UI dort bewusst unveraendert als einfache Checkbox belassen (kein Teil
    dieser Anfrage, nur die Server-Kompatibilitaet musste erhalten
    bleiben) -- Checkbox-Beschriftung von "≥100 kW" auf "≥150 kW"
    korrigiert.
- **Reason:** Nutzerwunsch: identische Ladeleistungsfilterung mit
  denselben Stufen wie im Routenplaner auch auf der Karte, mit demselben
  Default (150 kW).
- **Alternatives:** Den alten "Nur Schnelllader"-Chip als fuenfte, separate
  Option neben der Stufenauswahl behalten -- verworfen, das waere
  redundant (≥50/≥150/≥300 kW deckt denselben Bedarf feiner ab) und
  widerspraeche der expliziten Forderung nach identischer Filterung.
- **Impact:** Karten-Erstansicht zeigt jetzt nur noch Ladepunkte ≥150 kW
  statt ≥100 kW (etwas restriktiver) -- deckt sich mit dem bereits
  etablierten Routenplaner-Default. Live im Browser verifiziert: Trigger,
  Bottom-Sheet-Auswahl und URL-Synchronisierung (`min_power=50` nach
  Auswahl von "≥ 50 kW") funktionieren wie im Routenplaner.
- **Date:** 2026-09-27

---

## Nachbesserung: Wheel Picker als echtes Bottom-Sheet statt Inline-Widget

- **Decision:** Der im vorherigen Eintrag ("Routenplaner: Verbrauch als
  Wheel Picker...") beschriebene, direkt im Formular eingebettete Wheel
  Picker wurde noch am selben Tag durch ein Bottom-Sheet-Muster ersetzt
  (Nutzerfeedback: "nicht gut umgesetzt", gemeint war ein Wheel Picker
  als Bottom Sheet analog zu iOS `UIPickerView` bzw. dem
  Android-Aequivalent). Neue Struktur in `wheel-picker.tsx`:
  - `WheelPickerField` -- ein kompakter Feld-Trigger (Label + aktueller
    Wert + Chevron, sieht aus wie ein `Select`), der per Tap ein von
    unten einfahrendes Sheet mit Kopfzeile (Titel + "Fertig") und dem
    eigentlichen, jetzt groesseren Wheel (5 statt 3 sichtbare Zeilen)
    oeffnet.
  - `Wheel` (intern) -- generisch ueber `WheelPickerOption<T>[]` statt
    nur ueber numerische min/max/step, damit dieselbe Scroll-Snap-Wheel-
    Mechanik sowohl den Verbrauch (Zahlen) als auch die Mindest-
    Ladeleistung (benannte Stufen "Kein Minimum"/"≥ 50 kW"/...)
    bedienen kann.
  - Mindest-Ladeleistung nutzt jetzt ebenfalls `WheelPickerField` statt
    der Filter-Chip-Reihe aus dem vorherigen Eintrag -- dadurch hat
    `FilterChip` seinen zweiten Einsatzort wieder verloren und wurde von
    `ui/filter-chip.tsx` zurueck nach
    `charging-stations/filter-chip.tsx` verschoben (s.
    `docs/DESIGN_SYSTEM.md`).
  - `Modal` (`ui/modal.tsx`) wurde bewusst NICHT fuer das Sheet
    wiederverwendet -- `Modal` ist auf Mobile ein Vollbild-Sheet
    (`h-full`), hier war ein kompaktes, nur-inhaltsgrosses Sheet am
    unteren Rand gefragt. Eigenes, schlankes Sheet-Markup ohne
    Drag-Gesten (Inhalt hat feste Hoehe, anders als beim gezogenen
    `station-bottom-sheet.tsx`).
  - Beide Felder bleiben nebeneinander in einer Zeile (`flex gap-4`,
    beide `flex-1`) -- explizite Nutzeranforderung, unveraendert
    gegenueber dem vorherigen Eintrag.
- **Reason:** Die erste Umsetzung (Wheel direkt inline im Formular
  eingebettet, kleine 3-Zeilen-Ansicht) traf nicht das gemeinte
  Bedienkonzept -- native Wheel Picker auf iOS/Android erscheinen
  typischerweise in einem eigenen Bottom Sheet, nicht eingebettet
  zwischen anderen Formularfeldern. Ein generisches Sheet mit groesserem
  Wheel kommt dieser Erwartung naeher und wirkt weniger gedraengt.
- **Alternatives:** Native `<select>` mit `size`-Attribut fuer einen
  Wheel-aehnlichen Effekt -- verworfen, kein gestaltbares Snap-/
  Center-Highlight-Verhalten, wirkt nicht wie ein Wheel Picker. Eine
  npm-Bibliothek fuer iOS-/Android-Picker-Sheets -- weiterhin verworfen
  wie im vorherigen Eintrag (Prinzip 4), das selbstgebaute Sheet deckt
  den Bedarf ohne zusaetzliche Abhaengigkeit.
- **Impact:** Verbrauch UND Mindest-Ladeleistung oeffnen jetzt beide ein
  Bottom-Sheet statt eines Inline-Widgets; Formular-Feldnamen und
  Server-Validierung weiterhin unveraendert. Live im Browser verifiziert
  (Desktop + emulierter Mobile-Viewport 375×812): Sheet oeffnet sich am
  unteren Rand, Scroll- und Klick-Auswahl aktualisieren den Trigger
  korrekt, "Fertig" schliesst das Sheet.
- **Date:** 2026-09-27

---

## Routenplaner: Verbrauch als Wheel Picker, Mindest-Ladeleistung als Stufenauswahl

- **Decision:** Zwei Felder im Routenplaner-Formular (Tab 1,
  `route-planner-form.tsx`) von freier Zahleneingabe auf geführte
  Widgets umgestellt:
  - "Verbrauch mit Gespann (kWh/100km)" ist jetzt ein iOS-artiger
    Wheel Picker (neue Komponente `src/components/routing/wheel-picker.tsx`),
    Bereich 15–60 in 1er-Schritten, per CSS `scroll-snap` (kein neues
    npm-Paket, CLAUDE.md Prinzip 4) -- funktioniert auf Touch nativ mit
    Momentum-Scrolling, zusaetzlich Klick auf einen Wert sowie
    Pfeiltasten-Steuerung bei Fokus. Ein aus dem Fahrzeugprofil
    uebernommener Dezimalwert (z. B. 24.3) bleibt bis zur ersten
    Nutzerinteraktion exakt erhalten (nur die Wheel-Darstellung rundet
    auf den naechsten 1er-Schritt) -- erst ein Dreh am Wheel ersetzt ihn
    durch einen der festen Ganzzahl-Schritte.
  - "Mindest-Ladeleistung" ist jetzt eine Einzelauswahl aus vier Stufen
    ("Kein Minimum" / "≥ 50 kW" / "≥ 150 kW" / "≥ 300 kW") statt einer
    freien kW-Zahl, per `FilterChip` (siehe unten). Default beim
    Formular-Erstaufruf auf "≥ 150 kW" gesetzt
    (`DEFAULT_MIN_POWER_KW` in `route-planning.ts`, vorher 100 kW als
    freier Zahlenwert).
  - `FilterChip` (bisher nur im Ladepunkte-Filter-Panel,
    `charging-stations/filter-chip.tsx`) nach
    `src/components/ui/filter-chip.tsx` verschoben -- durch die
    Mindest-Ladeleistung-Auswahl jetzt zweiter echter Verwendungskontext,
    erfuellt damit die im §14-Komponentenbibliotheks-Prozess dieser
    Session etablierte Schwelle fuer eine Promotion nach `ui/`.
  - Die bisherige Mausrad-Inkrement/Dekrement-Loesung
    (`useNumberFieldWheel`-Hook, per echtem Non-Passive-`wheel`-Listener)
    entfaellt fuer beide Felder ersatzlos -- der Wheel Picker deckt das
    Bedienbeduerfnis fuer den Verbrauch direkt ab (Scroll IST jetzt die
    Eingabemethode), die Mindest-Ladeleistung braucht als diskrete
    Stufenauswahl kein Scroll-Inkrement mehr.
- **Reason:** Nutzerwunsch: "Wheel Picker" statt freier Zahleneingabe
  fuer den Verbrauch, und eine Stufenauswahl fuer die Mindest-
  Ladeleistung analog zu den bereits etablierten Filter-Chips in der
  Ladepunkte-Kartenansicht (Wiedererkennbarkeit im UI), mit sinnvollen,
  an gaengigen Schnelllader-Leistungsklassen orientierten Schritten
  statt beliebiger kW-Werte.
- **Alternatives:** Fuer den Wheel Picker eine npm-Bibliothek
  (`react-mobile-picker` o. Ae.) -- verworfen, CSS-`scroll-snap` deckt
  den Bedarf ohne zusaetzliche Abhaengigkeit und Bundle-Groesse
  vollstaendig ab (Prinzip 4). `WheelPicker` in `ui/` statt lokal bei
  `routing/` -- verworfen, bisher genau ein Einsatzort (analog zur
  bestehenden Begruendung fuer `SocSlider`, die aus demselben Grund
  ebenfalls lokal bleibt); wird bei einem zweiten echten
  Verwendungskontext nachgezogen. Fester Stufensatz (50/150/300) statt
  konfigurierbarer Grenzen -- bewusst so belassen, deckt die
  realistischen Leistungsklassen ab und haelt die Auswahl uebersichtlich.
- **Impact:** Verbrauchseingabe erzwingt jetzt ganzzahlige 1er-Schritte
  bei aktiver Nutzereingabe (vorher 0,1er-Schritte frei); Mindest-
  Ladeleistung ist nicht mehr frei waehlbar, sondern auf vier Stufen
  begrenzt. Formular-Submit-Feldnamen (`consumption_kwh_per_100km`,
  `min_power_kw`) und die Server-Validierung in
  `app/routenplaner/actions.ts` unveraendert -- beide Widgets tragen den
  Wert weiterhin per verstecktem `<input>` ins native Formular.
- **Date:** 2026-09-27

---

## Mindest-Stationszahl für Ladeanbieter-Filter von 5 auf 20 angehoben

- **Decision:** `MIN_STATIONS_PER_OPERATOR` (`src/lib/charging-stations.ts`)
  von 5 auf 20 erhöht. Die Liste im Ladeanbieter-Filter
  (`fetchChargingStationOperatorOptions`, Checkbox-Auswahl in
  `filter-fields.tsx`) zeigt damit nur noch Anbieter mit mindestens 20
  aktiven Stationen.
- **Reason:** Nutzerfeedback: bei einem Schwellwert von 5 rutschte zu
  viel Datenmüll (Tippfehler-Varianten, Kleinstbetreiber aus dem
  automatischen BNetzA-Import) in die Auswahl — wirkte unprofessionell
  statt eine schnelle, bequeme Filterung nach den gängigen Anbietern zu
  ermöglichen.
- **Alternatives:** Manuelle Deduplizierung/Normalisierung der
  Operator-Strings (z. B. Tippfehler-Varianten zusammenführen) — deutlich
  aufwendiger (Datenbereinigung statt reiner Anzeige-Schwellwert) und
  nicht Teil dieser Änderung; ein reiner Schwellwert-Filter löst das
  eigentliche UX-Problem (zu lange, unübersichtliche Liste) bereits
  ausreichend. Fester Wert pro Aufruf statt konfigurierbarem Parameter —
  beibehalten, da `p_min_stations` in der SQL-Funktion
  (`core.charge_point_operator_options`) ohnehin schon parametrisiert ist
  und der App-seitige Aufrufer die einzige Stelle ist, die den Wert
  braucht.
- **Impact:** Ladeanbieter-Filter zeigt weniger, aber relevantere
  Anbieter. Keine Datenbank-Migration nötig (SQL-Funktions-Default bleibt
  bei 5, wird aber immer mit explizitem `p_min_stations` aufgerufen).
- **Date:** 2026-09-27

---

## Ladepunkte-Filter-Badge zählt Standardfilter mit

- **Decision:** `computeActiveFilterCount()` (`src/lib/charging-station-filters.ts`)
  zählt ab sofort ALLE gerade wirksamen Filter, auch die beiden
  Standardwerte "Nur Schnelllader" und die Anhängertauglichkeit-
  Voreinstellung ("tauglich" &amp; "abkoppeln nötig") — vorher waren beide
  bewusst ausgeklammert (`isDefaultTrailerVerdict`), sodass die Zahl-Badge
  am Filter-Button in der Kartenansicht bei einem frischen Seitenaufruf
  0 zeigte, obwohl tatsächlich schon gefiltert wurde. Im Zuge dessen den
  erklärenden Legend-Zusatz "— standardmäßig nur „tauglich" &amp;
  „abkoppeln nötig"" in `filter-fields.tsx` entfernt.
- **Reason:** Nutzerwunsch: die Kartenansicht soll ohne Text erkennen
  lassen, dass bereits gefiltert wird — allein über die Zahl am
  Filter-Button, kein zusätzlicher erklärender Hinweistext nötig.
  `isDefaultTrailerVerdict`/`hasActiveFilters` (`ladepunkte/page.tsx`)
  bleiben unverändert bestehen — dort ist der Zweck ein anderer
  (serverseitiges Erstansicht-Limit soll nicht schon ohne Nutzerzutun
  auf 5000 statt 300 springen), die beiden Konzepte sind bewusst getrennt.
- **Alternatives:** Separater "Dot"-Indikator zusätzlich zur Zahl, oder
  ein Hinweistext neben dem Filter-Button — verworfen, da laut Rückmeldung
  die Zahl allein bereits ausreichend selbsterklärend ist und ein
  zusätzliches Element/Text nur Redundanz wäre.
- **Impact:** Der Filter-Button in der Ladepunkte-Kartenansicht zeigt nun
  auch ohne jede Nutzeraktion eine Zahl (mindestens die beiden aktiven
  Anhängertauglichkeits-Verdicts + "Nur Schnelllader", i. d. R. also 3).
  Verhalten der eigentlichen Datenabfrage (Server-Limit, Query-Params)
  unverändert.
- **Date:** 2026-09-27

---

## UX-05.7: E-Mail-Benachrichtigung bei Meldestatus-Änderung (Resend-Adapter)

- **Decision:** Neuer E-Mail-Provider-Adapter in
  `admin/lib/providers/email/` (`types.ts`/`mock.ts`/`resend.ts`/`index.ts`)
  nach dem bestehenden Provider-Muster von `src/lib/providers/`. Ohne
  gesetzten `RESEND_API_KEY` fällt `getEmailProvider()` auf einen
  mock-Adapter zurück, der nur loggt statt zu senden. Neue Funktion
  `admin/lib/notify-missing-station-report.ts` komponiert Betreff/Text für
  `approved`/`rejected` und wird aus beiden Moderations-Aktionen
  (`rejectMissingStationReport` in `fehlende-saeulen/actions.ts`,
  `approveMissingStationReport` in `fehlende-saeulen/[reportId]/actions.ts`)
  aufgerufen — jeweils NACH dem erfolgreichen Status-Update, in try/catch,
  damit ein E-Mail-Fehler die Moderations-Aktion selbst nicht blockiert
  oder rückgängig macht. Die Empfänger-Mail wird nicht aus einer
  `profiles.email`-Spalte gelesen (die ist laut bestehender Doku bewusst
  nicht synchron gehalten), sondern live über
  `supabase.auth.admin.getUserById()` (Service-Role, umgeht RLS).
  Frontend-Texte in `missing-station-report-form.tsx` und
  `fehlende-saeule/page.tsx` (Haupt-App) entsprechend angepasst — von
  "es gibt noch keine Benachrichtigung" zu "du bekommst eine E-Mail,
  Push gibt es noch nicht".
- **Reason:** CLAUDE.md Prinzip 3 (Provider über Adapter kapseln) macht
  den Provider austauschbar, falls Resend später ersetzt wird. Prinzip 2
  (keine Scheindaten) macht den mock-Fallback nötig, statt in der lokalen
  Entwicklung ohne Key so zu tun, als würde eine Mail rausgehen. Prinzip 4
  (Kostenoptimierung) — Resend kostenloser Tarif (3000 Mails/Monat, Stand
  2026, keine Kreditkarte) reicht für das MVP-Meldevolumen, per WebSearch
  aktuell verifiziert statt aus Trainingsdaten angenommen. Prinzip 5
  (keine Secrets im Code) — `RESEND_API_KEY`/`NOTIFICATION_EMAIL_FROM` nur
  als leere Variablennamen in `admin/.env.example`, kein echter Key
  irgendwo im Repo.
- **Alternatives:** Supabase-eigener E-Mail-Versand (Auth-SMTP) — verworfen,
  da dafür SMTP-Zugangsdaten eines eigenen Anbieters nötig wären, kein
  echter Vorteil gegenüber einer schlanken REST-API wie Resend. Eigene
  Edge Function mit DB-Trigger bei Statuswechsel — verworfen als
  Überkonstruktion für einen einzigen, klar lokalisierbaren Aufrufpunkt
  (zwei Server Actions), der ohne zusätzliche Infrastruktur auskommt.
- **Impact:** Melder einer fehlenden Ladesäule bekommen jetzt eine
  E-Mail, sobald ein Admin ihre Meldung freigibt oder ablehnt. Push-
  Benachrichtigungen bleiben weiterhin ein offener, separater Punkt (s.
  `docs/design/ux-problems.md`, UX-05.7) — nicht Teil dieser Änderung.
  Live-Verifikation im Browser war für diesen Schritt nicht möglich (die
  betroffenen Server Actions liegen im login-gated Admin-Backend, kein
  Test-Account verfügbar) — abgesichert stattdessen über `npx tsc
  --noEmit` (beide Apps, fehlerfrei) und Code-Review der Datenbank-Spalten
  gegen die Migration `20261003000000_missing_station_reports.sql`.
- **Date:** 2026-09-27

---

## §14 Komponentenbibliothek: verbleibende Typen bewusst nicht gebaut

- **Decision:** Toast, Progress, Toggle, Checkbox, Slider (als `ui/`-
  Primitive), Empty/Error State (als eigene Komponente) und Bottom Sheet
  (als generisches `ui/`-Primitive) werden **nicht** gebaut. Die
  Button/Card/Badge/Input/Modal-Konsolidierung (Runden 1–9) gilt damit
  als abgeschlossen.
- **Reason:** Vor jeder weiteren Komponente geprüft, ob ein echtes,
  wiederkehrendes Muster im Code existiert (dieselbe Methode wie bei
  allen bisherigen §14-Schritten — nie spekulativ bauen, immer aus
  belegtem Bedarf extrahieren):
  - Toast, Progress, Toggle: kommen im Code schlicht nicht vor (`grep`
    auf `role="switch"`/`role="progressbar"`/Toast-Muster: 0 echte
    Treffer).
  - Checkbox: 42 Fundstellen geprüft, durchgängig unstylisierte native
    `<input type="checkbox">` ohne eigenes Klassenmuster — eine
    Komponente hier würde ein neues visuelles Design erfinden statt
    Bestehendes zu konsolidieren.
  - Slider: existiert bereits als lokale Komponente (`SocSlider` in
    `route-planner-form.tsx`), aber nur an einem einzigen Einsatzort
    (intern 5-fach wiederverwendet) — kein zweiter unabhängiger
    Verwendungskontext, der einen Umzug nach `ui/` rechtfertigen würde.
  - Empty/Error State: bereits durchgängig als einfacher
    `<p className="text-sm text-text-muted">`-Absatz konsistent (s.
    `docs/design/ux-problems.md`, Phase 5: "kein Problem gefunden") —
    eine Wrapper-Komponente dafür wäre keine echte Konsolidierung.
  - Bottom Sheet: `station-bottom-sheet.tsx` ist eine funktionierende,
    eigenständige Implementierung (Drag-Gesten, Snap-Punkte) mit nur
    einem Einsatzort — eine generische Version wäre eine
    Neuentwicklung, kein Extraktionsschritt.
  In allen sechs Fällen würde "einfach bauen" gegen CLAUDE.md verstoßen
  ("Don't add features... beyond what the task requires... No
  half-finished implementations", sinngemäß auch auf spekulative
  Komponenten ohne zweiten Verwendungsfall übertragen) und gegen §34
  des Design-Briefs (inkrementell, nicht auf Vorrat).
- **Alternatives:** (1) alle sechs Typen trotzdem bauen, um "§14
  vollständig" abzuhaken (verworfen: würde reinen Blindflug-Code ohne
  Verwendungsstelle erzeugen — genau das Gegenteil der bisherigen
  Methode, die immer aus echten Fundstellen konsolidiert hat); (2) nur
  die "billigen" (Checkbox, Toggle) bauen, weil der Aufwand gering wäre
  (verworfen: geringer Aufwand rechtfertigt keine Komponente ohne
  Bedarf, das ist trotzdem spekulativ).
- **Impact:** keine Code-Änderung, reine Dokumentations-Entscheidung.
  `docs/DESIGN_SYSTEM.md` Abschnitt 5 entsprechend ergänzt, damit eine
  spätere Sitzung nicht denselben Rechercheaufwand wiederholt oder
  fälschlich annimmt, diese Typen seien schlicht vergessen worden.
- **Date:** 2026-09-26 (Phase 16, Abschluss).

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

## Campingplatzsuche: Sofort-Filter statt Formular-Submit, EV-Score/AC-DC als Kernfilter, eigene Favoriten-Kurzliste

- **Decision:** `/campingplaetze` wurde auf dasselbe Sofort-Filter-Muster
  wie Ladepunkte/Routenplanung umgestellt (kein `<form>`/"Filtern"-Button
  mehr, jede Filteränderung wirkt sofort per `router.replace`, siehe
  `campsite-search-client.tsx`). Die Kernfilter (Land, Lademöglichkeit,
  EV-Score, EV-Camping-Tauglichkeit) stehen direkt auf der Seite, alles
  andere bleibt im "Weitere Filter"-Sheet. "Lademöglichkeit" unterscheidet
  jetzt explizit "Auf dem Platz" / "AC fußläufig" / "DC fußläufig" (vorher
  nur grob "fußläufig", ohne AC/DC). EV-Score (core.campsite_search.
  ev_score) und die Community-Bewertung (rating_avg) sind neue, serverseitig
  vorberechnete Filter-/Sortierkriterien (Migration
  20261025080000_campsite_search_ev_score_ac_dc.sql). Eine neue, von den
  Filtern unabhängige Favoriten-Kurzliste (`favorites-quick-list.tsx`, Name/
  Ort/Land/Ladepunkt/EV-Score) steht permanent zwischen Filtern und
  Ergebnissen; im Gegenzug zeigt die Ergebnisliste ohne aktive Filter nicht
  mehr automatisch die Favoriten, sondern einen Aufruf zum Filtern (vorher:
  `hasActiveFilters ? fetchCampsites(filters) : fetchFavoriteCampsites(...)`
  in `campingplaetze/page.tsx`).
- **Reason:** Nutzeranfrage: Land/Lademöglichkeit(AC/DC)/EV-Score/
  EV-Tauglichkeit als Kernfilter, Favoriten-Kurzliste immer sichtbar, Liste/
  Karte jederzeit live per Filteranpassung aktualisierbar (wie beim
  Routenplaner). Die frühere, bewusste Entscheidung "Campingplatzsuche
  bleibt formularbasiert" (Eintrag "Ladepunkte-Filter: Sofort-Chips statt
  Formular-Submit" oben) galt nur bis zu dieser expliziten Anforderung —
  keine stillschweigende Rücknahme, sondern eine neue, hier dokumentierte
  Entscheidung. AC/DC-Filter stützt sich bewusst auf `core.connector.
  current_type` (breit befüllt aus OCM-/IRVE-/RIPREE-/BNetzA-Import) statt
  auf `enrich.campsite_charging.charging_type` (dünn befüllte manuelle
  Recherche) — CLAUDE.md Prinzip 2 (keine Scheindaten): ein Filter auf
  Basis eines kaum befüllten Feldes wäre für die meisten Plätze irreführend
  leer statt informativ.
- **Alternatives:** (1) EV-Score clientseitig pro Zeile nachberechnen statt
  in der DB vorzuberechnen — verworfen (Nutzerentscheidung): bei bis zu
  5000 Treffern (`fetchCampsites`-Limit) wäre serverseitige Filterung/
  Sortierung sonst nicht möglich, ohne alle Zeilen ungefiltert zu laden.
  (2) Ergebnisse in einer eigenen Route/eigenem Navigations-Tab statt auf
  derselben Seite — verworfen (Nutzerentscheidung): kein Eingriff in
  Bottom-Tab-Bar/IA nötig, Liste/Karte-Umschalter existiert auf der Seite
  bereits. (3) Favoriten weiterhin als Standard-Ergebnisliste ohne Filter
  zeigen, zusätzlich zur neuen Kurzliste — verworfen: doppelte Darstellung
  derselben Daten an zwei Stellen auf derselben Seite wäre verwirrend statt
  hochwertig wirkend.
- **Impact:** `supabase/migrations/20261025080000_campsite_search_ev_score_ac_dc.sql`
  (neue Spalten `walkable_ac_m`/`walkable_dc_m`/`rating_avg`/`ev_score` auf
  `core.campsite_search`, EV-Score-Berechnung dupliziert bewusst
  `calculateEvCampingScore()`/`ev-camping-score.ts` in SQL für die Suche —
  **beide Implementierungen müssen bei Änderungen an den Gewichtungen
  synchron gehalten werden**, siehe Kommentar in der Migration).
  `src/types/database.ts` (`CampsiteSearchRow` erweitert),
  `src/lib/campsites.ts` (`CampsiteFilters` erweitert/`charging`-Werte
  geändert: `walking` → `ac_walk`/`dc_walk`, nicht abwärtskompatibel),
  `src/lib/campsite-filters.ts` (neu, client-sicherer Filter-Helfer),
  `src/components/campsites/quick-filters.tsx`/`filter-form.tsx` (auf
  Sofort-Filter umgestellt), `campsite-search-client.tsx`/
  `favorites-quick-list.tsx` (neu), `campsite-explorer.tsx` (EV-Score-/
  AC-DC-Badges, Sortierung nach EV-Score).
- **Date:** 2026-09-28.

## Campingplatzsuche: Umkreissuche per Adresse + Bereinigung der doppelten Lademöglichkeit-Filter

- **Decision:** Neuer Kernfilter "Ort oder Adresse" (AddressAutocomplete,
  wie im Routenplaner) mit einstellbarem Umkreis (10/25/50/100/200 km,
  Wheel-Picker) auf `/campingplaetze`. Zusaetzlich wurden die beiden
  Elektromobilitaets-Merkmale `charging_on_site`/`charging_dc` (core.amenity,
  Kategorie "laden") aus dem "Weitere Lademerkmale"-Filter entfernt --
  `charging_at_pitch`/`trailer_friendly` bleiben.
- **Reason:** Nutzeranfrage (Umkreissuche). Die Rueckfrage "was ist der
  Unterschied zwischen Lademoeglichkeit und Elektromobilitaet?" hat einen
  echten Daten-/UX-Mangel aufgedeckt, keinen reinen Erklaerungsbedarf: die
  "Lademoeglichkeit"-Chips lesen aus core.campsite_search (berechnet aus
  core.campsite_charge_link, der echten Ladepunkt-Distanz-Verknuepfung),
  waehrend `charging_on_site`/`charging_dc` unabhaengig davon manuell/per
  OSM getaggte core.amenity-Merkmale sind -- beide beantworten scheinbar
  dieselbe Frage, koennen sich aber widersprechen (z. B. ein Platz mit
  `charging_on_site`-Tag, aber ohne verknuepften Ladepunkt in
  campsite_charge_link, oder umgekehrt). Ausblenden statt Umbenennen, weil
  die berechnete Variante die verlaesslichere Quelle ist.
- **Alternatives:** (1) beide Filter behalten und nur umbenennen/erklaeren
  (z. B. Tooltip) -- verworfen: loest den Widerspruch nicht, nur die
  Verwirrung ueber den Namen. (2) Umkreissuche server-seitig ueber PostGIS
  `ST_DWithin`/eine neue RPC statt Lat/Lon-Bounding-Box + Haversine-
  Nachfilterung -- verworfen (CLAUDE.md Prinzip 4, Kostenoptimierung):
  core.campsite_search hat keine Geometrie-Spalte, eine neue Spalte/RPC nur
  fuer diesen Filter waere unverhaeltnismaessig, die Bounding-Box nutzt den
  vorhandenen `idx_cssearch_geo`-Index und ist bei den hier relevanten
  Fallzahlen (max. 5000 Treffer) performant genug.
- **Impact:** `src/lib/campsites.ts` (`CampsiteFilters.near`/`radiusKm`,
  Bounding-Box-Vorfilter + Haversine-Trim + Distanz-Sortierung in
  `fetchCampsites`), `src/lib/campsite-filters.ts` (`RADIUS_KM_OPTIONS`,
  URL-Parameter `near_lat`/`near_lon`/`near_label`/`radius_km`),
  `quick-filters.tsx` (Adressfeld + Umkreis-Wheel-Picker, entfernte Chips),
  `campsite-explorer.tsx` (Sortierung "Entfernung", Default bei aktiver
  Umkreissuche).
- **Date:** 2026-09-28.

## Campingplatzsuche: "Laden am Stellplatz" in "Auf dem Platz" konsolidiert (kein eigener Filter mehr)

- **Decision:** `charging_at_pitch` (core.amenity, "Laden am Stellplatz")
  ist kein eigener Filter-Chip mehr. Stattdessen zaehlt es jetzt auf
  Datenebene direkt als "Laden auf dem Platz" mit: `core.campsite_search.
  charging_on_site` (und damit auch der EV-Score) beruecksichtigt
  `charging_at_pitch` als zusaetzliches automatisches Signal, sobald keine
  manuelle Recherche (enrich.campsite_charging.has_charging) vorliegt,
  siehe die neue Funktion `core.campsite_has_onsite_charging()` (Migration
  20261025090000). Das "Weitere Lademerkmale"-Fieldset in quick-filters.tsx
  entfaellt komplett (war nach der vorherigen Bereinigung ohnehin nur noch
  dieser eine Chip).
- **Reason:** Nutzeranfrage: "Laden am Stellplatz ist auch nicht relevant
  [als eigener Filter] ... wichtig ist, dass diese Merkmale alle
  konsolidiert ein nutzbarer Filter sind fuer Laden am Campingplatz, egal
  ob auf dem Platz oder am Stellplatz." Laden am Stellplatz ist immer eine
  Teilmenge von Laden auf dem Platz (der Stellplatz liegt auf dem Platz) --
  ein separater, gleichrangiger Filter dafuer war unnoetig granular und
  verstaerkte genau die Verwechslungsgefahr aus dem vorherigen Eintrag.
  Nebeneffekt (Datenqualitaet): vorher fiel ein Platz, der NUR per
  `charging_at_pitch`-Tag markiert war (keine enrich-Recherche, keine
  core.campsite_charge_link-Verknuepfung), faelschlich durchs
  "Auf dem Platz"-Filterraster -- das ist mit der Konsolidierung behoben.
- **Alternatives:** `charging_at_pitch` weiterhin als eigenen, aber z. B.
  umbenannten Chip zeigen -- verworfen: loest nicht das Kernproblem
  (Nutzeranfrage will explizit EINEN konsolidierten Filter, keine
  Umbenennung).
- **Impact:** `supabase/migrations/20261025090000_campsite_onsite_charging_includes_pitch_amenity.sql`
  (neue Funktion `core.campsite_has_onsite_charging()`, ersetzt 4 identische
  `coalesce(ecc.has_charging, exists(...))`-Ausdruecke in
  `core.campsite_search` inkl. der ev_score-Berechnung -- eine Aenderung an
  dieser Logik wirkt sich dadurch jetzt automatisch auf beide Stellen aus).
  `quick-filters.tsx` (Fieldset/evAmenities-Code entfernt, `amenityCatalog`-
  Prop nicht mehr benoetigt), `campsite-search-client.tsx` (Aufruf
  angepasst).
- **Date:** 2026-09-28.

## Admin: "Laden direkt am Stellplatz" nicht mehr separat pflegbar

- **Decision:** Im Admin-Campingplatz-Detail entfallen die Checkbox "Laden
  direkt am Stellplatz" (`enrich.campsite_charging.pitch_charging`) und die
  Kategorie "Elektromobilitaet" (`charging_on_site`/`charging_at_pitch`/
  `charging_dc`) im Merkmale-Formular. Es bleibt eine Checkbox "Laden auf dem
  Platz moeglich (inkl. direkt am Stellplatz)". Die Spalte `pitch_charging`
  bleibt im Schema (Abwaertskompatibilitaet, API/Meilisearch), wird vom
  Admin aber nicht mehr geschrieben.
- **Reason:** Die Konsolidierung vom 2026-09-28 galt nur fuer Filter/Daten,
  das Admin-Formular bot die Unterscheidung weiter an. Die Checkbox hatte
  keine Wirkung auf Filter/EV-Score (nur `has_charging` zaehlt), konnte aber
  zu Widerspruechen fuehren: nur "Stellplatz" angehakt, "Platz" nicht =>
  Platz gilt als ohne Laden.
- **Alternatives:** Spalte per Migration droppen -- verworfen (CLAUDE.md:
  keine Funktionalitaet entfernen, API-Feld `charging.pitch_charging`).
- **Impact:** `admin/app/(dashboard)/campingplaetze/[id]/page.tsx`, `actions.ts`.
- **Date:** 2026-10-03.

## Campingplatz-Namensvorschläge serverseitig statt vorgeladener Namenslisten

- **Decision:** Die Namensvorschläge im Campingplatz-Suchfeld
  (`NameSuggestField`) und die Campingplatz-Vorschläge im Routenplaner-Ziel
  (`AddressAutocomplete`) kommen jetzt aus einer debounced serverseitigen
  Suche (`GET /api/campsites/suggest`, ab 3 Zeichen, max. 8 Treffer,
  Präfix-Treffer zuerst) statt aus beim Seitenaufruf vorgeladenen Listen.
  `NameSuggestField` behält den `options`-Modus für die Ladepunkt-Suche
  (dort unverändert). Die Koordinaten einer gespeicherten Route werden beim
  Öffnen per Namen serverseitig nachgeschlagen (`?name=`), das Routenziel
  `?destination_campsite_id=` per ID. Zusätzlich liefert
  `core.campsite_country_options()` (`20261026110000`) die Länderliste des
  Land-Filters in SQL.
- **Reason:** Die alten Listen (`order by name limit 5000`) verloren ab
  >5.000 Campingplätzen (EU-Rollout, aktuell ~3.700) alle Namen jenseits des
  Alphabet-Endes und hätten mit jedem Land mehr Payload an jeden Client
  geschickt; die Länderliste las zufällige erste 5.000 Zeilen ohne
  `order by`/`distinct` und verlor ab da stillschweigend Länder (SQL-Perf-
  Review 2026-10-26, Befunde 1-3).
- **Alternatives:** Vorgeladene Listen weiter vergrößern -- verworfen, wächst
  mit jedem Land und verschiebt nur die Obergrenze. Obergrenze nur anheben --
  gleiches Problem, nur später.
- **Impact:** Neue Vorschläge brauchen eine Netzwerkabfrage (Debounce
  300-350 ms); bei Fehler/Offline bleibt das Feld frei beschreibbar, nur die
  Vorschlagsliste fehlt (Photon-Adressvorschläge laufen unabhängig). Eigene
  Campingplatz-Treffer erscheinen im Routenplaner, sobald ihre Antwort da
  ist, unabhängig von Photon. `campsites.ts`: `fetchCampsiteNameOptions`/
  `fetchCampsiteDestinationOptions` entfernt, `suggestCampsites`/
  `fetchCampsiteDestinationByName`/`ById` neu; `src/lib/campsite-suggest.ts`
  (client-sicherer Teil). Seiten `/campingplaetze` und `/routenplaner`
  laden keine Campingplatz-Namensliste mehr.
- **Date:** 2026-10-26.

## Ladepunkte-Karte: unverzerrte Stichprobe + Hinweis bei gekappter Ansicht

- **Decision:** Enthält ein Kartenausschnitt mehr Ladepunkte als das Server-
  Limit (1.500), liefert `core.charge_points_in_bbox` eine stabile Stichprobe
  (`order by id`, Migration `20261026140000`) statt der alphabetisch ersten
  1.500 Namen. Die Karte liest das bereits mitgelieferte Antwortfeld
  `truncated`: der Zähler zeigt "1500+" und darunter den Hinweis "Auswahl --
  zoome hinein, um alle zu sehen"; nach einer gekappten Antwort wird beim
  Hineinzoomen (sichtbare Breite < 70 % der Breite beim letzten Laden)
  nachgeladen, auch wenn der Ausschnitt noch im vorgeladenen Bereich liegt.
- **Reason:** Gemessen in Produktion (gepolsterter Europa-Ausschnitt, ab
  150 kW): 16.023 Ladepunkte, die Namenssortierung zeigte nur Namen von
  " AdS…" bis "Aral Pulse" -- 84 von 1.033 Betreibern, angeführt von Aral/
  Allego/ALDI SÜD; EnBW (1.265), IZIVIA (816), EWE Go (662) und Tesla (596)
  fehlten praktisch. Mit `order by id` erscheinen 297 Betreiber proportional
  zu ihrem Anteil. Die Anzeige "1500" wirkte zudem wie "das sind alle".
- **Alternatives:** Grid-Sampling ("stärkster Lader je Zelle") -- in
  Produktion 9-16 s (alle Zeilen lesen/sortieren) bzw. > 20 s (Index-Zugriff
  je Zelle), nicht tragfähig; ein Vorab-Aggregat je Zoomstufe wäre eine
  große Änderung an der Import-Pipeline. Sortierung nach Leistung -- bei
  Gleichstand wieder nach Name, kaum besser. Serverseitige Cluster mit
  Zählern -- größte Änderung (neues Antwortformat, neue Interaktion), für
  später offen. Nur Schnelllader bei weitem Zoom -- der Default (≥ 150 kW)
  hat im Europa-Ausschnitt trotzdem ~16.000 Treffer.
- **Impact:** Bei sehr weitem Zoom zeigt die Karte weiterhin nur eine
  Stichprobe (~9 %), jetzt aber betreiberneutral, stabil (kein Flackern beim
  Schwenken) und erkennbar als Auswahl. Der Hinweis nutzt die Pille oben links
  (zweite Zeile, Textfarbe text-text-muted aus den Design-Tokens, Du-Form, sachlich).
  Beim Hineinzoomen aus einer gekappten Ansicht entsteht ein zusätzlicher
  Request (Debounce 150 ms, wie bisher abbrechbar). `charging-station-map-
  explorer.tsx`, `route.ts`/`charging-stations.ts` (Kommentare).
- **Date:** 2026-10-26.

## Ladepunkte-Viewport: Anreicherung in einem Datenbank-Roundtrip, Platzhalter ohne Trailer-Objekt

- **Decision:** Der bbox-Pfad von `fetchChargingStations` holt Stationen samt
  Connectoren und Trailer-Daten über `core.charge_points_in_bbox_enriched`
  (Migration `20261026150000`) in EINER Abfrage, statt über ~20 gebatchte
  PostgREST-Abfragen (`enrichStations`). Die Funktion ruft die bestehende
  `core.charge_points_in_bbox` und liefert je Station JSON mit `connectors`
  (Array) und `trailer` (Objekt oder `null`) -- nur mit Feldern, die der Client
  liest (kein `geom`, kein `verified_by`/`manual_override`/`source_type`).
  Reine Platzhalter-Zeilen von `enrich.trailer_suitability` (verdict `unknown`,
  origin `auto`, ohne Notiz/drive_through) liefern `trailer = null`. Dazu zwei
  Indizes: Covering Index `idx_conn_cp_covering` auf `core.connector`
  (Index-Only-Scan) und Teilindex `idx_ts_meaningful` nur für aussagekräftige
  Trailer-Zeilen (~2.500 statt 137.000 Einträge). `enrichStations` bleibt für
  den nicht-bbox-Pfad und die Favoriten unverändert.
- **Reason:** Gemessen in Produktion (1.500 Stationen): selbst bei vollem Cache
  kosten 1.500 PK-Lookups auf `enrich.trailer_suitability` ~1,15 s und 1.500
  Connector-Lookups ~0,55 s; kalt dauerte die Connector-Einzelabfrage 3,3 s.
  134.801 von 137.287 Trailer-Zeilen sind Platzhalter (0 mit weiteren Daten), die
  der Client nicht von "kein Eintrag" unterscheidet (`getReviewState('auto')` =
  `getReviewState(null)`, Pin 'ungeprüft' für `unknown` wie `null`) -- für sie
  wurde bisher trotzdem gesucht und übertragen. Nebenbei verschwindet die
  Auslieferung der Nutzer-UUID `verified_by` an jeden Client.
- **Alternatives:** Nur Spalten einschränken (`select` statt `select *`) --
  spart Payload, aber nicht die ~20 Abfragen und Lookups. Connectoren/Trailer erst
  beim Antippen laden -- die Karte braucht den Verdict-Pin und die Listenkarte die
  Stecker sofort. Connector-JSON auf `core.charge_point` denormalisieren -- würde
  den Kalt-Cache-I/O ganz entfernen, braucht aber Pflege in Import-Pipeline/Trigger;
  bei Bedarf der nächste Schritt.
- **Impact:** Für den Client ist nichts sichtbar anders (gleiche Pins, Badges,
  Karten). `trailer` ist für Platzhalter `null` statt eines `unknown/auto`-
  Objekts; der JS-Filter auf `trailer.verdict` entfällt im bbox-Pfad (filtert schon
  SQL-seitig), Connector-/Betreiber-Filter bleiben in JS. Neue Indizes: Aufbau mit
  einfachem `CREATE INDEX` (blockiert Schreibzugriffe auf `core.connector` kurz;
  302.901 Zeilen). `src/lib/charging-stations.ts` (`applyPostFilters`,
  bbox-Zweig).
- **Date:** 2026-10-26.

## Trailer-Filter "Noch nicht bewertet": alles ohne echte Bewertung, nicht nur Platzhalter-Zeilen

- **Decision:** Wählt der Nutzer im Anhängertauglichkeits-Filter "Noch nicht
  bewertet" (`unknown`), erscheinen jetzt alle Ladepunkte **ohne echte Bewertung**
  -- also auch die ohne jede `enrich.trailer_suitability`-Zeile. Umgesetzt als
  "ausschließen, wenn eine echte Bewertung (Nicht-Platzhalter) mit einem Verdict
  außerhalb der Auswahl existiert" in `core.charge_points_in_bbox` und
  `core.search_charge_points_by_verdict` (Migration `20261026160000`); der
  JS-Filter im nicht-bbox-Pfad behandelt `trailer === null` ebenso als `unknown`.
  Karte und Erstansicht haben dieselbe Bedeutung.
- **Reason:** (1) Geschwindigkeit: der alte Zweig suchte je Kandidat die
  Platzhalter-Zeile in der 137.287-Zeilen-Tabelle (Produktion, padded Europa-
  Ausschnitt, 150 kW: 0,6-1,4 s warm, vorher ~77 ms mit Namenssortierung); jetzt
  nur noch der winzige Teilindex `idx_ts_meaningful` (~2.500 Einträge).
  (2) Korrektheit: 23.650 aktive Ladepunkte (19 %) hatten keine Zeile und waren
  durch keinen Verdict-Filter erreichbar, obwohl die Oberfläche sie als "Noch nicht
  bewertet" kennzeichnet (`getReviewState(null)` = `getReviewState('auto')`).
- **Alternatives:** Bisherige Bedeutung ("nur Platzhalter-Zeile") beibehalten und
  per denormalisiertem Flag auf `core.charge_point` + Trigger beschleunigen --
  größere Änderung (Schema, Import-Pipeline), die 19 % bleiben unerreichbar.
- **Impact:** Die Treffermenge von "Noch nicht bewertet" wächst um die Ladepunkte
  ohne Zeile (lokal mit nachgebildeter Verteilung: +9.575 im Ausschnitt). Der
  selektive Zweig (nur `yes`/`unhitch`/`no`) und der Zweig ohne Verdict-Filter sind
  unverändert. `src/lib/charging-stations.ts` (`applyPostFilters`). Der Admin-
  Listenfilter (`charge_point_admin_list`) ist bewusst NICHT geändert.
- **Date:** 2026-10-26.

## Ladepunkte-Karte: Betreiber- und Steckertyp-Filter wirken vor der Stichprobe

- **Decision:** `core.charge_points_in_bbox` und `core.charge_points_in_bbox_enriched`
  bekommen die Parameter `p_operators` und `p_connector_standards` (Migration
  `20261026180000`). Beide Filter greifen in SQL vor `order by id limit p_limit`;
  `fetchChargingStations` übergibt sie im bbox-Pfad (gleiche Semantik wie im nicht-
  bbox-Pfad: exakte Betreibernamen, exakte Steckerstandards aus
  `standardsForCategories`). Die JS-Filter in `applyPostFilters` bleiben als
  redundantes Sicherheitsnetz.
- **Reason:** Vorher liefen diese beiden Filter erst NACH der id-Stichprobe von
  höchstens 1.500 Ladepunkten in JS. Bei weitem Zoom zeigte ein Betreiberfilter
  deshalb nur den Stichprobenanteil (~9 %) der passenden Ladepunkte -- lokal mit
  nachgebildeten Daten: Ionity 188 statt 1.500, CCS 476 statt 1.500; in Produktion
  hat z. B. EnBW 1.265 Ladepunkte im Europa-Ausschnitt, in der Stichprobe 120-139.
- **Alternatives:** Filter weiter in JS und das Limit anheben -- skaliert nicht
  (EU-Datenmenge) und behebt nur die Kappung, nicht die Kosten der Anreicherung.
- **Impact:** Bei aktivem Betreiber-/Steckerfilter füllt die Karte bis zu 1.500
  passende Ladepunkte; ist die Menge größer, gilt weiter der Hinweis "Auswahl --
  zoome hinein" (`truncated`). Kosten in Produktion (äquivalente Kandidatenabfrage,
  padded Europa-Ausschnitt, ab 150 kW, warm): Betreiber 5-8 ms, Type 2 35 ms,
  CHAdeMO 120-340 ms, Steckertyp ohne Treffer im Ausschnitt ~375 ms; kalt jeweils
  Sekunden wie bei den übrigen Pfaden. Signaturänderung: alte Signaturen werden vor
  dem Neuanlegen gedroppt (kein doppelter Overload); der bisherige Code ruft ohne die
  neuen Parameter auf und läuft unverändert weiter (Defaults), die Migration kann vor
  dem Code-Deploy angewendet werden.
- **Date:** 2026-10-26.

## Ladepunkte-Karte: schmale Kopie core.charge_point_map gegen Kaltstart-I/O (Daten bis 15 Minuten verzögert)

- **Decision:** Die Karten-Viewport-Abfrage (`core.charge_points_in_bbox` und damit
  `_enriched`) liest nicht mehr die breite Haupttabelle `core.charge_point`, sondern
  die Materialized View `core.charge_point_map` (Migration `20261026190000`): aktive
  Ladepunkte mit nur den Spalten von `core.charge_point_geo` (+ lat/lon) und eigenen
  Indizes (id, GiST geom, id-Teilindex ab 150 kW, (operator, id), Trigram auf name,
  external_key, Leistung). Aktualisiert wird sie per pg_cron alle 15 Minuten
  (`core.refresh_charge_point_map()`, `REFRESH ... CONCURRENTLY`), Muster wie
  `core.campsite_search`. Erstansicht, Suche, Detailseiten und Admin lesen weiter
  `core.charge_point`.
- **Reason:** Gemessen in Produktion: `core.charge_point` hat 431 MB Heap + 187 MB
  Indizes bei `shared_buffers` 224 MB (`effective_cache_size` 384 MB) -- die
  Tabelle passt nicht in den Cache, die id-Stichprobe der Karte liest verstreute
  Seiten von der Platte (Erstaufrufe nach Ruhephasen 6-9 s statt 0,1-0,5 s). Die
  Durchschnittszeile ist 1.364 Byte, davon 1.111 Byte `field_provenance` (jsonb, von
  der Karte nie gelesen); die Karte braucht ~260 Byte. Ein Auslagern per
  `SET STORAGE EXTERNAL`/`toast_tuple_target` wirkt nicht (lokal geprüft: Zeilen
  unter 2 KB werden nie ausgelagert, Heap blieb bei 187-200 MB).
- **Alternatives:** `field_provenance` in eine eigene Tabelle auslagern -- behebt die
  Ursache für alle Abfragen und hält die Daten live, berührt aber Import-Pipeline
  (9 Python-Dateien), Admin-Backend, OCM-Cron-Route und mehrere Migrationen und
  braucht ein Wartungsfenster für den Tabellen-Rewrite (exklusive Sperre); bei Bedarf
  später. Nur Client-Retry -- lässt den I/O unverändert, kann zusätzlich kommen.
- **Impact:** **Karten-Daten hinken Änderungen an `core.charge_point` (Import,
  Admin-Bearbeitung, Deaktivierung, neue Ladepunkte) um bis zu 15 Minuten
  hinterher** -- lokal getestet: Änderung unsichtbar bis zum Refresh, dann sichtbar.
  Fällt der Cron-Job aus, bleibt die Karte unbemerkt auf altem Stand
  (`cron.job_run_details` prüfen). Erwartet: hot set (View ~100 MB + Connector-Index
  20 MB + Trailer-Teilindex) passt in die 224 MB shared_buffers. Neuer
  Wartungspunkt: Änderungen am Spaltensatz von `core.charge_point_geo` müssen in der
  View nachgezogen werden. Kein Einfluss auf Anzeige/Verhalten außer der Verzögerung.
- **Date:** 2026-10-26.

## Ladepunkte-Karte: planarer Kartenausschnitt statt Geographie-Polygon, Grenzen werden begrenzt

- **Decision:** `core.charge_points_in_bbox` vergleicht den Kartenausschnitt jetzt
  planar (`geom::geometry && ST_MakeEnvelope(west, south, east, north, 4326)`,
  GiST-Index auf dem Ausdruck `(geom::geometry)` von `core.charge_point_map`;
  Migration `20261026200000`) statt als Geographie-Polygon. Zusätzlich begrenzt
  `clampBounds` (`src/lib/map-bounds.ts`) Kartenausschnitt und gepolsterten Rand im
  Client auf ±180/±90, und die API-Route validiert den `bbox`-Parameter über
  `parseBboxParam` (endliche Zahlen, west ≤ east, south ≤ north; Werte außerhalb
  des Bereichs werden begrenzt, vertauschte Seiten mit 400 abgelehnt).
- **Reason:** Reproduziert lokal und mit PostGIS in Produktion: ein Geographie-
  Polygon hat Großkreis-Kanten und ist ab ~180° Längenbreite nicht mehr das
  Lat/Lon-Rechteck der Karte. Mit Testdaten (alle Ladepunkte bei Länge 5-15,
  Breite 44-54; richtige Antwort immer 49.600): Breite 200°/300° und
  "fast Welt" lieferten **0** Ladepunkte (stille leere Karte), die korrekt
  geklemmte Welt (-180..180) und Breite -90..90 warfen **"Antipodal edge
  detected"**, Werte außerhalb ±180 wurden **umgewickelt** (west -200 → 561
  statt 49.600 Ladepunkte). Reines Klemmen im Client hätte das nicht behoben.
  Nebenbefund: auch normale Ausschnitte lieferten zu viele Ladepunkte außerhalb
  des Rechtecks (+4 % bis +87 % bei Testboxen, Vergleich mit einem reinen
  lon/lat-Vergleich); jetzt exakt.
- **Alternatives:** Nur im Client klemmen -- behebt weder die Welt-Ansicht noch die
  Umwicklung. Beim Geographie-Polygon bleiben und breite Boxen aufteilen --
  aufwendig und weiter ungenau. Eine eigene geometry-Spalte in der View -- gleich
  wirksam, aber Neuaufbau der View statt eines Ausdrucksindex.
- **Impact:** Stark herausgezoomte Karten (gepolsterte Breite > 180°, sichtbar
  > ~120°) funktionieren wieder (vorher leer oder Fehlerbanner). Am Nord-/Südrand
  eines Ausschnitts entscheidet jetzt der konstante Breitengrad statt eines
  gewölbten Großkreises. Der alte Geographie-GiST-Index `idx_cpm_geom` entfällt.
  Neuer Test `src/lib/map-bounds.test.ts`.
- **Date:** 2026-10-26.

## Ladepunkte-Karte: Wiederholung bei vorübergehenden Abruffehlern, kürzeres Rate-Limit-Fenster

- **Decision:** Der Karten-Client wiederholt den Viewport-Abruf bei vorübergehenden
  Fehlern (HTTP 429/500/502/503/504: bis zu 3 Versuche mit 2 s und 5 s Wartezeit;
  Netzwerkfehler/Timeout: ein zweiter Versuch; ein numerischer `Retry-After`-Header
  hätte Vorrang, max. 15 s). Dauerhafte Fehler (z. B. 400/401) werden nicht
  wiederholt. Bis zum Endergebnis steht "Lädt…", die alten Marker bleiben. Der Hinweis
  am Zähler nennt jetzt die Ursache statt immer "keine Verbindung": "zu viele
  Anfragen, kurz warten" (429), "keine Verbindung" (Netzwerk/Timeout), "Laden
  fehlgeschlagen" (sonstige Fehler). Regeln in `src/lib/viewport-retry.ts` (mit
  Unit-Tests). Das Rate-Limit des Endpunkts wechselt von 120 Aufrufen je 60 s auf
  40 je 20 s (gleiche Dauerlast von 120/min).
- **Reason:** (1) Gemessen im Browser: der Client ruft nur ab, wenn der Ausschnitt den
  vorgeladenen Bereich verlässt -- 20 abwechselnde Zoomschritte in ~10 s lösten keinen
  einzigen Request aus; die in der Review genannten "bis zu 6 Requests/s" sind eine
  theoretische Obergrenze. (2) Der echte Schaden liegt beim Überschreiten: das Rate-
  Limit ist ein FESTES Fenster (`core.check_rate_limit`), der Nutzer ist dann bis zu
  60 s gesperrt, und die Karte meldete irreführend "keine Verbindung" ohne
  Wiederholung. Ein Kaltstart-Timeout wurde ebenfalls nie wiederholt, obwohl die
  Abfrage serverseitig weiterläuft und den Cache wärmt.
- **Alternatives:** Debounce von 150 ms auf 300-400 ms anheben -- bringt wegen der
  Bereichs-Prüfung kaum weniger Requests, verzögert aber jede Aktualisierung. Limit
  anheben -- schwächt den Schutz ohne Bedarf. Server-seitiges Schutzfenster
  (`Retry-After` aus der DB berechnen) -- zusätzliche Migration, der Client-Backoff
  genügt. Laufende, überholte Requests abbrechen -- spart im Client nichts und
  bräuchte ein Durchreichen des Abbruchs bis in die RPC (bei Bedarf später).
- **Impact:** Bei kurzer Überlastung oder Kaltstart sieht der Nutzer "Lädt…" statt
  sofort einen Fehler; nach spätestens ~7 s (HTTP) bzw. 2 Versuchen (Timeout) erscheint
  der ursachenbezogene Hinweis, der nächste Kartenschwenk startet einen neuen Zyklus.
  Wiederholungen zählen selbst gegen das Rate-Limit. Das Limit sperrt höchstens 20 s
  statt 60 s. `charging-station-map-explorer.tsx`, `route.ts`.
- **Date:** 2026-10-26.

## Ladepunkte-Erstansicht: liest ebenfalls die schmale Karten-Kopie

- **Decision:** Die serverseitig gerenderte Erstansicht von `/ladepunkte` liest jetzt
  `core.charge_point_map` (Migration `20261026210000`) statt der breiten Haupttabelle:
  `core.search_charge_points`, `core.search_charge_points_by_verdict` (alle drei
  Zweige) und `core.charge_point_operator_options` zählen/lesen die Kopie;
  `fetchChargingStationNameOptions` liest sie direkt (`grant select` an
  `service_role`). Neue Indizes `idx_cpm_name_op` (name) include (operator) und
  `idx_cpm_fast_name` (name) where max_power_kw ≥ 150 ersetzen die Namensindizes der
  Haupttabelle für `order by name limit N`. Signaturen und Rückgabetypen bleiben
  unverändert. Favoriten, Detailseiten, Admin und Campingplatz-Suche lesen weiter live.
- **Reason:** Dieselbe Ursache wie bei der Karte (20261026190000): `core.charge_point`
  hat 431 MB Heap und passt nicht in 224 MB shared_buffers. Gemessen in Produktion
  (erster Aufruf / warm): Standard-Erstansicht 587 / 227 ms, 1.000 Namensvorschläge
  867 / 2 ms, Betreiber-Optionen 483 / 66 ms -- nach Ruhephasen über eine Sekunde
  DB-Zeit vor der Anreicherung. Nebenbei sind Erstansicht und Karte jetzt
  konsistent (beide dieselbe Kopie), statt sich nach Admin-Änderungen kurz zu
  widersprechen.
- **Alternatives:** Erstansicht gar nicht mehr serverseitig laden (die Karte holt
  ohnehin sofort den Viewport) -- größere UX-Änderung. `enrichStations` der Erstansicht
  ebenfalls in einen Roundtrip ziehen -- eigener Schritt, bei Bedarf später.
- **Impact:** Alle Ergebnisse lokal gegen Hashes der bisherigen Funktionen verglichen:
  identisch (Standardansicht, alle Verdict-Pfade, Betreiber-/Steckerfilter, q,
  Leistungsstufen, Betreiber-Optionen, Namensliste). **Erstansicht, Namensvorschläge und
  Betreiber-Optionen hinken Änderungen an `core.charge_point` um bis zu 15 Minuten
  hinterher** (pg_cron-Refresh, wie die Karte). `anon`/`authenticated` können
  `search_charge_points*` nicht mehr direkt aufrufen (kein Select auf der Kopie) --
  die App nutzt ausschließlich den Admin-Client.
- **Date:** 2026-10-26.

## Betreiber-Optionen der Ladepunkte-Seite aus vorberechneter Zählung

- **Decision:** `core.charge_point_operator_options` liest die Materialized View
  `core.charge_point_operator_counts` (Anzahl aktiver Ladepunkte je Betreiber, ohne
  null und Platzhalter in Klammern; Quelle `core.charge_point_map`) statt bei jedem
  Aufruf alle ~124.000 Ladepunkte zu zählen (Migration `20261026220000`). Signatur,
  Rückgabetyp, `security definer` und der Admin-Check bleiben unverändert; der
  Schwellenwert `p_min_stations` wird auf der kleinen Tabelle angewendet. Der
  bestehende pg_cron-Job (`core.refresh_charge_point_map()`, alle 15 Minuten)
  aktualisiert jetzt zuerst die Karten-Kopie und danach die Zählung.
- **Reason:** Gemessen in Produktion nach 20261026210000: 385 ms beim ersten Aufruf,
  ~90 ms warm -- bei jedem Aufruf von `/ladepunkte`, obwohl sich die Betreiberliste
  kaum ändert; der langsamste Teil der Erstansicht. Die View hat ~10.600 Zeilen (nur
  wenige hundert mit ≥ 20 Stationen, dem Schwellenwert der Seite).
- **Alternatives:** Cache in Next.js (`unstable_cache`/`use cache` mit Revalidate) --
  zusätzliche, versionsabhängige Caching-Schicht (AGENTS.md warnt vor Abweichungen
  dieser Next-Version), pro Instanz/Deployment verschieden und ohne Nutzen für andere
  Aufrufer. Index-Only-Zählung über `idx_cpm_operator_id` -- spart nur einen Teil
  der Arbeit, zählt weiterhin bei jedem Aufruf.
- **Impact:** Die Betreiberliste hinkt Änderungen an `core.charge_point` um bis zu
  15 Minuten hinterher (wie Karte und Erstansicht). Scheitert der zweite Refresh,
  schlägt der Cron-Job fehl (`cron.job_run_details`); die Karten-Kopie ist dann
  trotzdem aktualisiert. Lokal gegen die bisherige Funktion verglichen (Schwellen
  1/5/20/100/99999 und Reihenfolge): identisch.
- **Date:** 2026-10-26.

## Überwachung der Cron-Jobs: Gesundheitsfunktion, GitHub-Check und Dashboard-Karte

- **Decision:** `core.cron_job_health(job, max_alter_minuten)` (Migration
  `20261026230000`, nur `service_role`) meldet je pg_cron-Job: aktiv, letzter
  abgeschlossener Lauf, letzter Erfolg und dessen Alter, Fehlschläge in den letzten 10
  Läufen und ein Gesamturteil `healthy` mit Klartext-Grund (healthy = aktiv, mind. ein
  Erfolg, letzter abgeschlossener Lauf erfolgreich, letzter Erfolg jünger als das Limit).
  Zwei Konsumenten: (1) der Workflow `.github/workflows/cron-health.yml` ruft sie alle
  30 Minuten über `.github/scripts/check-cron-health.sh` auf und schlägt fehl, wenn ein
  Job ungesund ist **oder die Abfrage selbst scheitert** -- GitHub benachrichtigt dann
  über den fehlgeschlagenen Lauf; (2) eine Statuskarte "Hintergrundjobs" im Admin-
  Dashboard (`admin/components/cron-job-card.tsx`; Symbol + Text, Farbe nur
  unterstützend). Geprüft wird zunächst `refresh-charge-point-map` (Limit 35 Minuten).
- **Reason:** Karten-Kopie, Erstansicht und Betreiber-Optionen hängen am 15-Minuten-Job
  `refresh-charge-point-map` (20261026190000/210000/220000); fällt er aus, bleiben sie
  ohne sichtbaren Fehler veraltet. Dass genau das passiert, zeigt der Bestand:
  `refresh-all-quality-data` scheitert seit 2026-09-23 jede Nacht (10 Läufe in Folge) an
  einem Statement-Timeout beim Insert in `core.charge_point_duplicate`, zuletzt
  erfolgreich am 2026-09-22 -- die Datenqualitäts-Zahlen im Dashboard sind seit zehn
  Tagen veraltet, ohne dass es jemand bemerkt hat.
- **Alternatives:** Vercel-Cron als Prüfer -- die Crons dieses Projekts sind täglich
  (vercel.json, 60-s-Limit), eine 30-Minuten-Prüfung ist dort nicht möglich. Sentry --
  ohne regelmäßigen Auslöser und eine extern zu konfigurierende Alarmregel wirkungslos.
  Nur Dashboard-Karte -- passiv, hilft nur, wenn jemand hinsieht.
- **Impact:** Der Workflow läuft nur auf dem Standardbranch (`development`), kann sich
  bei Last um Minuten verzögern und meldet einen Dauerfehler bei JEDEM Lauf (alle 30
  Minuten). `refresh-all-quality-data` ist bewusst NICHT im Workflow (Limit 1560 min),
  solange er scheitert -- sonst schlüge der Check ab dem ersten Lauf dauerhaft fehl; das
  Dashboard zeigt ihn bereits rot. Neuen Job aufnehmen: `CRON_HEALTH_JOBS` im Workflow
  und `CRON_JOBS` im Dashboard ergänzen. Lokal gegen simulierte Laufhistorien getestet
  (gesund, veraltet, letzter Lauf fehlgeschlagen, laufend, hängend, nur Fehlschläge,
  deaktiviert, unbekannter Job, Berechtigungen) und das Skript gegen Gesund/Ungesund/
  nicht erreichbar/falscher Schlüssel/ungültige Konfiguration.
- **Date:** 2026-10-03.

## Funktionsrechte in core/enrich: nur service_role, Allow-Liste für authenticated

- **Decision:** Alle Funktionen in `core` und `enrich` sind nur für `service_role`
  ausführbar; `authenticated` erhält ausdrücklich nur die fünf RPCs, die App und Admin
  mit der Nutzer-Session aufrufen (`submit_trailer_report`, `submit_campsite_charging`,
  `moderate_trailer_report`, `research_queue`, `run_quality_checks`), `anon` keine.
  Default-Privilegien entziehen PUBLIC das Ausführungsrecht für künftige Funktionen.
  Migration `20261027030000`, Test `ingest/test_function_privileges.py`.
- **Reason:** Postgres vergibt EXECUTE standardmäßig an PUBLIC, und `core`/`enrich`
  sind über PostgREST exponiert. Die Migrationen hatten nur Rechte vergeben, nie
  entzogen -- dadurch war z. B. `enrich.set_trailer_suitability` mit dem öffentlichen
  Anon-Key aufrufbar und konnte manuelle Caravan-Bewertungen überschreiben (harte
  Regel 1). Lokal mit dem Anon-Key über die REST-API nachgewiesen und nach dem Fix mit
  `permission denied` (HTTP 401) bestätigt. OPTIMIERUNG.md, Befund S-4.
- **Alternatives:** Pro Funktion eine Berechtigungsprüfung im Funktionskörper
  ergänzen -- 17 Funktionen, und jede künftige Funktion wäre wieder standardmäßig offen.
  Schemas `core`/`enrich` aus PostgREST entfernen -- bricht den Service-Role-Zugriff
  von App, Admin und Cron über supabase-js.
- **Impact:** Jede neue Funktion, die die Nutzer-Session braucht, muss ausdrücklich
  an `authenticated` gegrantet werden und in die Allow-Liste des Tests (CLAUDE.md,
  Falle 5). Sonst schlägt der Aufruf mit `permission denied` fehl.
- **Date:** 2026-10-03.

## Nächtlicher Qualitätsjob: Dubletten-Insert als Gleichheits-Join, 20 Minuten Zeitbudget

- **Decision:** Migration `20261026240000`: (1) Der zweite Insert in
  `core.refresh_charge_point_duplicates()` (Kandidaten über exakte normalisierte Adresse +
  PLZ) berechnet die Normalisierung einmal je Zeile in einer CTE und verbindet per
  Gleichheits-Join auf (normalisierte Adresse, PLZ); `b.external_key > a.external_key` und
  die 5-km-Grenze sind nur noch Join-Filter. (2) Der Cron-Befehl von
  `refresh-all-quality-data` lautet jetzt `set statement_timeout = '20min'; select
  core.refresh_all_quality_data()` (via `cron.alter_job`, Job-ID und Historie bleiben).
  Alles andere an der Funktion ist unverändert.
- **Reason:** Der Job scheiterte 11 Nächte in Folge (2026-09-23 bis 2026-10-03, jeweils nach
  exakt 2:00 Minuten = `statement_timeout`), zuletzt erfolgreich am 2026-09-22 (1:42).
  Der Planer führte den alten Self-Join quadratisch aus: je Zeile eine Bitmap-Suche, die den
  Adressindex per `BitmapAnd` mit einem Bereichsscan auf `external_key < b.external_key`
  verband (im Schnitt die halbe Indexgröße, ~54.000 Einträge; Kostenschätzung ~1,0 × 10⁹).
  Gemessen auf Produktion: 13,4 s für nur 170 Zeilen (~79 ms/Zeile, hochgerechnet ~3 Stunden
  für alle); die neue Form braucht 11,5 s für den gesamten Select und liefert auf einer
  Stichprobe dieselben Paare (38, identischer Hash). Folgen des Ausfalls: Dublettentabelle
  und Dashboard-Zahlen 11 Tage veraltet, automatisches Zusammenführen und Qualitätsprüfungen
  liefen nie (die ~23.000 am 27./28.09. importierten Ladepunkte wurden nicht dedupliziert).
- **Alternatives:** Nur den Insert beschleunigen -- der erste Insert verbraucht schon fast
  das ganze 2-Minuten-Limit, die übrigen Schritte passen dann vermutlich nicht in die
  Restzeit. Nur das Limit erhöhen -- der quadratische Insert bräuchte Stunden. Den Job in
  mehrere Cron-Einträge aufteilen -- sauberer isoliert, aber größerer Umbau; bei Bedarf
  später. Funktionsindex um die PLZ erweitern -- das Problem ist nicht der Index, sondern
  die Ungleichung im Join.
- **Impact:** Gleichwertig geprüft: a.address/a.postcode müssen nicht null sein, ein
  Gleichheitsvergleich schließt null auf der b-Seite ohnehin aus; lokal erzeugen alte und
  neue Funktion auf gezielten Testfällen (Dreier-Gruppen, Groß-/Kleinschreibung, PLZ im Text,
  führende Hausnummer, räumlich schon abgedeckte Paare, inaktive Zeilen, Abstand > 5 km,
  andere/leere PLZ, leere Adresse) dieselbe Tabelle. Ohne `is_active`-Filter wie bisher. Der
  erste Lauf nach dem Fix arbeitet 11 Tage Rückstau ab und kann länger dauern; das Limit
  gilt nur für diesen Lauf. Erst wenn der Job wieder erfolgreich läuft, in
  `CRON_HEALTH_JOBS` des Workflows `cron-health.yml` aufnehmen (Limit 1560 Minuten).
- **Date:** 2026-10-03.

## Sicherheits-Header: CSP zunächst Report-Only, ohne Nonces

- **Decision:** App und Admin setzen über `headers()` in `next.config.ts` auf allen
  Pfaden `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, HSTS (2 Jahre, ohne preload),
  eine `Permissions-Policy` (App: Geolocation nur self; Admin: keine) und eine
  Content-Security-Policy **als Report-Only**. `X-Powered-By` ist abgeschaltet.
  Baustein: `src/lib/security-headers.ts` (Test daneben), Kopie in
  `admin/lib/security-headers.ts`. OPTIMIERUNG.md, Befund S-2.
- **Reason:** Bisher setzte keine der beiden Apps Sicherheits-Header (Clickjacking auf
  das Admin-Backend möglich). Report-Only, weil MapLibre (Worker aus `blob:`),
  Supabase-Auth, Sentry und eventuell Vercel-Werkzeuge (Preview-Toolbar) aus mehreren
  Ursprüngen laden und ein vergessener Ursprung Karte oder Login lahmlegen würde.
  Lokal mit vorübergehend erzwungener CSP geprüft: Login, Ladepunkte-Karte inkl. Zoom
  und Photon-Adresssuche funktionieren ohne Verstoß.
- **Alternatives:** Nonces über `proxy.ts` (Next-Doku) -- strenger (`script-src` ohne
  `unsafe-inline`), aber Umbau der Proxy-Logik beider Apps; später möglich. CSP sofort
  erzwingen -- Risiko eines Ausfalls in Prod durch nicht lokal sichtbare Ursprünge.
- **Impact:** Verstöße landen bei gesetzter `NEXT_PUBLIC_SENTRY_DSN` als Security-
  Report in Sentry. Bleiben sie eine Weile aus, in beiden `next.config.ts`
  `enforceCsp: true` setzen. Neue Browser-Ziele (fetch aus dem Client) müssen in
  `connectSrc` ergänzt werden, sonst blockiert die erzwungene CSP sie.
- **Date:** 2026-10-03.
