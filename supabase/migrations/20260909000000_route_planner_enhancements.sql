-- ---------------------------------------------------------------------------
-- charging_reviews: strukturierte Kriterien fuer "echten Drive-Through ohne
-- Rangieren/Abkoppeln" (angelehnt an evcaravan.de) statt nur Freitext in
-- trailer_notes. Jedes Feld ist optional (null = keine Angabe).
-- ---------------------------------------------------------------------------
alter table public.charging_reviews
  add column enough_space_for_rig boolean,
  add column unobstructed_access boolean,
  add column no_barrier_or_garage boolean,
  add column side_mounted_charger boolean;

comment on column public.charging_reviews.enough_space_for_rig is
  'Genug Platz fuer Zugfahrzeug + Wohnwagen (Faustregel ab ca. 15 m) vorhanden.';
comment on column public.charging_reviews.unobstructed_access is
  'Freie Rangierflaeche ohne Hindernisse beim An-/Abfahren.';
comment on column public.charging_reviews.no_barrier_or_garage is
  'Kein Parkhaus und keine Schranke, die ein Gespann behindern wuerde.';
comment on column public.charging_reviews.side_mounted_charger is
  'Ladesaeule seitlich montiert mit ausreichender Kabellaenge fuers Gespann.';

-- ---------------------------------------------------------------------------
-- saved_routes: bevorzugter Anbieter-Filter + manuelle Zwischenstopps
-- (Wegpunkte unabhaengig von der Ladeplanung, z. B. ein Lieblings-
-- Campingplatz oder Sehenswuerdigkeit, die die Route zwingend durchfahren
-- soll -- siehe route-timeline.ts).
-- ---------------------------------------------------------------------------
alter table public.saved_routes
  add column preferred_provider text,
  add column manual_stops jsonb not null default '[]';

comment on column public.saved_routes.manual_stops is
  'Array von {query, display_name, latitude, longitude} -- vom Nutzer manuell hinzugefuegte, zwingend zu durchfahrende Zwischenstopps (unabhaengig vom Ladebedarf).';
