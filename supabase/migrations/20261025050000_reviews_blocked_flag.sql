-- Nutzerwunsch: Missbrauchsschutz fuer Bewertungen -- ein Admin soll einem
-- einzelnen Nutzer das Abgeben NEUER Ladepunkt-/Campingplatz-Bewertungen
-- entziehen koennen, ohne das ganze Konto zu sperren (setBanned/auth.admin
-- ban_duration betrifft den kompletten Login, waere fuer reinen
-- Bewertungsmissbrauch unverhaeltnismaessig) -- jederzeit pro Nutzer
-- reversibel, siehe admin/app/(dashboard)/nutzer/[id]/.
--
-- EIN gemeinsames Flag statt je einem pro Bewertungstyp (charging_reviews
-- UND campsite_reviews) -- der Nutzerwunsch spricht von "Bewertungen"
-- generisch, ein Missbrauchsfall betrifft in der Praxis vermutlich beide
-- gleichermassen. Durchgesetzt auf DB-Ebene per RLS (nicht nur in der
-- Server-Action), damit es unabhaengig vom Aufrufweg gilt.
--
-- Bewusst NICHT enrich.trailer_report/enrich.missing_station_report
-- (Melde-/Moderations-Warteschlangen) -- die durchlaufen ohnehin schon eine
-- Admin-Freigabe (moderate_trailer_report()) bevor sie irgendeine Wirkung
-- haben, anders als charging_reviews/campsite_reviews, die SOFORT oeffentlich
-- sichtbar sind. Geringeres Missbrauchsrisiko, kann bei Bedarf spaeter mit
-- demselben Muster ergaenzt werden.
alter table public.profiles add column reviews_blocked boolean not null default false;

comment on column public.profiles.reviews_blocked is
  'Von einem Admin gesetzt (Missbrauchsschutz) -- true verhindert neue/geaenderte charging_reviews und campsite_reviews dieses Nutzers per RLS (siehe Policies unten), jederzeit reversibel. Betrifft NICHT bereits vorhandene Bewertungen oder andere Kontofunktionen.';

drop policy "charging reviews are writable by their author" on public.charging_reviews;
create policy "charging reviews are writable by their author"
  on public.charging_reviews for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.reviews_blocked)
  );

drop policy "charging reviews are editable by their author" on public.charging_reviews;
create policy "charging reviews are editable by their author"
  on public.charging_reviews for update
  using (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.reviews_blocked)
  );

drop policy "campsite reviews are writable by their author" on public.campsite_reviews;
create policy "campsite reviews are writable by their author"
  on public.campsite_reviews for insert
  with check (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.reviews_blocked)
  );

drop policy "campsite reviews are editable by their author" on public.campsite_reviews;
create policy "campsite reviews are editable by their author"
  on public.campsite_reviews for update
  using (
    auth.uid() = user_id
    and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.reviews_blocked)
  );
