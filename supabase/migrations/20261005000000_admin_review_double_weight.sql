-- Nutzerwunsch: Bewertungen mit Gespannlaenge zaehlen fuer die
-- Gespannlaengen-Empfehlungen (rig-length buckets in
-- src/lib/scoring/trailer-compatibility.ts) doppelt, wenn sie von einem
-- Admin abgegeben wurden -- damit eine einzelne Admin-Bewertung mit
-- Gespannlaenge sofort die Mindestanzahl fuer eine Einschaetzung erreicht
-- (MIN_REVIEWS_PER_BUCKET = 2), statt auf eine zweite Community-Bewertung
-- warten zu muessen.
--
-- charging_reviews ist fuer alle lesbar, profiles aber nur fuer den Owner
-- selbst (siehe init_schema.sql) -- ein Join beim Lesen scheitert also an
-- RLS. Stattdessen wird der Admin-Status zum Zeitpunkt der Bewertung per
-- Trigger auf die Zeile geschrieben; der Client kann den Wert nicht selbst
-- setzen (Trigger ueberschreibt ihn immer).

alter table public.charging_reviews
  add column is_admin_review boolean not null default false;

comment on column public.charging_reviews.is_admin_review is
  'Automatisch per Trigger gesetzt: true, wenn profiles.is_admin fuer user_id zum Zeitpunkt der Bewertung true war. Treibt die doppelte Gewichtung von Admin-Bewertungen in den Gespannlaengen-Empfehlungen (trailer-compatibility.ts).';

create function public.set_charging_review_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(is_admin, false) into new.is_admin_review
  from public.profiles
  where id = new.user_id;
  return new;
end;
$$;

create trigger charging_reviews_set_admin_flag
  before insert or update of user_id on public.charging_reviews
  for each row
  execute function public.set_charging_review_admin_flag();

-- Bestehende Bewertungen einmalig nachziehen.
update public.charging_reviews cr
set is_admin_review = coalesce(p.is_admin, false)
from public.profiles p
where p.id = cr.user_id
  and cr.is_admin_review is distinct from coalesce(p.is_admin, false);
