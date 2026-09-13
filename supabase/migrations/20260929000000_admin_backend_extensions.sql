-- Erweiterungen fuer das Admin-Backend (Nutzerwunsch):
-- 1) Manueller Override fuer den EV-Camping-Score eines Campingplatzes --
--    leer/NULL bedeutet weiterhin automatische Berechnung (siehe
--    src/lib/scoring/ev-camping-score.ts), ein gesetzter Wert ueberschreibt
--    sie direkt. core.campsite hat bereits RLS + "readable by everyone"
--    SELECT-Policy und service_role-Grants (siehe Migrationen
--    20260913000000/20260915000000) -- die neue Spalte erbt das automatisch,
--    keine neuen Grants noetig.
alter table core.campsite
  add column ev_score_override smallint
    check (ev_score_override is null or ev_score_override between 0 and 100);

-- 2) Schlankes Nutzungs-Ereignisprotokoll fuer die Admin-Statistik
--    ("wie viele Routen wurden geplant", "wie viele Segmente wurden
--    exportiert"). Bewusst nur Ereignis-Zaehler, keine Rueckverfolgung
--    einzelner Routeninhalte (Datensparsamkeit) -- user_id ist optional und
--    nur fuer eine spaetere Pro-Nutzer-Auswertung, nicht fuer die aktuell
--    angezeigten Gesamtzahlen noetig. Zaehlt erst ab Einfuehrung dieser
--    Migration (keine rueckwirkenden/geschaetzten Werte, siehe "keine
--    Scheindaten"-Prinzip).
create table core.app_usage_event (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in ('route_planned', 'route_segment_export', 'route_full_export')),
  user_id uuid,
  created_at timestamptz not null default now()
);

create index idx_app_usage_event_type_created on core.app_usage_event (event_type, created_at);

alter table core.app_usage_event enable row level security;

-- Bewusst KEINE Select-Policy fuer anon/authenticated (nur Zaehlwerte fuer
-- den Admin-Bereich, kein Grund, dass Nutzer fremde Nutzungsereignisse
-- lesen koennen -- service_role im Admin-Backend umgeht RLS ohnehin).
-- Jeder eingeloggte Nutzer darf nur eigene (oder anonyme) Ereignisse
-- protokollieren.
create policy "authenticated users can log their own usage events"
  on core.app_usage_event for insert
  to authenticated
  with check (user_id is null or user_id = auth.uid());

-- Die pauschale "grant select on all tables in schema core to anon,
-- authenticated" + "alter default privileges" aus Migration 20260915000000
-- wuerde neuen Tabellen automatisch ein SELECT-Recht geben -- fuer dieses
-- Ereignisprotokoll explizit NICHT gewuenscht (s.o.), deshalb hier
-- wieder entzogen. INSERT wird stattdessen explizit gewaehrt (RLS-Policy
-- oben schraenkt das weiter pro Zeile ein).
revoke select on core.app_usage_event from anon, authenticated;
grant insert on core.app_usage_event to authenticated;
