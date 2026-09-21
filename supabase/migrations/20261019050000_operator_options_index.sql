-- Fortsetzung von 20261019040000: core.charge_point_operator_options()
-- (20261006000000/20261009000000) -- aufgerufen bei JEDEM Aufruf von
-- /ladepunkte fuer die Betreiber-Filterliste -- macht eine GROUP BY
-- operator-Aggregation ohne unterstuetzenden Index ueber core.charge_point.
-- Bei 234.587 Zeilen (I/O-Durchsatz der Instanz siehe 20261019030000)
-- timet allein diese Funktion bereits aus (gemessen: 8,4s, 57014) --
-- unabhaengig vom idx_cp_active_name/idx_cp_active_fast_name Index, der
-- fuer name-Sortierung gedacht ist, nicht fuer operator-Gruppierung.
-- Schlanker partieller Index nur auf operator (nicht die vollen 382MB
-- breiten Zeilen) erlaubt einen Index-Only-Scan fuer die Aggregation.
create index idx_cp_active_operator on core.charge_point (operator)
    where is_active and operator is not null;
