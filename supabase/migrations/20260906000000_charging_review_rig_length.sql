-- Ermoeglicht, eine Ladepunkt-Bewertung auf Basis des im Profil hinterlegten
-- Fahrzeugs + Wohnwagens abzugeben (statt nur Freitext-Gespannmasse), damit
-- spaeter eine Verteilung "wie tauglich ist dieser Ladepunkt je nach
-- Gespannlaenge" ueber alle Bewertungen berechnet werden kann.

alter table public.vehicles add column length_m numeric;
alter table public.vehicle_models add column length_m numeric;

alter table public.charging_reviews
  add column vehicle_id uuid references public.vehicles (id) on delete set null,
  add column caravan_id uuid references public.caravans (id) on delete set null;

comment on column public.charging_reviews.trailer_length_m is
  'Gespannlaenge gesamt (Zugfahrzeug + Wohnwagen) in Metern -- entweder aus vehicle_id/caravan_id berechnet oder manuell eingegeben.';
