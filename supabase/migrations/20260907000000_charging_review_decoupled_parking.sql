-- Zusatzfrage bei "Mit Einschraenkungen"-Bewertungen (§18): Da man mit
-- Gespann meist nicht direkt an die Ladesaeule heranfahren kann, ist
-- relevant, ob der Wohnwagen in unmittelbarer Naehe komfortabel abgestellt
-- werden kann, waehrend das Zugfahrzeug abgekoppelt laedt.

alter table public.charging_reviews
  add column decoupled_parking_possible boolean;

comment on column public.charging_reviews.decoupled_parking_possible is
  'Nur relevant wenn suitable = ''limited'': kann der Wohnwagen abgekoppelt und bequem in unmittelbarer Naehe der Ladesaeule geparkt werden, waehrend das Zugfahrzeug laedt?';
