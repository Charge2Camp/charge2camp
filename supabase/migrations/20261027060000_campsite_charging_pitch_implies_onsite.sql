-- "Laden am Stellplatz" ist in "Laden auf dem Platz" konsolidiert
-- (docs/DESIGN_DECISIONS.md, 2026-10-03). Alte Admin-Overrides mit
-- pitch_charging = true, aber has_charging = false/null, galten faelschlich
-- als "kein Laden auf dem Platz". Der Stellplatz liegt auf dem Platz.
update enrich.campsite_charging
set has_charging = true,
    updated_at = now()
where pitch_charging is true
  and has_charging is distinct from true;

select core.refresh_campsite_search();
