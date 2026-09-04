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

## Betroffenenrechte (technisch vorzubereiten)

- **Löschung des Nutzerkontos:** `auth.users`-Löschung kaskadiert per
  Foreign-Key (`on delete cascade`) auf `profiles`, `vehicles`, `caravans`,
  `favorites` sowie eigene Bewertungen. Ein UI-Flow dafür folgt mit dem
  Nutzerprofil (Phase 2).
- **Export personenbezogener Daten:** noch nicht implementiert — als
  Anforderung für Phase 2 vorgemerkt.

## Cookies

Supabase Auth verwendet notwendige Cookies für die Session. Ein
Cookie-Consent-Flow für optionale/analytische Cookies wird ergänzt, sobald
solche eingeführt werden (aktuell keine Analytics/Tracking im MVP).
