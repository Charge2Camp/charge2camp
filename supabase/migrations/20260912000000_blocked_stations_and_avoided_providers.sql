-- Nutzerwunsch: Ladepunkte koennen dauerhaft blockiert werden (nie wieder
-- als Ladestopp-Kandidat in der Routenplanung beruecksichtigt), analog zum
-- bestehenden Favoriten-Mechanismus (public.favorites). Zusaetzlich koennen
-- Lade-Anbieter nicht nur priorisiert (bereits vorhanden, siehe
-- 20260924000000_preferred_charging_providers.sql), sondern auch komplett
-- vermieden werden (z. B. "nie Tesla einplanen") -- als zweite Spalte
-- analog zur bestehenden preferred_charging_providers/preferred_providers.

create table public.blocked_charging_stations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Bewusst ohne Foreign-Key auf core.charge_point (id) -- gleiches Muster
  -- wie public.favorites.entity_id: der Ladepunkt-Datenbestand wird vom
  -- Ingest-Prozess regelmaessig neu geladen, eine harte FK wuerde dabei
  -- fehlschlagen/Blockierungen unbeabsichtigt loeschen.
  charging_station_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, charging_station_id)
);

alter table public.blocked_charging_stations enable row level security;

create policy "blocked charging stations are managed by their owner"
  on public.blocked_charging_stations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.profiles
  add column avoided_charging_providers text[] not null default '{}'::text[];

alter table public.saved_routes
  add column avoided_providers text[] not null default '{}'::text[];
