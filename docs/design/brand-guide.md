# charge2camp — Brand Guide

Version 1.0 · Stand September 2026

Diese Datei ist die verbindliche Referenz für Logo, Farbe, Typografie, Icons und Sprache.
Alle Werte liegen maschinenlesbar in `tokens/tokens.css` und `tokens/tokens.json`.

---

## 1. Die Marke in einem Satz

charge2camp zeigt, wo man mit Wohnwagen laden kann, ohne abzukoppeln.

Alles im Design folgt daraus: Wer mit einem 12-Meter-Gespann unterwegs ist,
braucht keine schönen Bilder, sondern eine schnelle, ehrliche Antwort auf die Frage
"passe ich da rein?". Das Design ist deshalb ruhig, sachlich und kontraststark —
lesbar bei Sonne, mit Handschuhen, am Straßenrand.

---

## 2. Logo

### Aufbau

Das Zeichen zeigt eine Ladesäule links und einen vollständigen Wohnwagen in
Seitenansicht, verbunden durch eine waagerechte Deichsel mit Kupplung.
Der Wohnwagen ist an vier Merkmalen erkennbar: abgeschrägte Front, Tür im vorderen
Drittel, eine mittige Achse mit halb verdecktem Rad, Deichsel.

### Dateien

| Datei | Verwendung |
|---|---|
| `assets/logo/icon-dark.svg` | Standard. App-Icon, dunkle Flächen, Profilbilder |
| `assets/logo/icon-light.svg` | Auf dunklen Fotos und Farbflächen |
| `assets/logo/wordmark.svg` | Zeichen plus Schriftzug, quer |
| `assets/logo/favicon.svg` | Ab 32 px abwärts, reduzierte Zeichnung |

### Regeln

- Schutzraum rundum: eine halbe Icon-Breite. Nichts rückt näher heran.
- Das Zeichen wird nie freigestellt. Es braucht seine Grundfläche als Kontrast.
- Mindestgröße: 24 px digital, 8 mm im Druck. Darunter `favicon.svg` verwenden.
- Nicht verzerren, nicht drehen, nicht umfärben, keine Effekte, kein Schatten.
- Der Schriftzug wird kleingeschrieben. Die "2" steht in `--c-route`.

---

## 3. Farbe

Jede Farbe hat genau eine Rolle. Wer eine Farbe zweckentfremdet, zerstört ihre Wirkung.

| Token | Hex | Rolle |
|---|---|---|
| `--c-base` | #0F3B36 | Basis: Kopfbereiche, Text, dunkle Flächen |
| `--c-action` | #C6F24E | Nur Aktionen: Buttons, aktive Filter, Drive-Through-Pin |
| `--c-route` | #1D9E75 | Route, Fortschritt, positive Zustände |
| `--c-surface` | #F2F0E8 | Hintergrundfläche |
| `--c-card` | #FDFCF9 | Karten und Listeneinträge auf der Fläche |
| `--c-tint-trailer` | #E8F5C0 | Hinweisflächen zu Gespann-Themen |

### Formular-/Systemfeedback

Für allgemeine Rückmeldungen (Formularfehler, Warnhinweise) — unabhängig
von der Ladepunkt-Status-Semantik unten, auch wenn die Hex-Werte
übereinstimmen (Rot = Gefahr, Amber = Vorsicht ist in beiden Rollen
dieselbe Bedeutung, aber die Zielgruppe ist eine andere).

| Token | Hex | Rolle |
|---|---|---|
| `--c-error` | #B4443A | Formularfehler, blockierende Systemmeldungen |
| `--c-warning` | #E8A33D | Warnhinweise, nicht-blockierend (Flächen: Badges, Pins) |
| `--c-warning-text` | #B45309 | Warnhinweise als Fließtext — `--c-warning` ist zu hell für 4.5:1-Kontrast als Textfarbe |

Wie jede Statusfarbe (Regel 2 oben) steht auch Fehler-/Warnfarbe nie
allein — immer mit Text und/oder Symbol, nie nur als roter/oranger Rahmen
oder Text ohne Erklärung.

### Statusfarben

Ausschließlich für Ladepunkte, nie dekorativ.

| Token | Hex | Bedeutung |
|---|---|---|
| `--c-status-free` | #1D9E75 | frei |
| `--c-status-busy` | #E8A33D | belegt |
| `--c-status-down` | #B4443A | außer Betrieb |
| `--c-status-unknown` | #8E9A94 | ungeprüft |

### Zwei harte Regeln

1. Lime bedeutet "antippbar" oder "Drive-Through". Nie beides auf einem Bildschirm
   uneindeutig. Die Auswahl auf der Karte wird deshalb über Größe angezeigt, nicht über Farbe.
2. Farbe steht nie allein. Jeder Status hat zusätzlich ein Zeichen (Kreuz, Ausrufezeichen,
   Haken, Pfeil, Fragezeichen). Das ist Pflicht, nicht Kür — Karte bei Sonne, Farbsehschwäche.

---

## 4. Typografie

- Überschriften: Manrope, 700
- Fließtext und UI: Inter, 400 und 500
- Zahlen immer in Inter, wegen der besseren Ziffern bei kW- und km-Angaben.

| Rolle | Größe | Zeilenhöhe | Gewicht |
|---|---|---|---|
| Display | 36 px | 1.15 | 700 |
| H1 | 26 px | 1.2 | 700 |
| H2 | 20 px | 1.3 | 500 |
| Fließtext | 15 px | 1.55 | 400 |
| Sekundär | 13 px | 1.5 | 400 |
| Label | 12 px | 1.4 | 500 |

Immer Satzanfang groß, nie Versalien. Zeilenlänge höchstens 72 Zeichen.

---

## 5. Form und Abstand

- Radien: 6 px für Bedienelemente (Tailwind `rounded-md`), 8 px für Karten (`rounded-lg`),
  Pillenform nur für Buttons und Filter-Chips.
- Abstände auf 4er-Raster: 4, 8, 12, 16, 24, 32, 48, 64.
- Keine Schatten, keine Verläufe. Tiefe entsteht durch den Wechsel von Fläche und Karte.
- Trennlinien 1 px in `--c-line`.
- Formular-/Bedienelement-Rahmen (Eingabefelder, Buttons mit Rahmen, Dropdowns) 1 px in
  `--c-line-strong` — kräftiger als reine Trennlinien, damit Eingabefelder auf `--c-surface`
  und `--c-card` als solche erkennbar bleiben.
- Tap-Ziele mindestens 44 px. Die App wird im Auto und bei Wind bedient.

---

## 6. Icons

24er-Raster, 2 px Strichstärke, runde Enden und Ecken, ausschließlich Outline.
Der aktive Zustand entsteht über Farbe, nie über Füllung.

Vorhanden: `home`, `laden`, `route`, `camping`, `profil`, `community`, `anhaenger`.

Der Anhänger ist kein Menüpunkt, sondern der Marker für alles Gespann-Bezogene:
Filter-Chip, Hinweisfläche, Listeneintrag.

Menüleiste: Home, Laden, Route, Camping, Profil. Fünf Tabs sind das Maximum auf
schmalen Geräten — Community bleibt deshalb weiterhin im Profil statt in der
Leiste. Home ersetzt seit dem Vollbild-Kartenumbau der Ladepunkte-Seite (mobil)
den Zugriff aufs Logo im Header, der auf schmalen Geräten seither entfällt.

---

## 7. Kartenpins

Fünf Zustände, jeweils eigene Farbe und eigenes Zeichen. Die Reihenfolge ist eine Skala
von schlecht nach ideal.

| Pin | Farbe | Zeichen | Bedeutung |
|---|---|---|---|
| nicht tauglich | #B4443A | Kreuz | Gespann passt nicht |
| bedingt tauglich | #E8A33D | Ausrufezeichen | vermutlich abkoppeln nötig |
| ohne Abkoppeln | #1D9E75 | Haken | Stellplatz fürs Gespann vorhanden |
| Drive-Through | #C6F24E | Pfeil | durchfahren statt rangieren |
| ungeprüft | #8E9A94 | Fragezeichen | Angabe fehlt noch |

- Jeder Pin hat eine helle Kontur, sonst verschwindet er auf Wald- und Wiesenflächen.
  Der Lime-Pin bekommt eine dunkle Kontur, sonst franst er auf hellen Straßen aus.
- Der ausgewählte Pin wird größer, nicht andersfarbig.
- Standardzustand neuer Einträge ist "ungeprüft", nicht "tauglich".
  Lieber ehrlich unbekannt als falsch optimistisch.
- Filter "Nur geprüfte anzeigen" gehört von Anfang an dazu.

---

## 8. Sprache

- Per Du, kurz, sachlich, keine Ausrufezeichen.
- "4 Ladepunkte frei" statt "Super, hier ist Platz!"
- Fachbegriffe wie Durchfahrtsladen oder Gespannlänge ruhig verwenden.
  Die Zielgruppe kennt sie und fühlt sich ernst genommen.
- Buttons benennen die Handlung: "Zur Route hinzufügen", nicht "Absenden".
- Leerzustände sind eine Einladung, keine Entschuldigung:
  "Noch keine Route geplant. Ziel eingeben und loslegen."
- Fehler sagen, was passiert ist und was zu tun ist. Keine Entschuldigung, kein "Ups".

---

## 9. Barrierefreiheit

- Kontrast mindestens 4.5:1 für Text. Lime trägt nur dunklen Text, nie hellen.
- Farbe nie als einziger Informationsträger.
- Sichtbarer Fokusrahmen bei Tastaturbedienung.
- `prefers-reduced-motion` respektieren.
- Alle Icons haben ein `aria-label` oder sind als dekorativ markiert.

---

## 10. Ladeanimation

Statt Spinner oder Sanduhr lädt die Marke sich selbst auf: Ein Lichtpunkt läuft von der
Ladesäule über die Deichsel in den Wohnwagen, der sich dabei von links nach rechts füllt.
Datei: `assets/logo/loader.svg`.

### Timing

| Zeit | Vorgang |
|---|---|
| 0 s | Wohnwagen dunkel, Blitz in der Säule pulst |
| alle 0,63 s | Lichtpunkt läuft über die Deichsel |
| 0,1–1,2 s | Wohnwagen füllt sich von links nach rechts |
| 1,2–1,7 s | Fenster und Tür erscheinen, Zustand hält |
| 1,7–1,9 s | Rückblende auf leer, Zyklus beginnt neu |

Gesamtzyklus 1,9 s, endlos, ohne harten Sprung.

### Regeln

- Einsatz nur bei Vorgängen über 400 ms: Routenberechnung, Kartendaten, erster Start.
  Kürzere Wartezeiten bekommen gar keinen Indikator, sonst flackert die Oberfläche.
- Mindestanzeigedauer 900 ms. Ein halb gefüllter Wohnwagen, der sofort verschwindet,
  wirkt wie ein Fehler.
- Mindestgröße 64 px. Darunter füllt sich der Wohnwagen sichtbar ruckartig,
  dann besser einen einfachen Fortschrittsbalken in `--c-action` verwenden.
- Immer mit Text darunter, was gerade passiert: "Route wird berechnet",
  "Ladepunkte werden geladen". Ein Indikator ohne Erklärung erhöht die gefühlte Wartezeit.
- `prefers-reduced-motion` ist in der Datei berücksichtigt: Die Animation hält an
  und zeigt den gefüllten Endzustand.

### Umsetzung nativ

Das SVG nutzt CSS-Keyframes und läuft im Web ohne Zusatzcode. Für iOS und Android
die vier Teilanimationen nachbauen: Füllbreite, Sichtbarkeit der Details, Farbwechsel
der Deichsel, Position des Lichtpunkts. Alternativ das SVG in eine Lottie-Datei
überführen — kein GIF, das kann weder saubere Transparenz noch scharfe Kanten.
