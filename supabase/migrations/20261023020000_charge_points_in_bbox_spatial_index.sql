-- Nutzermeldung: die Ladepunkte-Karte (charge2camp.vercel.app/ladepunkte)
-- zeigt beim Schwenken/Zoomen keine Saeulen -- /api/charge-points/viewport
-- antwortet durchgehend mit 500 (Statement-Timeout).
--
-- Root Cause: fetchChargingStations() (src/lib/charging-stations.ts) filtert
-- den Kartenausschnitt ueber core.charge_point_geo.lat/lon -- berechnete
-- Spalten (st_y(geom::geometry)/st_x(geom::geometry)) -- mit einfachen
-- Zahlenvergleichen (>=/<=). Der vorhandene GiST-Index auf core.charge_point.
-- geom (idx_cp_geom) beschleunigt aber nur echte raeumliche Operatoren
-- (&&, ST_Intersects, ST_DWithin) auf der geom-Spalte SELBST -- nicht
-- Zahlenvergleiche auf einem Funktionsergebnis. Postgres kann den Index
-- dadurch nicht nutzen und macht einen kompletten Sequential Scan ueber alle
-- ~168.000 Ladepunkte, inkl. ST_Y/ST_X-Berechnung pro Zeile, bei JEDEM
-- einzelnen Kartenschwenk (alle 500ms moeglich, siehe
-- VIEWPORT_FETCH_DEBOUNCE_MS). Gemessen: 14.874ms fuer einen kleinen,
-- realistischen Kartenausschnitt -- weit ueber dem PostgREST-Statement-
-- Timeout von ca. 8-9s, deshalb praktisch IMMER ein 500er bei aktivem
-- Kartenschwenken.
--
-- Fix: neue Funktion mit dem raeumlichen "&&"-Operator direkt auf geom
-- (geography-Spalte) -- nutzt idx_cp_geom via Index Scan. Gemessen (gleicher
-- Kartenausschnitt): 53ms statt 14.874ms (~280x), identisches Ergebnis (2
-- Treffer in beiden Faellen). src/lib/charging-stations.ts wird in einem
-- zweiten Schritt auf diese Funktion umgestellt, statt weiter core.
-- charge_point_geo mit lat/lon-Zahlenvergleichen zu filtern.
create or replace function core.charge_points_in_bbox(
    p_west double precision,
    p_south double precision,
    p_east double precision,
    p_north double precision,
    p_min_power_kw numeric default null,
    p_q text default null,
    p_limit integer default 5000
)
returns setof core.charge_point_geo
language sql
stable
security definer
set search_path = core, public
as $$
    select
        cp.id, cp.external_key, cp.name, cp.operator, cp.network, cp.geom,
        cp.address, cp.postcode, cp.city, cp.country_code, cp.access_type,
        cp.is_operational, cp.max_power_kw, cp.connector_count, cp.source,
        cp.source_updated_at, cp.last_seen_at, cp.created_at, cp.updated_at,
        cp.is_active,
        st_y(cp.geom::geometry) as lat, st_x(cp.geom::geometry) as lon
    from core.charge_point cp
    where cp.is_active
      and cp.geom && ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)::geography
      and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
      and (p_q is null or cp.name ilike '%' || p_q || '%')
    order by cp.name
    limit p_limit;
$$;

comment on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer) is
  'Kartenausschnitt-Suche fuer /api/charge-points/viewport (fetchChargingStations, src/lib/charging-stations.ts) -- nutzt den raeumlichen "&&"-Operator auf core.charge_point.geom (GiST-Index idx_cp_geom) statt Zahlenvergleichen auf den berechneten lat/lon-Spalten von core.charge_point_geo, die keinen Index nutzen konnten (14,9s Sequential Scan -> 53ms, 20261023020000). Rueckgabeform identisch zu core.charge_point_geo, damit bestehender Client-Code unveraendert bleibt.';

grant execute on function core.charge_points_in_bbox(double precision, double precision, double precision, double precision, numeric, text, integer) to service_role;
