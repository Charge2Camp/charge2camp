-- Referenz-Kataloge fuer Fahrzeug-/Wohnwagenauswahl mit Autofill (§7).
-- Oeffentlich lesbar, Schreibzugriff nur ueber service_role (Import-Skripte,
-- siehe docs/data-sources.md fuer Quellenangaben je Datensatz).

create table public.vehicle_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text not null,
  variant text not null,
  battery_capacity_kwh numeric,
  consumption_kwh_per_100km numeric,
  charging_power_kw numeric,
  range_km numeric,
  max_towing_weight_braked_kg numeric,

  source text not null default 'manual',
  verification_status public.verification_status not null default 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),

  unique (manufacturer, model, variant)
);

alter table public.vehicle_models enable row level security;

create policy "vehicle models are readable by everyone"
  on public.vehicle_models for select
  using (true);

create table public.caravan_models (
  id uuid primary key default gen_random_uuid(),
  manufacturer text not null,
  model text not null,
  series text,
  length_m numeric not null,
  width_m numeric not null,
  height_m numeric not null,
  weight_kg numeric not null,
  gross_vehicle_weight_kg numeric,

  source text not null default 'manual',
  verification_status public.verification_status not null default 'unverified',
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),

  unique (manufacturer, model, series)
);

alter table public.caravan_models enable row level security;

create policy "caravan models are readable by everyone"
  on public.caravan_models for select
  using (true);

-- Referenz auf ein Katalog-Modell, damit spaeter nachvollziehbar bleibt,
-- woher die Autofill-Werte kamen (rein informativ, keine Business-Logik-
-- Abhaengigkeit -- Nutzer koennen die Werte nach dem Autofill frei anpassen).
alter table public.vehicles
  add column max_towing_weight_braked_kg numeric,
  add column model_reference_id uuid references public.vehicle_models (id) on delete set null;

alter table public.caravans
  add column model_reference_id uuid references public.caravan_models (id) on delete set null;
