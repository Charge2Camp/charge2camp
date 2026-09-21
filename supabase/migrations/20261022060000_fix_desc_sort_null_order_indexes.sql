-- Fortsetzung von 20261022050000: name_asc/power_asc/country_asc profitieren
-- sofort von den bestehenden aufsteigenden Indizes (Execution Time 39-97ms),
-- aber name_desc/power_desc/last_seen_desc blieben bei 3,4-7,2s. Grund: die
-- Query gibt explizit "nulls last" vor, unabhaengig von der Richtung --
-- Postgres' Default fuer DESC ist aber "nulls first", ein gewoehnlicher
-- aufsteigender Index kann per Rueckwaerts-Scan also nur "desc nulls first"
-- liefern, nicht "desc nulls last". Ergebnis: kein Index-Scan moeglich,
-- Postgres sortiert die komplette gefilterte Treffermenge extern.
create index if not exists idx_cp_name_desc_nulls_last on core.charge_point (name desc nulls last);
create index if not exists idx_cp_power_desc_nulls_last on core.charge_point (max_power_kw desc nulls last);
create index if not exists idx_cp_last_seen_desc_nulls_last on core.charge_point (last_seen_at desc nulls last);
