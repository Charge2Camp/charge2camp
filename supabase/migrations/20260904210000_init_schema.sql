-- eCamper MVP initial schema
-- See docs/database.md for a description of every table.

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles are updatable by their owner"
  on public.profiles for update
  using (auth.uid() = id);

-- auto-create a profile row whenever a new auth user signs up
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- vehicles (Elektroauto)
-- ---------------------------------------------------------------------------
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  manufacturer text not null,
  model text not null,
  battery_capacity_kwh numeric not null,
  consumption_kwh_per_100km numeric,
  charging_power_kw numeric,
  range_km numeric,
  created_at timestamptz not null default now()
);

alter table public.vehicles enable row level security;

create policy "vehicles are managed by their owner"
  on public.vehicles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- caravans (Wohnwagen / Caravan)
-- ---------------------------------------------------------------------------
create table public.caravans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  manufacturer text not null,
  model text not null,
  length_m numeric not null,
  width_m numeric not null,
  height_m numeric not null,
  weight_kg numeric not null,
  gross_vehicle_weight_kg numeric,
  actual_travel_weight_kg numeric,
  created_at timestamptz not null default now()
);

alter table public.caravans enable row level security;

create policy "caravans are managed by their owner"
  on public.caravans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- campsites
-- ---------------------------------------------------------------------------
create type public.verification_status as enum (
  'unverified',
  'verified',
  'community_verified',
  'official'
);

create table public.campsites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  address text,
  country text,
  region text,
  latitude double precision not null,
  longitude double precision not null,
  website text,
  phone text,
  image_url text,
  is_open boolean,
  rating_avg numeric,

  -- Ausstattung
  pool boolean not null default false,
  sea boolean not null default false,
  lake boolean not null default false,
  river boolean not null default false,
  mountain boolean not null default false,
  family_friendly boolean not null default false,
  dogs_allowed boolean not null default false,
  restaurant boolean not null default false,
  supermarket boolean not null default false,
  electricity boolean not null default false,
  wifi boolean not null default false,

  -- EV-Felder
  ev_charging_available boolean not null default false,
  ev_charging_on_site boolean not null default false,
  ev_charging_nearby boolean not null default false,
  max_charging_power_kw numeric,
  number_of_charging_points integer,

  -- Datenqualität
  source text not null default 'manual',
  verification_status public.verification_status not null default 'unverified',
  last_verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campsites_country_region_idx on public.campsites (country, region);
create index campsites_location_idx on public.campsites (latitude, longitude);

alter table public.campsites enable row level security;

create policy "campsites are readable by everyone"
  on public.campsites for select
  using (true);

-- writes go through the service role (admin area / import scripts) only,
-- so no insert/update/delete policy is granted to regular users yet.

-- ---------------------------------------------------------------------------
-- charging_stations
-- ---------------------------------------------------------------------------
create type public.trailer_suitability as enum (
  'confirmed',
  'likely',
  'unsuitable',
  'unknown'
);

create table public.charging_stations (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  name text,
  address text,
  latitude double precision not null,
  longitude double precision not null,
  power_kw numeric,
  connector_type text,
  connector_count integer,
  status text not null default 'unknown',
  price numeric,
  currency text default 'EUR',
  opening_hours text,

  -- Anhängertauglichkeit
  trailer_suitable public.trailer_suitability not null default 'unknown',
  trailer_suitable_score numeric,
  trailer_notes text,
  verified_by_community boolean not null default false,

  -- Datenqualität
  source text not null default 'manual',
  verification_status public.verification_status not null default 'unverified',
  last_verified_at timestamptz,
  last_updated timestamptz not null default now(),

  created_at timestamptz not null default now()
);

create index charging_stations_location_idx on public.charging_stations (latitude, longitude);
create index charging_stations_trailer_suitable_idx on public.charging_stations (trailer_suitable);

alter table public.charging_stations enable row level security;

create policy "charging stations are readable by everyone"
  on public.charging_stations for select
  using (true);

-- ---------------------------------------------------------------------------
-- campsite_reviews
-- ---------------------------------------------------------------------------
create table public.campsite_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  campsite_id uuid not null references public.campsites (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, campsite_id)
);

alter table public.campsite_reviews enable row level security;

create policy "campsite reviews are readable by everyone"
  on public.campsite_reviews for select
  using (true);

create policy "campsite reviews are writable by their author"
  on public.campsite_reviews for insert
  with check (auth.uid() = user_id);

create policy "campsite reviews are editable by their author"
  on public.campsite_reviews for update
  using (auth.uid() = user_id);

create policy "campsite reviews are deletable by their author"
  on public.campsite_reviews for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- charging_reviews ("Ist dieser Ladepunkt mit deinem Gespann nutzbar?")
-- ---------------------------------------------------------------------------
create type public.trailer_suitable_answer as enum ('yes', 'no', 'limited');

create table public.charging_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  charging_station_id uuid not null references public.charging_stations (id) on delete cascade,
  suitable public.trailer_suitable_answer not null,
  trailer_length_m numeric,
  trailer_width_m numeric,
  caravan_model text,
  photo_url text,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.charging_reviews enable row level security;

create policy "charging reviews are readable by everyone"
  on public.charging_reviews for select
  using (true);

create policy "charging reviews are writable by their author"
  on public.charging_reviews for insert
  with check (auth.uid() = user_id);

create policy "charging reviews are editable by their author"
  on public.charging_reviews for update
  using (auth.uid() = user_id);

create policy "charging reviews are deletable by their author"
  on public.charging_reviews for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create type public.favorite_entity_type as enum ('campsite', 'charging_station');

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type public.favorite_entity_type not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, entity_type, entity_id)
);

alter table public.favorites enable row level security;

create policy "favorites are managed by their owner"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
