-- core.charge_point_geo/core.campsite_search filtern beide auf is_active
-- (fuer die Haupt-App richtig -- deaktivierte Eintraege sollen dort
-- unsichtbar sein). Das Admin-Backend braucht aber lat/lon AUCH fuer
-- deaktivierte Datensaetze (z. B. beim Bearbeiten/Korrigieren von
-- Koordinaten, siehe "Unplausible Koordinaten"-Qualitaetscheck) -- dafuer
-- zwei ungefilterte Views, analog aufgebaut, aber ohne WHERE is_active.
-- Nur per service_role gelesen (Admin-Backend), kein Grant an
-- anon/authenticated noetig.

create view core.charge_point_geo_admin as
select
    cp.*,
    ST_Y(cp.geom::geometry) as lat,
    ST_X(cp.geom::geometry) as lon
from core.charge_point cp;

grant select on core.charge_point_geo_admin to service_role;

create view core.campsite_geo_admin as
select
    cs.*,
    ST_Y(cs.geom::geometry) as lat,
    ST_X(cs.geom::geometry) as lon
from core.campsite cs;

grant select on core.campsite_geo_admin to service_role;
