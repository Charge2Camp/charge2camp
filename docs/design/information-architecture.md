# Informationsarchitektur — charge2camp

Stand: 2026-09-25. Phase 3 von 16 des Design-Prozesses
(`\\MyCloud\work\charge2camp\Design\BrandDesign.rtf`, §33). Baut auf
[docs/PRODUCT_AUDIT.md](../PRODUCT_AUDIT.md) (§4.1/§4.2) auf und dokumentiert
die vollständige Seitenhierarchie, das Navigationsmodell und die
Content-Muster — als verbindliche Referenz für Phase 6 (Designstrategie)
und alle folgenden Phasen.

---

## 1. Sitemap

```
/                                   Start (öffentlich)
├── /legende                        Symbole & Begriffe erklärt (öffentlich, s. u. — Phase 12, UX-05.5)
├── /campingplaetze                 Liste + Karte (login-pflichtig, s. u.)
│   └── /campingplaetze/[id]        Detail (login-pflichtig)
├── /ladepunkte                     Liste + Karte (login-pflichtig)
│   └── /ladepunkte/[id]            Detail (login-pflichtig)
├── /routenplaner                   Wizard (login-pflichtig)
├── /community                      Übersicht (login-pflichtig, nicht in Hauptnav verlinkt)
├── /profil                         Hub (login-pflichtig, redirect → /login)
│   ├── /profil/daten                Konto, Zuhause-Adresse, DSGVO-Export, Konto löschen
│   ├── /profil/gespann              Fahrzeug(e) + Wohnwagen
│   ├── /profil/routen               Gespeicherte Routen + Segment-Navigation
│   ├── /profil/favoriten            Favorisierte Campingplätze/Ladepunkte
│   ├── /profil/bewertungen          Eigene Bewertungen
│   └── /profil/fehlende-saeule      Fehlende Ladesäule melden (Account-Bezug: "Meine Meldungen", s. u.)
│   [entfernt aus Navigation, Route besteht weiter: /profil/einstellungen — s. PRODUCT_AUDIT.md]
├── /login, /register                Auth
├── /passwort-vergessen               Auth
├── /passwort-zuruecksetzen           Auth
├── /auth/callback                    Auth (Supabase, technisch)
├── /datenschutz, /impressum          Pflichtangaben (immer erreichbar, s. u.)
└── /api/**                          Keine Seiten — öffentliche Such-/Detail-Endpunkte
    (campsites, charge-points) + Admin-/Enrichment-/Cron-Endpunkte (kein UI)
```

**Tiefe:** Jede Kerninhaltsseite (Campingplatz-/Ladepunkt-Detail) ist von
`/` aus in maximal 2 Klicks erreichbar (Tab → Liste/Karte → Detail) —
**vorausgesetzt, der Nutzer ist bereits eingeloggt**. Nicht eingeloggt
führt jeder dieser Klicks stattdessen zu `/login?redirect=…` (s. u.).
Profil-Unterseiten sind in 2 Klicks erreichbar (Profil-Tab → Unterseite).
`/community` ist nur per direkter URL oder Verweis erreichbar — bewusst
keine Klicktiefe definiert, da nicht in der Hauptnavigation (§4.4 Audit).

**Sicherheits-Audit (login-pflichtiges Browsen):** Seit einem
Sicherheits-Audit erfordert das Betrachten der eigentlichen Produktinhalte
— Campingplätze, Ladepunkte, Community, Routenplaner — durchgängig ein
Konto (`src/lib/require-user.ts` auf Seitenebene, `src/lib/api-guard.ts`
`requireApiUser` auf API-Ebene mit zusätzlichem Rate-Limit pro Nutzer).
Nur `/`, `/legende`, die Auth-Seiten und die Rechtsseiten (`/impressum`,
`/datenschutz`) sind ohne Login erreichbar (`/legende` seit Phase 12, s.
Abschnitt 5). Das ist eine bewusste
Produktentscheidung (kein technisches Versehen), aber **IA-relevant**:
Der einzige öffentliche Einstiegspunkt (`/`) muss die gesamte Last tragen,
Besucher zur Registrierung zu bewegen, bevor sie irgendeinen Kerninhalt
sehen — es gibt keinen "Vorschau"-Pfad. Betrifft die Interpretation der
Klicktiefe oben und ist Grundlage für die Flow-Dokumentation in Phase 4.

## 2. Navigationsmodell

Zwei parallele, aber inhaltsgleiche Ebenen (kein separates Desktop-Konzept):

| Ebene | Breite | Komponente | Einträge |
|---|---|---|---|
| Bottom-Tab-Bar | < md | `bottom-tab-bar-client.tsx` | Home, Camping, Laden, Route, Profil/Anmelden (5 Slots, Maximum) |
| Header | ≥ md | `site-header.tsx` | dieselben 4 Links + Profil/Login/Register |
| Profil-Sidebar (Overlay) | < md | `profile-sidebar.tsx` | alle 6 Profil-Unterseiten + `/legende` + Community + Impressum/Datenschutz + Logout |
| Profil-Sub-Nav (inline) | ≥ md | `profile-sub-nav.tsx` | dieselben Einträge wie Sidebar, ohne Impressum/Datenschutz/Logout (dafür existiert der reguläre `site-footer.tsx`) |

**Fixpunkte, unabhängig von Login-Status oder Breite:**
- Impressum/Datenschutz müssen laut §5 DDG ständig erreichbar sein — auf
  Desktop über `site-footer.tsx`, auf eingeloggtem Mobile über die
  Profil-Sidebar (einziger durchgängig erreichbarer Ort ohne Footer).
  **Lücke:** Ein nicht eingeloggter Mobile-Nutzer ohne Footer-Zugriff hat
  aktuell keinen offensichtlichen Weg zu Impressum/Datenschutz aus der
  Tab-Bar heraus — zu prüfen in Phase 5 (UX-Probleme).
- Community liegt bewusst nicht in der 5-Tab-Leiste, ist aber Teil der
  Profil-Sidebar (dort für eingeloggte Mobile-Nutzer erreichbar) — für
  nicht eingeloggte Mobile-Nutzer aktuell nirgends verlinkt.

## 3. Seiteninventar

| Route | Typ | Zweck | Primäre Datenquelle | Login nötig |
|---|---|---|---|---|
| `/` | Landing | Einstieg, Kurzaktionen (u. a. "Ladepunkte in der Nähe") | — | nein |
| `/campingplaetze` | Liste + Karte | Suche/Filter Campingplätze | `campsites` (API `/api/campsites/search`) | **ja** (`requireUser`) |
| `/campingplaetze/[id]` | Detail | Stammdaten, EV-Camping-Score, Bewertungen | `campsites`, `campsite_reviews` | **ja** |
| `/ladepunkte` | Liste + Karte | Suche/Filter Ladepunkte | `charging_stations` (API `/api/charge-points/*`) | **ja** (`requireUser`) |
| `/ladepunkte/[id]` | Detail | Anhängertauglichkeit, Bewertungen, Verteilungsgrafik | `charging_stations`, `charging_reviews` | **ja** |
| `/routenplaner` | Wizard (mehrstufig) | Route planen inkl. Ladeplanung | Nominatim, OSRM, Overpass, `charging_stations` | **ja** (`requireUser`, ganze Seite) |
| `/community` | Übersicht | Bewertungen/Erfahrungsberichte übergreifend | `campsite_reviews`, `charging_reviews` | **ja** (`requireUser`) |
| `/profil` | Hub | Kacheln zu allen Unterbereichen | `vehicles`, `caravans`, `saved_routes`, `favorites`, Reviews | **ja** |
| `/profil/daten` | Formular | Konto, Zuhause-Adresse, DSGVO | `profiles`, Supabase Auth | ja |
| `/profil/gespann` | Formular | Fahrzeug/Wohnwagen-Verwaltung | `vehicles`, `caravans`, `vehicle_models`, `caravan_models` | ja |
| `/profil/routen` | Liste | Gespeicherte Routen, Segment-Navigation | `saved_routes` | ja |
| `/profil/favoriten` | Liste | Favoriten mit Routenplaner-Übernahme | `favorites` | ja |
| `/profil/bewertungen` | Liste | Eigene Bewertungen | `campsite_reviews`, `charging_reviews` | ja |
| `/profil/fehlende-saeule` | Formular | Neue Ladesäule melden + eigene Meldungen (`user_id`-gefiltert) | `enrich.missing_station_report` | ja *(echter Account-Bezug bestätigt, s. Abschnitt 5)* |
| `/legende` | Referenz | Symbol-/Begriffserklärung (statisch) | — | nein *(bis Phase 12 fälschlich unter `/profil/legende`, s. Abschnitt 5)* |
| `/login`, `/register`, `/passwort-*` | Auth | An-/Abmeldung | Supabase Auth | — |
| `/datenschutz`, `/impressum` | Statisch | Pflichtangaben | — | nein |

## 4. Wiederkehrende Content-Muster

Die App folgt konsequent einem **Liste/Karte → Detail**-Muster (analog zur
in §8.8 des Design-Briefs genannten Airbnb-/PlugShare-Referenz), zweimal
umgesetzt (Campingplätze, Ladepunkte) mit identischer Grundstruktur:

1. **Explorer-Ebene:** kombinierte Karten-/Listenansicht mit Filtern,
   Karte↔Liste-Hervorhebung (Hover auf Desktop, Tap auf Mobile —
   `onMarkerClick`, s. PRODUCT_AUDIT.md/architecture.md).
2. **Detail-Ebene:** Stammdaten oben, Eignungs-/Score-Information
   (EV-Camping-Score bzw. Anhängertauglichkeit) prominent, Community-
   Bewertungen darunter, Aktionen (Favorisieren, Route hierher, Bewerten)
   konsistent platziert.

Der Routenplaner durchbricht dieses Muster bewusst als **Wizard** (mehrere
Tabs/Schritte statt Liste/Detail) — einzige Seite mit eigenem
mehrstufigem Flow-Charakter, siehe PRODUCT_AUDIT.md §4.3.

Das Profil folgt einem dritten Muster: **Hub mit Kacheln** (`/profil`) →
**Unterseiten mit eigener Sub-Navigation** (`profile-sub-nav.tsx`/
`profile-sidebar.tsx`) — durchgängig für alle 6 Unterseiten gleich
aufgebaut (`/legende` ist seit Phase 12 kein `/profil`-Unterpfad mehr,
bleibt aber Teil derselben Sub-Navigation, s. Abschnitt 5).

## 5. Bekannte IA-Lücken

Ergänzt PRODUCT_AUDIT.md §4.4/§4.5 um zwei bei der IA-Dokumentation neu
aufgefallene Punkte (noch nicht bewertet, nur dokumentiert — Bewertung
folgt in Phase 5):

- **Impressum/Datenschutz für nicht eingeloggte Mobile-Nutzer** ohne
  offensichtlichen Zugriffsweg aus der Tab-Bar (s. o., Abschnitt 2). —
  **Erledigt (Phase 12):** Auf allen fünf öffentlichen Seiten (`/`,
  `/login`, `/register`, `/passwort-vergessen`,
  `/passwort-zuruecksetzen`) über die neue Komponente
  `legal-footer-links.tsx` gelöst. Details s. `docs/DESIGN_DECISIONS.md`.
- ~~`/profil/legende` und `/profil/fehlende-saeule` sind inhaltlich keine
  Profil-/Kontoinhalte~~ — **präzisiert und erledigt (Phase 12):** Beim
  genauen Code-Lesen bestätigte sich das nur für `/profil/legende`
  (reiner Referenzinhalt, kein DB-Zugriff) — verschoben nach `/legende`,
  ohne Login erreichbar. `/profil/fehlende-saeule` liest dagegen
  tatsächlich `user.id`-gefilterte eigene Meldungen ("Meine Meldungen")
  — echter Account-Bezug, kein IA-Bruch, Login dort weiterhin
  gerechtfertigt. Details s. `docs/DESIGN_DECISIONS.md` und
  `docs/design/ux-problems.md` (UX-05.5).
