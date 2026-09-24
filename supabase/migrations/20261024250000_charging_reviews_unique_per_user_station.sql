-- Sicherheits-/UX-Audit (2026-09-24): anders als public.campsite_reviews
-- (unique(user_id, campsite_id), siehe 20260904210000_init_schema.sql)
-- hatte public.charging_reviews nie eine Unique-Constraint -- weder ein
-- Skript noch ein Doppel-Tap auf "Bewertung abschicken" (die betroffenen
-- Formulare zeigten bisher keinen Pending-/Disabled-Zustand waehrend des
-- Absendens) wurden verhindert, beide konnten beliebig viele Bewertungen
-- fuer denselben Ladepunkt vom selben Nutzer anlegen. src/app/ladepunkte/
-- [id]/actions.ts (addChargingReview) wurde im selben Zug von insert() auf
-- upsert(onConflict: user_id,charging_station_id) umgestellt -- ein
-- zweiter Bewertungsversuch aktualisiert die bestehende Bewertung jetzt,
-- statt mit einer rohen Postgres-Constraint-Fehlermeldung fehlzuschlagen.
--
-- Vor dem Hinzufuegen der Constraint werden bestehende Duplikate bereinigt
-- (sonst schlaegt "add constraint unique" fehl) -- pro (user_id,
-- charging_station_id) bleibt nur die neueste Zeile (created_at, bei exakt
-- gleichem Zeitstempel deterministisch per id) erhalten.

delete from public.charging_reviews cr
using public.charging_reviews newer
where cr.user_id = newer.user_id
  and cr.charging_station_id = newer.charging_station_id
  and cr.created_at < newer.created_at;

delete from public.charging_reviews cr
using public.charging_reviews newer
where cr.user_id = newer.user_id
  and cr.charging_station_id = newer.charging_station_id
  and cr.created_at = newer.created_at
  and cr.id < newer.id;

alter table public.charging_reviews
  add constraint charging_reviews_user_station_unique unique (user_id, charging_station_id);
