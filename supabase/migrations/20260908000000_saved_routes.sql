-- ---------------------------------------------------------------------------
-- saved_routes: gespeicherte Routenplanungen (Start/Ziel/Fahrzeug/Gespann +
-- Ladeeinstellungen + vom Nutzer kuratierte Ladestopps), damit eine geplante
-- Route spaeter im Profil wiedergefunden und erneut geoeffnet werden kann,
-- ohne Start/Ziel/Einstellungen erneut eingeben zu muessen.
--
-- Es wird bewusst NICHT die fertige Streckengeometrie/der fertige Ladeplan
-- gespeichert (das waere ein potenziell grosser, schnell veraltender Blob --
-- Ladepunkte aendern sich, Strassen aendern sich). Stattdessen werden Start/
-- Ziel-Koordinaten + alle Formulareinstellungen gespeichert; beim Oeffnen
-- wird die Route/Ladeplanung mit denselben Einstellungen frisch neu
-- berechnet (siehe loadSavedRoute in src/app/routenplaner/actions.ts).
-- excluded_station_ids/forced_station_id_by_index reproduzieren dabei die
-- vom Nutzer im Routenuebersicht-Popup getroffene Auswahl (geloeschte
-- Ladepunkte, gewaehlte Alternativen).
-- ---------------------------------------------------------------------------

create table public.saved_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,

  start_query text not null,
  start_display_name text not null,
  start_latitude double precision not null,
  start_longitude double precision not null,

  end_query text not null,
  end_display_name text not null,
  end_latitude double precision not null,
  end_longitude double precision not null,

  vehicle_id uuid references public.vehicles (id) on delete set null,
  caravan_id uuid references public.caravans (id) on delete set null,

  -- Manuelle Verbrauchs-Eingabe im Formular (null = Profilwert/Standard
  -- verwenden, siehe consumptionSource-Logik in actions.ts).
  manual_consumption_kwh_per_100km numeric,
  min_power_kw numeric,
  prefer_trailer_suitable boolean not null default true,

  departure_soc_percent numeric not null,
  min_soc_at_stop_percent numeric not null,
  min_soc_at_destination_percent numeric not null,
  target_soc_after_charging_percent numeric not null,
  detour_tolerance_km numeric not null,

  -- Vom Nutzer im Routenuebersicht-Popup getroffene Kuratierung (§ siehe
  -- route-overview-dialog.tsx): geloeschte Ladepunkte bzw. explizit
  -- gewaehlte Alternativen je Stopp-Index.
  excluded_station_ids uuid[] not null default '{}',
  forced_station_id_by_index jsonb not null default '{}',

  created_at timestamptz not null default now()
);

create index saved_routes_user_id_idx on public.saved_routes (user_id);

alter table public.saved_routes enable row level security;

create policy "saved routes are managed by their owner"
  on public.saved_routes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
