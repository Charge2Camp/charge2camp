-- Fortsetzung von 20261019010000: idx_cp_active_name deckt nur
-- "where is_active order by name" ab. Die Ladepunkte-Seite filtert per
-- Default aber zusaetzlich auf Schnelllader (fetchChargingStations() in
-- src/lib/charging-stations.ts, FAST_CHARGER_MIN_KW=100, "Nur Schnelllader"
-- ist seit Nutzerwunsch der Default-Zustand ohne aktiven Filter) --
-- ".gte('max_power_kw', 100).order('name').limit(1500)". Der bestehende
-- Index liefert dafuer zwar die Sortierung, aber Postgres muss trotzdem
-- potentiell sehr viele Zeilen in Namens-Reihenfolge lesen, bis 1500 mit
-- max_power_kw >= 100 gefunden sind -- gemessen (service_role, direkt gegen
-- Prod): 3,8s, damit knapp unter, aber nicht sicher unter dem PostgREST-
-- Statement-Timeout (Vercel-Logs zeigen abwechselnd erfolgreiche und mit
-- 57014 fehlschlagende /ladepunkte-Aufrufe). Zusaetzlicher partieller Index
-- exakt auf die Default-Query passend, macht daraus einen reinen Index-Scan
-- ohne Nachfiltern.
create index idx_cp_active_fast_name on core.charge_point (name)
    where is_active and max_power_kw >= 100;
