-- Konsolidiert "Laden auf dem Platz" und "Laden am Stellplatz" zu EINEM
-- Signal (Nutzeranfrage: "diese Merkmale sollen konsolidiert ein nutzbarer
-- Filter sein fuer Laden am Campingplatz, egal ob auf dem Platz oder am
-- Stellplatz"). Bisher waren das zwei unabhaengige Datenpunkte: die
-- "Lademoeglichkeit"-Chips (core.campsite_search.charging_on_site) kannten
-- core.campsite_amenity.charging_at_pitch (separates OSM-/Community-Tag,
-- core.amenity Kategorie "laden") gar nicht -- ein Platz, der NUR per
-- charging_at_pitch-Merkmal als ladefaehig markiert war (keine Zeile in
-- enrich.campsite_charging, keine core.campsite_charge_link-Verknuepfung),
-- fiel beim "Auf dem Platz"-Filter faelschlich durchs Raster. Laden am
-- Stellplatz ist immer eine Teilmenge von Laden auf dem Platz (Stellplatz
-- liegt auf dem Platz) -- ein eigener Filter dafuer war ohnehin ueberfluessig
-- granular, s. docs/DESIGN_DECISIONS.md.
--
-- Als core.-Funktion statt viermal dupliziertem SQL-Ausdruck (der bisherige
-- coalesce(ecc.has_charging, exists(...))-Ausdruck stand identisch an 4
-- Stellen in core.campsite_search: charging_on_site selbst + dreimal in der
-- ev_score-Berechnung) -- eine einzige Definition verhindert, dass die
-- Stellen bei kuenftigen Aenderungen auseinanderlaufen.
create or replace function core.campsite_has_onsite_charging(p_campsite_key text, p_campsite_id uuid)
returns boolean
language sql
stable
as $$
  -- Eigene Recherche (enrich.campsite_charging.has_charging) hat weiterhin
  -- Vorrang, WENN gesetzt (auch ein explizites "nein") -- erst wenn dort gar
  -- nichts recherchiert wurde (NULL), zaehlen die automatischen Signale:
  -- OSM-abgeleitete on_site-Verknuepfung ODER das Community-/OSM-Merkmal
  -- "Laden am Stellplatz".
  select coalesce(
    (select ecc.has_charging from enrich.campsite_charging ecc where ecc.campsite_key = p_campsite_key),
    exists (select 1 from core.campsite_charge_link l
            where l.campsite_id = p_campsite_id and l.relation = 'on_site')
    or exists (select 1 from core.campsite_amenity ca
               where ca.campsite_id = p_campsite_id and ca.amenity_key = 'charging_at_pitch' and ca.value_bool is true)
  );
$$;

drop materialized view core.campsite_search;

create materialized view core.campsite_search as
select
    cs.id, cs.external_key, cs.name, cs.slug,
    cs.country_code, cs.city, cs.website,
    st_y(cs.geom::geometry) as lat,
    st_x(cs.geom::geometry) as lon,
    coalesce((select array_agg(ca.amenity_key order by ca.amenity_key)
              from core.campsite_amenity ca
              where ca.campsite_id = cs.id and ca.value_bool is true),
             '{}') as amenities,
    core.campsite_has_onsite_charging(cs.external_key, cs.id) as charging_on_site,
    ecc.max_power_kw   as on_site_power_kw,
    ecc.point_count    as on_site_point_count,
    ecc.pitch_charging,
    ecc.charging_type,
    ecc.origin         as charging_origin,
    (select min(l.walk_distance_m) from core.campsite_charge_link l
     where l.campsite_id = cs.id and l.relation = 'walking') as nearest_walk_m,
    -- Das Alleinstellungsmerkmal: naechster ANHAENGERTAUGLICHER Ladepunkt
    (select min(l.walk_distance_m)
     from core.campsite_charge_link l
     join core.charge_point cp on cp.id = l.charge_point_id
     join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
     where l.campsite_id = cs.id and ts.verdict = 'yes') as nearest_trailer_ok_m,
    (select max(cp.max_power_kw)
     from core.campsite_charge_link l
     join core.charge_point cp on cp.id = l.charge_point_id
     where l.campsite_id = cs.id and l.walk_distance_m <= 1000)
        as nearby_max_power_kw,
    (select count(*) from core.campsite_charge_link l
     where l.campsite_id = cs.id and l.relation in ('on_site','walking'))
        as charge_points_walkable,
    -- Naechster fusslaeufig (relation='walking') erreichbarer AC- bzw.
    -- DC-Ladepunkt, getrennt nach core.connector.current_type -- anders als
    -- nearest_walk_m oben (der macht keine AC/DC-Unterscheidung).
    (select min(l.walk_distance_m)
     from core.campsite_charge_link l
     join core.connector co on co.charge_point_id = l.charge_point_id
     where l.campsite_id = cs.id and l.relation = 'walking' and co.current_type = 'AC')
        as walkable_ac_m,
    (select min(l.walk_distance_m)
     from core.campsite_charge_link l
     join core.connector co on co.charge_point_id = l.charge_point_id
     where l.campsite_id = cs.id and l.relation = 'walking' and co.current_type = 'DC')
        as walkable_dc_m,
    -- Durchschnittliche Community-Bewertung (1-5 Sterne, siehe
    -- deriveCampsiteRating() in ev-camping-score.ts) -- eigene, von
    -- ev_score UNABHAENGIGE Spalte: der Score bildet Lade-Infrastruktur ab,
    -- rating_avg die tatsaechliche Nutzererfahrung vor Ort (Nutzeranfrage:
    -- "EV Camping Tauglichkeit Bewertung" als eigenes Auswahlkriterium).
    -- ::float8 statt des rohen numeric-Ergebnisses von avg() -- PostgREST
    -- serialisiert `numeric` als JSON-STRING (Praezisionsschutz), das
    -- TS-Feld CampsiteSearchRow.rating_avg ist aber `number | null` (wie
    -- bereits an anderer Stelle im Code, z. B. ratingAvg auf der
    -- Detailseite, direkt aus reviews berechnet statt aus der DB gelesen).
    (select avg(cr.rating) from public.campsite_reviews cr where cr.campsite_id = cs.id)::float8 as rating_avg,
    -- EV-Camping-Score (0-100) -- siehe Kommentar in Migration
    -- 20261025080000.
    coalesce(
      cs.ev_score_override,
      round(
        -- onSite (25 Punkte)
        (case when core.campsite_has_onsite_charging(cs.external_key, cs.id) then 25 else 0 end)
        -- power (15 Punkte, volle Punktzahl ab 22 kW; unbekannte Leistung
        -- trotz Laden auf dem Platz = pauschal 10 statt 0, siehe
        -- ev-camping-score.ts)
        + (case
             when not core.campsite_has_onsite_charging(cs.external_key, cs.id) then 0
             when ecc.max_power_kw is null then 10
             else least(1.0, ecc.max_power_kw / 22.0) * 15
           end)
        -- pointCount (10 Punkte, volle Punktzahl ab 2 Ladepunkten auf dem
        -- Platz -- Admin-Korrektur ecc.point_count hat Vorrang, sonst Anzahl
        -- der OSM-abgeleiteten on_site-Verknuepfungen)
        + (case
             when not core.campsite_has_onsite_charging(cs.external_key, cs.id) then 0
             else least(1.0,
                    coalesce(ecc.point_count,
                      (select count(*) from core.campsite_charge_link l where l.campsite_id = cs.id and l.relation = 'on_site')
                    )::numeric / 2.0
                  ) * 10
           end)
        -- fastChargerProximity (20 Punkte, fusslaeufiger Schnelllader
        -- >=100 kW innerhalb 15 km Gehstrecke)
        + (case when exists (
             select 1 from core.campsite_charge_link l
             join core.charge_point cp on cp.id = l.charge_point_id
             where l.campsite_id = cs.id and l.walk_distance_m is not null
               and cp.max_power_kw >= 100 and l.walk_distance_m <= 15000
           ) then 20 else 0 end)
        -- communityRating (20 Punkte, Stufen wie communityRatingFactor())
        + (case
             when (select avg(cr.rating) from public.campsite_reviews cr where cr.campsite_id = cs.id) >= 4.5 then 20
             when (select avg(cr.rating) from public.campsite_reviews cr where cr.campsite_id = cs.id) > 3.5 then 10
             else 0
           end)
        -- dataFreshness (10 Punkte, Stufen wie dataFreshnessFactor())
        + (case
             when cs.last_seen_at >= now() - interval '30 days' then 10
             when cs.last_seen_at >= now() - interval '180 days' then 5
             else 0
           end)
      )
    )::int as ev_score
from core.campsite cs
left join enrich.campsite_charging ecc on ecc.campsite_key = cs.external_key
where cs.is_active;

create unique index idx_cssearch_id on core.campsite_search (id);
create index idx_cssearch_amen on core.campsite_search using gin (amenities);
create index idx_cssearch_geo  on core.campsite_search (lat, lon);
create index idx_cssearch_score on core.campsite_search (ev_score);

grant select on core.campsite_search to anon, authenticated;

select core.refresh_campsite_search();
