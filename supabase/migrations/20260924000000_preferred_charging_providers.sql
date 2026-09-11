-- Bevorzugte Lade-Anbieter (Nutzerwunsch): feste Auswahl aus den zehn
-- groessten/verbreitetsten Anbietern (siehe src/lib/charging-providers.ts),
-- als Profil-Standard UND pro gespeicherter Route.

alter table public.profiles
  add column preferred_charging_providers text[] not null default '{}'::text[];

-- Ersetzt die bisherige preferred_provider-Einzelauswahl (Freitext-Dropdown
-- aus den echten operator-Werten) durch eine Mehrfachauswahl aus derselben
-- festen Anbieterliste wie das Profil -- konsistent mit der neuen
-- Checkbox-Auswahl im Routenplaner-Formular. Die alte Spalte bleibt
-- (ungenutzt) stehen statt sie zu droppen -- kein Code liest/schreibt sie
-- noch (siehe route-planner-form.tsx, routenplaner/actions.ts).
alter table public.saved_routes
  add column preferred_providers text[] not null default '{}'::text[];
