-- Standard-Gespann im Profil (§ "Mein Gespann" / Box "Mein Gespann" im
-- Routenplaner, Nutzerwunsch): explizite Vorbelegung statt der bisherigen
-- Naeherung ueber vehicle_id/caravan_id der zuletzt gespeicherten Route --
-- gesetzt wird das ueber die Auswahl in der neuen Box oben auf
-- profil/gespann. "on delete set null", damit das Loeschen eines
-- Fahrzeugs/Wohnwagens nicht am gesetzten Standard scheitert.
alter table public.profiles
  add column default_vehicle_id uuid references public.vehicles (id) on delete set null,
  add column default_caravan_id uuid references public.caravans (id) on delete set null;
