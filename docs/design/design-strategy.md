# Designstrategie — charge2camp

Stand: 2026-09-25. Phase 6 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §33, §6, §7, §8).
Setzt die Leitplanken für Phase 7 (CI/Branding) bis Phase 16
(Migration) auf Basis von [PRODUCT_AUDIT.md](../PRODUCT_AUDIT.md),
[information-architecture.md](information-architecture.md),
[user-flows.md](user-flows.md) und [ux-problems.md](ux-problems.md).

Diese Strategie trifft **keine Umsetzungsentscheidungen im Detail** —
sie legt fest, *wie* die folgenden Phasen vorgehen, nicht *was* konkret
gebaut wird.

---

## 1. Markenpersönlichkeit: Ist-Abgleich

Der Brief definiert die UX-Leitidee ("Die App versteht das gesamte
Gespann") und ein Designziel als Adjektivpaar (§6/§7): **hochwertig,
modern, vertrauenswürdig, technisch kompetent, sympathisch, einladend,
outdoor-orientiert, europäisch, klar, einfach, professionell** — explizit
**nicht** wie eine billige Camping-App, überladene Outdoor-App, generische
Nachhaltigkeits-App, klassische Energieversorger-App, technische
Entwickleroberfläche oder reine Karten-App.

**Befund:** Das bestehende `docs/design/brand-guide.md` erfüllt diese
Leitidee bereits sehr genau, ohne dass es für diesen Prozess neu
geschrieben wurde:

- "Ruhig, sachlich, kontraststark — lesbar bei Sonne, mit Handschuhen, am
  Straßenrand" (brand-guide.md §1) ist eine direkte, sogar konkretere
  Übersetzung von "klar, einfach, professionell, technisch kompetent".
- Die reduzierte Farbpalette (ein dunkles Markengrün als Basis, ein Lime
  ausschließlich für Aktionen, keine Verläufe/Schatten) vermeidet aktiv
  die "generische grüne Nachhaltigkeits-App"-Falle — Grün ist hier
  Markenfarbe, nicht Öko-Symbolik.
- Die Sprachregeln (§8 brand-guide.md: "4 Ladepunkte frei" statt "Super,
  hier ist Platz!") verhindern die "überladene Outdoor-App"-Tonalität.
- Das Logo (Ladesäule + Wohnwagen, verbunden durch eine Deichsel) codiert
  die UX-Leitidee ("versteht das gesamte Gespann") bereits direkt ins
  Zeichen.

**Konsequenz für Phase 7:** Gemäß Brief-Vorgabe ("Das bestehende Logo soll
grundsätzlich übernommen und nicht ohne konkreten Grund neu erfunden
werden", Ergänzung vor §8) wird das bestehende Logo/Designkonzept als
**verbindliche Ausgangsbasis** behandelt. Phase 7 ist damit primär eine
**Prüf- und Vervollständigungsaufgabe** (fehlt etwas? ist etwas
inkonsistent umgesetzt?), keine Neuentwicklung. Ein aus dem Nichts neu
erfundenes Farbsystem oder eine neue Wortmarke wäre eine unbegründete
Abweichung von §5 des Briefs ("nicht ohne Grund ändern").

## 2. Referenz-Apps: Rolle im Prozess

§8.8 des Briefs nennt Google Maps, Apple Karten, Komoot, Park4Night
u. a. als Referenzen für Teilaspekte (Karteninteraktion, Routenführung,
Community-Funktionen) — ausdrücklich **nicht** zum Kopieren. Für die
weitere Arbeit gilt:

- Referenzen werden **punktuell pro Entscheidung** herangezogen (z. B.
  "wie zeigt Komoot eine mehrstufige Routenzusammenfassung an", wenn Tab 3
  des Routenplaner-Wizards überarbeitet wird), nicht als Vorlage für einen
  kompletten Screen.
- Jede Übernahme eines Interaktionsmusters wird im
  [Design Decision Log](decision-log.md) (Phase 8 des Briefs, §29) mit
  Referenz-App und Begründung dokumentiert, sobald das Log existiert.
- charge2camp bleibt in einem Punkt bewusst von allen Referenzen
  verschieden: **Anhängertauglichkeit vor Kürze** (CLAUDE.md-Prinzip 7)
  — keine Referenz-App hat dieses Kriterium, es ist nicht verhandelbar.

## 3. Strategische Leitplanken für Phase 7–16

1. **Bestehendes System ist die Grundlage, nicht der Entwurf.**
   `brand-guide.md`/`tokens.json` werden erweitert und präzisiert, nicht
   ersetzt. Jede neue Farbe/jeder neue Abstand muss sich in die
   bestehenden Rollen einordnen (§3 brand-guide.md: "Jede Farbe hat genau
   eine Rolle").
2. **Figma folgt dem Code, nicht umgekehrt — vorerst.** Da das
   Token-System bereits im Code lebt (`globals.css`,
   `docs/design/tokens.json`), wird Phase 10 (Figma-Integration) die
   bestehenden Tokens nach Figma importieren/abbilden, nicht neue Werte in
   Figma erfinden und in den Code zurückspielen. Erst nach diesem
   Abgleich wird Figma für neue visuelle Entscheidungen führend (§24/§25
   des Briefs).
3. **Component Library (Phase 9) zuerst dort ansetzen, wo Inkonsistenz
   bereits nachgewiesen ist.** UX-05.1 (33 Dateien mit rohen
   Farb-Utilities statt Tokens) ist der konkrete Startpunkt für Phase 9 —
   eine Basis-Komponentenschicht (Text/Card/Button-Primitives mit
   Tokens fest verdrahtet) behebt das Problem strukturell, statt 33
   Dateien einzeln zu patchen.
4. **Rechtliche Pflichtpunkte vor gestalterischen Wünschen.** UX-05.6
   (Impressum/Datenschutz-Erreichbarkeit) wird vor rein visuellen
   Verbesserungen behoben, sobald Phase 9/12 konkrete Komponenten anfasst,
   die den mobilen Nicht-eingeloggt-Zustand betreffen.
5. **Kein Eingriff in den Login-Torbogen (UX-05.3) ohne gesonderte
   Freigabe.** Die Login-Pflicht ist eine Sicherheitsentscheidung (§5
   Kategorie D), keine Designentscheidung. Phase 6 entscheidet nur, dass
   `/` als einziger öffentlicher Screen in Phase 12 (Screens gestalten)
   bewusst mit erhöhter Sorgfalt behandelt wird — nicht, dass die
   Login-Pflicht selbst zur Diskussion steht.
6. **Inkrementell, mit Vorher/Nachher-Vergleich (§34 des Briefs).** Keine
   der 33 UX-05.1-Dateien wird in einem einzigen großen Commit
   umgeschrieben. Migration erfolgt bereichsweise (z. B. zuerst
   Profil-Unterseiten, dann Explorer/Detail-Seiten), jeweils mit
   funktionalem und visuellem Vergleich vor/nach.
7. **App-Store-Tauglichkeit bleibt Querschnittsanforderung.** Jede neue
   Komponente/jeder neue Screen erfüllt weiterhin die in CLAUDE.md
   Prinzip 8 und architecture.md ("Mobile/Touch-Design") festgelegten
   Mindestanforderungen (44px Tap-Ziele, `text-base` in Feldern, kein
   hover-only Verhalten, `env(safe-area-inset-*)`) — das ist keine neue
   Entscheidung dieser Phase, sondern eine Erinnerung, dass Phase 9–12
   nichts einführen dürfen, was diesen bereits verbindlichen Regeln
   widerspricht.

## 4. Nicht-Ziele dieser Phase

- Kein neues Logo, kein neues Farbsystem (s. Abschnitt 1).
- Keine Entscheidung über konkrete neue UI-Komponenten (Phase 9).
- Keine Entscheidung über einzelne Screen-Layouts (Phase 12).
- Keine Umsetzung der in ux-problems.md gelisteten Punkte — nur deren
  Einordnung in die Phasenreihenfolge oben.

## 5. Ergebnis

Die Designstrategie lautet zusammengefasst: **konsolidieren vor
erweitern, dokumentieren vor entscheiden, Token-Disziplin vor neuen
Komponenten, rechtliche Pflichtpunkte vor gestalterischen Wünschen.**
Phase 7 (CI/Branding) beginnt als Prüfung des bestehenden Systems gegen
diese Leitplanken, nicht als Neuentwurf.
