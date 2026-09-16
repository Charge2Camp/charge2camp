-- Nutzerwunsch: Nutzer sollen fehlende Ladestationen aus "Mein Profil" melden
-- koennen, idealerweise per geteiltem Google-Maps-Link + Notiz. Landet hier als
-- ungeprueft in Warteschlange -- wird erst durch Admin-Freigabe zu einer
-- echten core.charge_point-Zeile (siehe admin/.../ladestationen/fehlende-saeulen).
--
-- Aus dem Link werden NUR Koordinaten aus der URL-Struktur extrahiert (siehe
-- src/lib/maps-link.ts), nie Googles Seiteninhalt -- bewusst schmale Ausnahme
-- von "kein Scraping kommerzieller Plattformen" (CLAUDE.md Grundsatz 6, siehe
-- Ergaenzung in docs/data-sources.md).
create table enrich.missing_station_report (
    id                       bigint generated always as identity primary key,
    user_id                  uuid not null references public.profiles (id) on delete cascade,
    google_maps_url          text not null,
    extracted_latitude       numeric,
    extracted_longitude      numeric,
    notes                    text,
    status                   text not null default 'pending'
        check (status in ('pending', 'approved', 'rejected')),
    created_charge_point_id  uuid references core.charge_point (id),
    reviewed_at              timestamptz,
    reviewed_by              uuid references public.profiles (id),
    created_at               timestamptz not null default now()
);

create index idx_missing_station_report_status on enrich.missing_station_report (status, created_at);

alter table enrich.missing_station_report enable row level security;

-- Anders als enrich.trailer_report bewusst NICHT weltweit lesbar (Link +
-- Freitext-Notiz sind sensibler als eine Anhaengertauglichkeits-Einstufung) --
-- die automatische Grant-Vergabe aus 20260915000000_data_layer_api_exposure.sql
-- greift trotzdem fuer neue Tabellen per ALTER DEFAULT PRIVILEGES, hier
-- deshalb explizit wieder entzogen (gleiches Muster wie core.app_usage_event,
-- siehe 20260929000000_admin_backend_extensions.sql).
revoke select on enrich.missing_station_report from anon, authenticated;
grant select, insert on enrich.missing_station_report to authenticated;

create policy "users can view their own missing station reports"
  on enrich.missing_station_report for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can insert their own missing station reports"
  on enrich.missing_station_report for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Keine UPDATE-Policy fuer authenticated: Status/Review-Felder aendert nur
-- das Admin-Backend (service_role, umgeht RLS ohnehin).
