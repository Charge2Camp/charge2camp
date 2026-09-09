-- Campingplatz-Bewertungen sollen sich ausschliesslich auf die
-- Lademoeglichkeit beziehen statt auf eine allgemeine Sternebewertung
-- (Nutzerwunsch). Zwei Ja/Nein-Fragen ersetzen den bisherigen freien
-- Sterne-Picker im Formular; `rating` bleibt bestehen (wird jetzt aus den
-- beiden Antworten abgeleitet statt direkt erfragt, siehe
-- deriveCampsiteRating() in ev-camping-score.ts) -- dadurch fliesst die
-- EV-Bewertung automatisch weiter in den bestehenden communityRating-Faktor
-- des EV-Camping-Scores ein, ohne die Scoring-Logik selbst aendern zu
-- muessen.
alter table public.campsite_reviews
  add column charging_on_site boolean not null,
  add column charging_walkable boolean not null;

comment on column public.campsite_reviews.charging_on_site is
  'Laden auf dem Platz moeglich (Nutzerangabe bei der Bewertung).';
comment on column public.campsite_reviews.charging_walkable is
  'Nutzbare Ladeloesung fussläufig erreichbar (Nutzerangabe bei der Bewertung).';
