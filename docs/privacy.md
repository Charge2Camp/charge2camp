# Datenschutz (DSGVO)

Status: Grundprinzipien für den MVP. Vor kommerzieller Veröffentlichung ist
eine vollständige rechtliche Prüfung (Datenschutzerklärung, AV-Verträge mit
Supabase/Vercel, Cookie-Banner-Text, ggf. Datenschutzbeauftragter)
erforderlich — das ist nicht Teil des technischen MVP.

## Grundsätze, die von Anfang an gelten

- **Datensparsamkeit:** Nur speichern, was für die Funktion nötig ist.
  Fahrzeug-/Wohnwagendaten sind optional über das notwendige Minimum hinaus
  (§7).
- **Standortdaten:** Der aktuelle Standort des Nutzers (z. B. für die
  Routenplanung) wird nicht unnötig dauerhaft gespeichert.
- **Sichere Passwortverarbeitung:** Passwörter werden ausschließlich von
  Supabase Auth verarbeitet (gehasht, nie im Klartext oder in eigenen
  Tabellen gespeichert).
- **Zugriffskontrolle:** Row Level Security auf allen Tabellen mit
  personenbezogenen Daten (siehe [database.md](database.md)) — Nutzer sehen
  ausschließlich ihre eigenen Fahrzeuge, Wohnwagen und Favoriten.
- **API-Sicherheit:** Keine Secrets im Code; Service-Role-Key ausschließlich
  server-seitig.

## Betroffenenrechte

- **Löschung des Nutzerkontos:** `/profil/daten` → "Konto löschen"
  ([src/components/profile/delete-account-form.tsx](../src/components/profile/delete-account-form.tsx)).
  Tippt die eigene E-Mail-Adresse zur Bestätigung ein (Schutz vor
  versehentlichem Klick), löscht dann über den Admin-/Service-Role-Client
  (`admin.auth.admin.deleteUser`, siehe
  [src/lib/supabase/admin.ts](../src/lib/supabase/admin.ts) — eine normale
  Nutzer-Session darf ihr eigenes `auth.users`-Konto nicht selbst löschen)
  das Konto. Kaskadiert per Foreign-Key (`on delete cascade`) auf
  `profiles`, `vehicles`, `caravans`, `favorites` sowie eigene Bewertungen
  und gespeicherte Routen — end-to-end verifiziert (Konto vor/nach Löschung
  in `auth.users`/`public.profiles` geprüft).
- **Export personenbezogener Daten:** `GET /api/account/export`
  ([src/app/api/account/export/route.ts](../src/app/api/account/export/route.ts)),
  verlinkt unter `/profil/daten` → "Meine Daten herunterladen". Liefert
  Profil, Fahrzeuge/Wohnwagen, Favoriten, Bewertungen und gespeicherte
  Routen als JSON-Datei-Download.
- **E-Mail-Adresse ändern:** `/profil/daten`, ruft den Supabase-eigenen
  Bestätigungsablauf auf (`auth.updateUser({ email })`) — je nach
  Projekteinstellung erst nach Klick auf einen Bestätigungslink wirksam.
  Passwort ändern ist weiterhin nicht umgesetzt.

## Cookies

Supabase Auth verwendet notwendige Cookies für die Session. Ein
Cookie-Consent-Flow für optionale/analytische Cookies wird ergänzt, sobald
solche eingeführt werden (aktuell keine Analytics/Tracking im MVP).
