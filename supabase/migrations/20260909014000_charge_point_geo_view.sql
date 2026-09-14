-- core.charge_point speichert die Position als geography(Point,4326) --
-- ueber PostgREST kommt das nur als GeoJSON/WKB zurueck, nicht als
-- einfache lat/lon-Zahlen. Diese View legt lat/lon offen (gleiches Muster
-- wie core.campsite_search), damit die App-Seiten /ladepunkte einfache
-- Zahlenspalten abfragen koennen, ohne PostGIS-Funktionen ueber den
-- JS-Client aufzurufen.
create view core.charge_point_geo as
select
    cp.*,
    ST_Y(cp.geom::geometry) as lat,
    ST_X(cp.geom::geometry) as lon
from core.charge_point cp;

grant select on core.charge_point_geo to anon, authenticated;
