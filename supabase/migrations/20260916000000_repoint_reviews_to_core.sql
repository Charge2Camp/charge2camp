-- App-Entscheidung: /campingplaetze und /ladepunkte (Liste + Detail) lesen
-- ab jetzt aus core.campsite/core.charge_point statt public.campsites/
-- public.charging_stations (echte Daten ersetzen die 3 Demo-Campingplaetze
-- und 54 Demo-Ladepunkte vollstaendig in der Anzeige). Bewertungen
-- (campsite_reviews/charging_reviews) muessen deshalb auf core.* zeigen,
-- sonst schlaegt jede neue Bewertung mit einem FK-Verletzungsfehler fehl.
--
-- Bestehende Test-Bewertungen auf den alten Demo-Objekten werden dabei
-- verworfen (per Nutzerentscheidung akzeptiert -- reine Testdaten, keine
-- echten Nutzerinhalte).
--
-- Der Routenplaner (Trip-Planung mit dem kuratierten Muenchen-Meran-Demo-
-- Korridor) bleibt bewusst UNVERAENDERT auf public.charging_stations --
-- das ist ein separates, getestetes Feature und nicht Teil dieser
-- Umstellung.

delete from public.campsite_reviews;
alter table public.campsite_reviews drop constraint campsite_reviews_campsite_id_fkey;
alter table public.campsite_reviews
    add constraint campsite_reviews_campsite_id_fkey
    foreign key (campsite_id) references core.campsite (id) on delete cascade;

delete from public.charging_reviews;
alter table public.charging_reviews drop constraint charging_reviews_charging_station_id_fkey;
alter table public.charging_reviews
    add constraint charging_reviews_charging_station_id_fkey
    foreign key (charging_station_id) references core.charge_point (id) on delete cascade;
