# User Flows — charge2camp

Stand: 2026-09-25. Phase 4 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §33 und §4.3).
Baut auf [PRODUCT_AUDIT.md](../PRODUCT_AUDIT.md) und
[information-architecture.md](information-architecture.md) auf.

Jeder Flow ist dokumentiert als: **Auslöser** → **Schritte** →
**Entscheidungspunkte** → **Fehler-/Leerzustände** → **Ergebnis**.
Bewertung/Verbesserungsvorschläge folgen erst in Phase 5 — hier wird nur
der Ist-Zustand beschrieben (§5 des Briefs).

---

## 0. Vorbemerkung: Der Login-Torbogen

Wegen der in PRODUCT_AUDIT.md dokumentierten Login-Pflicht für alle
Kerninhalte (`require-user.ts`/`api-guard.ts`) beginnt **jeder** Flow, der
tatsächlichen Produktnutzen stiftet, effektiv mit Registrierung oder Login.
Das ist kein optionaler Zwischenschritt, sondern der eigentliche erste
Schritt jedes Flows unten — deshalb wird er hier einmal zentral
dokumentiert statt in jedem Flow wiederholt.

**Flow: Erstkontakt → Zugang**

- **Auslöser:** Erster Besuch von `/` (einzige öffentliche Inhaltsseite),
  oder direkter Link auf eine geschützte Seite (z. B. geteilter
  Ladepunkt-Link).
- **Schritte:**
  1. Landing-Page `/` — Kurzaktionen sichtbar (u. a. "Ladepunkte in der
     Nähe"-Modal), aber jede Aktion, die echte Daten zeigt, führt zu
     Schritt 2.
  2. Klick auf einen geschützten Bereich (Tab-Bar/Header-Link oder
     Kurzaktion) → `require-user.ts` erkennt fehlenden Login → Redirect zu
     `/login?redirect=<ursprüngliches Ziel>`.
  3. `/login`: E-Mail/Passwort eingeben, oder Wechsel zu `/register`.
  4. Nach erfolgreichem Login: `router.push(redirect || "/profil")` —
     Rücksprung zum ursprünglich gewünschten Ziel, Fallback `/profil` bei
     direktem `/login`-Aufruf ohne `redirect`-Parameter.
- **Entscheidungspunkte:** neues Konto (→ `/register`) vs. bestehendes
  Konto (→ `/login`); Passwort vergessen (→ `/passwort-vergessen`).
- **Fehler-/Leerzustände:** falsche Zugangsdaten (Fehlermeldung auf der
  Login-Seite, `searchParams.get("error")`); nach Registrierung ggf.
  E-Mail-Bestätigung nötig (Supabase Auth Standard, `/auth/callback`).
- **Ergebnis:** Nutzer landet exakt dort, wo die Absicht ursprünglich war
  (nicht generisch auf `/profil`), sofern ein `redirect`-Ziel bekannt war.

---

## 1. Fahrzeug/Wohnwagen anlegen (Profil-Setup)

- **Auslöser:** Nach Registrierung (Profil ist leer) oder gezielt über
  `/profil/gespann`.
- **Schritte:**
  1. `/profil/gespann` öffnen.
  2. "Fahrzeug hinzufügen": Hersteller wählen → Modell-Dropdown aus
     `vehicle_models` (nur Modelle mit bekannter Anhängelast) → Auswahl
     füllt Batteriekapazität, Verbrauch, Ladeleistung, Reichweite,
     Anhängelast, Länge automatisch (`handleModelSelect`,
     `vehicle-form.tsx`).
  3. Vorausgefüllte Werte bleiben manuell überschreibbar, vor dem Speichern.
  4. Analog: "Wohnwagen hinzufügen" mit `caravan_models`-Autofill
     (Länge/Breite/Höhe).
  5. Fehlt das eigene Modell in der Liste: "Als neues Modell vorschlagen"
     (separater Meldeweg, kein Blocker für den aktuellen Flow — das
     Fahrzeug kann auch mit Freitext-Werten gespeichert werden).
- **Entscheidungspunkte:** Modell aus Katalog wählen (schnell, vorbefüllt)
  vs. alle Felder frei eintragen (für unbekannte/seltene Modelle).
- **Fehler-/Leerzustände:** kein Fahrzeug/Wohnwagen angelegt → Routenplaner
  und Bewertungsformular fallen auf Freitext-Gespannmaße zurück (kein
  Blocker, aber reduzierter Komfort, s. Flow 3/4).
- **Ergebnis:** `vehicles`/`caravans`-Datensatz(e), Grundlage für
  automatische Gespannlängen-Berechnung in Bewertung und Routenplanung.

## 2. Campingplatz-/Ladepunkt-Suche → Detail → Aktion

- **Auslöser:** Tab "Camping" oder "Laden" (nach Login).
- **Schritte:**
  1. Explorer-Ansicht (Liste + Karte kombiniert, Filter).
  2. Karte↔Liste-Hervorhebung: Hover (Desktop) oder Tap auf Marker
     (Mobile, `onMarkerClick`) synchronisiert Auswahl zwischen Karte und
     Liste.
  3. Eintrag öffnen → Detailseite: Stammdaten, EV-Camping-Score
     (Campingplatz) bzw. Anhängertauglichkeits-Badges + Verteilungsgrafik
     "Eignung nach Gespannlänge" (Ladepunkt), Community-Bewertungen.
  4. Aktionen ab hier: Favorisieren (Herz-Button → `favorites`),
     "Route hierher planen" (→ Flow 5, vorbefüllter Zielpunkt),
     Bewerten (→ Flow 3).
- **Entscheidungspunkte:** Filter setzen vs. direkt auf der Karte
  erkunden; Liste vs. Karte als primäre Ansicht (beide immer sichtbar,
  keine exklusive Umschaltung laut Code-Struktur).
- **Fehler-/Leerzustände:** keine Treffer bei aktiven Filtern (Leerzustand
  nicht separat verifiziert — zu prüfen in Phase 5); Ladepunkt ohne
  bisherige Bewertungen → Anhängertauglichkeit "ungeprüft"
  (Standardzustand laut brand-guide.md §7, bewusst nicht "tauglich").
- **Ergebnis:** informierte Entscheidung "passt mein Gespann hier rein?",
  optional Favorit gesetzt oder Route gestartet.

## 3. Community-Bewertung abgeben

- **Auslöser:** "Bewerten" auf einer Campingplatz-/Ladepunkt-Detailseite.
- **Schritte:**
  1. Bewertungsformular öffnen (`review-form.tsx`).
  2. Gespannmaße: entweder eigenes Fahrzeug+Wohnwagen aus dem Profil
     wählen (Gespannlänge wird automatisch als Summe berechnet) oder
     Freitext-Maße eingeben (wenn kein Gespann hinterlegt oder gewünscht).
  3. Strukturierte Anhängertauglichkeits-Kriterien ankreuzen (optional,
     je Kriterium einzeln): `enough_space_for_rig`, `unobstructed_access`,
     `no_barrier_or_garage`, `side_mounted_charger`.
  4. Bei `suitable = "limited"`: Zusatzfrage
     `decoupled_parking_possible` (kann der Wohnwagen in der Nähe
     abgekoppelt geparkt werden, während das Zugfahrzeug lädt).
  5. Absenden → Bewertung erscheint auf der Detailseite als Badge-Zeile
     und fließt in die Verteilungsgrafik "Eignung nach Gespannlänge" ein.
- **Entscheidungspunkte:** profilbasierte vs. freie Gespannangabe (s. o.).
- **Fehler-/Leerzustände:** kein Fahrzeug/Wohnwagen im Profil → Formular
  bleibt nutzbar (Freitext), aber ohne die automatische Vorausfüllung —
  potenziell nicht offensichtlich, dass ein Profil-Eintrag das
  vereinfachen würde (bereits als UX-Frage in PRODUCT_AUDIT.md §4.4
  vermerkt).
- **Ergebnis:** neuer Datensatz in `campsite_reviews`/`charging_reviews`,
  sichtbar für alle Nutzer.

## 4. Fehlende Ladesäule melden

- **Auslöser:** `/profil/fehlende-saeule` (eigener, isolierter Menüpunkt,
  nicht von einer Ladepunkt-Detailseite oder der Karte aus verlinkt).
- **Schritte:**
  1. Google-Maps-Link der fehlenden Säule einfügen (`MissingStationReportForm`) —
     Koordinaten werden daraus automatisch extrahiert.
  2. Optional Notizen ergänzen.
  3. Absenden → Eintrag in `enrich.missing_station_report`, Status
     `pending`.
  4. Eigene Meldungen mit Status (`Wird geprüft` / `Eingepflegt` /
     `Abgelehnt`) werden auf derselben Seite gelistet.
- **Entscheidungspunkte:** keine — linearer Meldeweg.
- **Fehler-/Leerzustände:** kein automatisches Feedback, wann eine
  Prüfung erfolgt (nur Statuswechsel bei erneutem Seitenbesuch, kein
  Push/E-Mail); nicht Teil dieses Audits, ob das gewünscht ist.
- **Ergebnis:** Admin sichtet die Meldung manuell und trägt Name,
  Betreiber, Anschlüsse, Anhängertauglichkeit nach (kein automatisierter
  Import für nutzergemeldete Säulen).

## 5. Routenplanung (Kernflow)

- **Auslöser:** Tab "Route", oder "Route hierher planen" von einer
  Detailseite (vorbefülltes Ziel), oder "Route laden" aus
  `/profil/routen`.
- **Schritte (Wizard, 3 Tabs, `route-planner-form.tsx`):**
  1. **Tab 1 — Eingabe:** Fahrzeug + Wohnwagen wählen (oder Freitext-
     Verbrauch), Start/Ziel (Geocoding via Nominatim, oder
     Favoriten-/Zuhause-Adresse-Picker), 4 SOC-Schieberegler
     (Abfahrts-Ladestand, Mindest-Restakku unterwegs, Ladeziel am Stopp,
     Mindest-Restakku am Ziel), optional Anbieter-Filter, manuelle
     Zwischenstopps ("Add Stop"), Umweg-Toleranz-Schieberegler
     (0–100 km).
  2. Route berechnen → OSRM liefert Geometrie, Greedy-Ladeplanung sucht
     iterativ anhängertaugliche Stopps im Korridor (`unsuitable` hart
     ausgeschlossen), Overpass-Check auf Höhen-/Breitenrestriktionen
     entlang der Strecke.
  3. **Tab 2 — Routenübersicht:** Start (Abfahrts-Ladestand), jeder
     Ladestopp (Ladeleistung, allgemeine + persönliche
     Anhängertauglichkeit, km/Fahrzeit zum nächsten Punkt, Datum letzter
     Community-Bestätigung, geschätzte Kosten), Ziel
     (Ankunfts-Ladestand). Straßenrestriktions-Warnungen mit km-Position.
  4. Je Stopp: löschen (→ automatische Neusuche des nächstbesten
     Kandidaten) oder Alternative wählen (bis zu 5 Kandidaten im
     Korridor) — löst `replanChargingStop` aus (nur Neuplanung, kein
     erneutes Geocoding/Routing).
  5. **Tab 3 vermutlich Zusammenfassung/Speichern** (Navigation starten,
     Route speichern) — Detailstruktur von Tab 3 nicht separat verifiziert,
     zu ergänzen bei Bedarf.
  6. "Navigation starten" öffnet Google Maps mit allen Wegpunkten
     (externer Wechsel, App bleibt im Hintergrund offen).
  7. Optional "Route speichern" (`saved_routes`) — es werden nur
     Start/Ziel-Koordinaten und alle Formular-/Ladeeinstellungen
     gespeichert, nicht die fertige Streckengeometrie (Neuplanung bei
     jedem Öffnen, s. Flow 6).
- **Entscheidungspunkte:** profilbasierte vs. freie Fahrzeugangabe;
  Löschen vs. Alternative wählen je Stopp; Umweg-Toleranz höher stellen
  für bessere Anhängertauglichkeit vs. kürzere Strecke.
- **Fehler-/Leerzustände:** kein anhängertauglicher Ladepunkt mehr entlang
  der Route gefunden → ehrliche Meldung statt falscher Route (Safety-Limit
  `MAX_CHARGING_STOPS`); Overpass-Anfrage schlägt fehl → Restriktionen als
  "nicht geprüft" markiert statt stillschweigend keine Warnung; fehlender
  Preis an mind. einem Stopp → Gesamtkosten als Teilsumme markiert
  (`costEstimateIncomplete`).
- **Ergebnis:** vollständiger Ladeplan mit externer Navigation, optional
  dauerhaft gespeichert.

## 6. Gespeicherte Route erneut nutzen (Profil)

- **Auslöser:** `/profil/routen`.
- **Schritte:**
  1. Liste aller gespeicherten Routen — jede wird serverseitig mit den
     gespeicherten Einstellungen frisch neu geplant (aktuelle
     Ladepunkte/Straßendaten statt veraltetem Snapshot).
  2. Pro Route: "Gesamte Route navigieren" (ein Google-Maps-Link, alle
     Wegpunkte) oder Segment-Navigation (separater Link je Etappe:
     Start → 1. Stopp, 1. → 2. Stopp, …).
  3. Klick öffnet neuen Tab (`NavigationLink`, eindeutiger Fenstername pro
     Klick) — der charge2camp-Tab bleibt bestehen.
- **Entscheidungspunkte:** ganze Route auf einmal navigieren vs.
  etappenweise (z. B. weil die erste Etappe schon gefahren wurde).
- **Fehler-/Leerzustände:** keine gespeicherten Routen → Leerzustand nicht
  separat verifiziert.
- **Ergebnis:** aktuelle Navigation ohne den Planungs-Wizard erneut
  durchlaufen zu müssen.

---

## Offene Punkte für Phase 5

- Leerzustände (keine Treffer, keine gespeicherten Routen/Favoriten) sind
  im Code vorhanden, aber hier nicht im Detail geprüft — Teil der
  UX-Problem-Analyse in Phase 5.
- Tab 3 des Routenplaner-Wizards wurde nicht im Detail nachvollzogen.
- Fehlende-Ladesäule-Flow hat keine Rückmeldung bei Statuswechsel (kein
  Push/E-Mail) — zu bewerten, ob das ein UX-Problem ist.
