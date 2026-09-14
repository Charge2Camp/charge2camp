-- Zuhause-Adresse im Profil (§ "Meine Daten") -- einmalig per Nominatim
-- geocodiert beim Speichern (siehe profil/actions.ts setHomeAddress), damit
-- der Routenplaner sie direkt als Start/Ziel uebernehmen kann, ohne bei
-- jeder Routenplanung erneut zu geocodieren.
alter table public.profiles
  add column home_address text,
  add column home_latitude numeric,
  add column home_longitude numeric;
