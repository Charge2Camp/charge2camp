-- Nutzerwunsch: beim Pruefen von Dubletten-Vorschlaegen fehlte eine
-- Moeglichkeit, ein Paar explizit als "keine Dublette, bewusst zwei
-- getrennte Datensaetze" zu markieren -- bisher gab es nur "Zusammenfuehren",
-- ein abgelehntes Paar tauchte bei jedem erneuten Aufruf von
-- core.run_quality_checks() (reine Live-Abfrage, keine Tabelle) wieder auf.
--
-- core.duplicate_dismissal merkt sich zurueckgewiesene Paare persistent,
-- fuer Ladepunkte UND Campingplaetze gemeinsam (entity_type). Schluessel
-- werden in kanonischer Reihenfolge (least/greatest) gespeichert, damit die
-- Zuordnung unabhaengig davon funktioniert, in welcher Reihenfolge das
-- naechste core.run_quality_checks()-Ergebnis das Paar liefert.
create table core.duplicate_dismissal (
    entity_type text not null check (entity_type in ('charge_point', 'campsite')),
    key_a text not null,
    key_b text not null,
    dismissed_by uuid references public.profiles(id),
    dismissed_at timestamptz not null default now(),
    primary key (entity_type, key_a, key_b),
    check (key_a < key_b)
);

-- Bewusst KEINE "readable by everyone"-Policy wie beim generischen
-- Default aus 20260915000000_data_layer_api_exposure.sql -- das ist reine
-- Admin-Moderationsdaten, kein Lesefall fuer anon/authenticated. RLS ohne
-- Policies sperrt beide vollstaendig, service_role (Admin-Backend) umgeht
-- RLS wie ueberall sonst.
alter table core.duplicate_dismissal enable row level security;

create or replace function core.dismiss_duplicate(
    p_entity_type text,
    p_key_a text,
    p_key_b text,
    p_admin_id uuid
) returns void
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_key_lo text;
    v_key_hi text;
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    -- p_admin_id wird vom Aufrufer (Admin-Backend, requireAdmin()) explizit
    -- mitgegeben statt auth.uid() zu nutzen -- der Service-Role-Client hat
    -- keinen JWT-Auth-Kontext, auth.uid() waere immer NULL (gleiches Muster
    -- wie overrideTrailerSuitability/verified_by).
    v_key_lo := least(p_key_a, p_key_b);
    v_key_hi := greatest(p_key_a, p_key_b);

    insert into core.duplicate_dismissal (entity_type, key_a, key_b, dismissed_by)
    values (p_entity_type, v_key_lo, v_key_hi, p_admin_id)
    on conflict (entity_type, key_a, key_b) do nothing;
end;
$$;
