-- Nutzerwunsch: neue Fahrzeug-/Wohnwagenmodelle (und neue Akku-Versionen
-- bestehender Modelle), die noch nicht im Referenzkatalog
-- (public.vehicle_models/caravan_models) stehen, sollen Nutzer direkt beim
-- manuellen Anlegen in "Mein Gespann" vorschlagen koennen (VehicleForm/
-- CaravanForm, Checkbox "Als neues Modell vorschlagen"). Landet hier als
-- ungeprueft in einer Warteschlange -- wird erst durch Admin-Freigabe zu
-- einer echten Katalogzeile (siehe admin/.../fahrzeugmodelle/vorschlaege
-- bzw. wohnwagenmodelle/vorschlaege). Gleiches Grundmuster wie
-- enrich.missing_station_report (20261003000000).
--
-- Dient zugleich als einzige realistische Datenquelle fuer den vom Nutzer
-- gewuenschten woechentlichen "gibt es neue Modelle, die uns fehlen"-Check
-- im Admin-Dashboard ("Neu diese Woche"): eine Recherche ergab keine
-- kostenlose, zuverlaessige externe API fuer EV- oder Wohnwagen-
-- Modelldaten (siehe docs/data-sources.md) -- automatisiertes Abgleichen
-- gegen eine externe Quelle waere entweder kostenpflichtig (widerspricht
-- CLAUDE.md Grundsatz 4) oder, fuer Wohnwagen, gar nicht verfuegbar.
create table enrich.vehicle_model_suggestion (
    id                            bigint generated always as identity primary key,
    user_id                       uuid not null references public.profiles (id) on delete cascade,
    manufacturer                  text not null,
    model                         text not null,
    variant                       text,
    battery_capacity_kwh          numeric,
    consumption_kwh_per_100km     numeric,
    charging_power_kw             numeric,
    range_km                      numeric,
    max_towing_weight_braked_kg   numeric,
    length_m                      numeric,
    notes                         text,
    status                        text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    created_model_id              uuid references public.vehicle_models (id),
    reviewed_at                   timestamptz,
    reviewed_by                   uuid references public.profiles (id),
    created_at                    timestamptz not null default now()
);

create table enrich.caravan_model_suggestion (
    id                 bigint generated always as identity primary key,
    user_id            uuid not null references public.profiles (id) on delete cascade,
    manufacturer       text not null,
    model              text not null,
    series             text,
    length_m           numeric,
    width_m            numeric,
    height_m           numeric,
    notes              text,
    status             text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    created_model_id   uuid references public.caravan_models (id),
    reviewed_at        timestamptz,
    reviewed_by        uuid references public.profiles (id),
    created_at         timestamptz not null default now()
);

create index idx_vehicle_model_suggestion_status on enrich.vehicle_model_suggestion (status, created_at);
create index idx_caravan_model_suggestion_status on enrich.caravan_model_suggestion (status, created_at);

alter table enrich.vehicle_model_suggestion enable row level security;
alter table enrich.caravan_model_suggestion enable row level security;

-- Siehe missing_station_report: automatische Grant-Vergabe fuer neue
-- Tabellen (ALTER DEFAULT PRIVILEGES aus 20260915000000) greift auch hier,
-- select fuer anon/authenticated deshalb explizit wieder entzogen -- nur
-- die eigenen Vorschlaege sind ueber die Policy unten sichtbar.
revoke select on enrich.vehicle_model_suggestion from anon, authenticated;
revoke select on enrich.caravan_model_suggestion from anon, authenticated;
grant select, insert on enrich.vehicle_model_suggestion to authenticated;
grant select, insert on enrich.caravan_model_suggestion to authenticated;

create policy "users can view their own vehicle model suggestions"
  on enrich.vehicle_model_suggestion for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own vehicle model suggestions"
  on enrich.vehicle_model_suggestion for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "users can view their own caravan model suggestions"
  on enrich.caravan_model_suggestion for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own caravan model suggestions"
  on enrich.caravan_model_suggestion for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Keine UPDATE-Policy fuer authenticated: Status/Review-Felder aendert nur
-- das Admin-Backend (service_role, umgeht RLS ohnehin).
