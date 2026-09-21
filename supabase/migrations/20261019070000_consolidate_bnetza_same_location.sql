-- Nutzerfeedback: BNetzA registriert eine Zeile pro einzelner
-- "Ladeeinrichtung" (Saeule), nicht pro physischem Standort -- ein Hub mit
-- z.B. 4 Saeulen erzeugt 4 core.charge_point-Zeilen mit EXAKT identischen
-- Koordinaten statt einer Zeile mit allen Anschluessen (so wie OCM es
-- macht). Folge: die Anhaengertauglichkeits-Pruefung (enrich.
-- trailer_suitability, an external_key gehaengt) gilt dadurch nur fuer
-- EINE der 4 Zeilen, nicht fuer den ganzen Standort -- und im Dubletten-
-- Dashboard erschien dieselbe OCM-Station mehrfach (siehe 20261019060000).
-- Umfang gemessen (Prod): 11.984 Standorte mit identischen Koordinaten
-- betreffen zusammen 44.834 von 116.443 BNetzA-Zeilen (~38%).
--
-- Backfill fuer bereits importierte Zeilen: fasst jede Gruppe von
-- core.charge_point-Zeilen (source='bundesnetzagentur') mit EXAKT
-- identischen Koordinaten zu einer Zeile zusammen -- wiederverwendet dafuer
-- core.merge_charge_points() (20260930020000), das Anschluesse (Dopplungen
-- addiert), Bewertungen/Favoriten/Blockliste/Anhaengertauglichkeit/
-- Campingplatz-Verknuepfungen bereits korrekt umhaengt, nichts geht
-- verloren. Ueberlebende Zeile = die mit der kleinsten numerischen
-- Ladeeinrichtungs-ID (stabil ueber Reimporte hinweg, siehe Aenderung an
-- ingest/import_bnetza.py in dieser Session, die zukuenftige Importe direkt
-- gruppiert). max_power_kw der zusammengefuehrten Station wird von
-- core.merge_charge_points() automatisch als max(power_kw) ueber ALLE
-- zusammengefuehrten Anschluesse neu berechnet (Nutzervorgabe: "die
-- staerkste [Saeule]" gewinnt, nicht die Summe). is_operational: true,
-- sobald mindestens eine der zusammengefuehrten Ladeeinrichtungen betriebs-
-- bereit ist (eine Saeule des Hubs funktioniert -> Standort nutzbar).
--
-- Braucht bei diesem Umfang mehrere Minuten -- nur ueber pg_cron aufrufen
-- (core.consolidate_bnetza_same_location()), nie synchron aus der Admin-UI
-- oder ueber den Pooler (siehe 20261019020000/20261019030000 fuer die
-- ausfuehrliche Begruendung: PostgREST/Pooler-Statement-Timeouts liegen bei
-- ca. 8-9s, weit unter der benoetigten Laufzeit).
create or replace function core.consolidate_bnetza_same_location()
returns table(survivor_external_key text, merged_count int)
language plpgsql
security definer
set search_path = core, public
as $$
declare
    grp record;
    other_id uuid;
    v_survivor_id uuid;
    v_survivor_key text;
    v_is_operational boolean;
    v_merged_count int;
begin
    -- Ueberlebende Zeile: falls eine der Gruppe bereits manual_override=true
    -- hat (Admin-Korrektur), gewinnt die -- sonst die kleinste numerische
    -- Ladeeinrichtungs-ID (stabil ueber Reimporte).
    for grp in
        select array_agg(id order by
            manual_override desc,
            (regexp_replace(external_key, '\D', '', 'g'))::bigint
        ) as ids
        from core.charge_point
        where source = 'bundesnetzagentur'
        group by geom
        having count(*) > 1
    loop
        v_survivor_id := grp.ids[1];
        v_merged_count := 0;

        select external_key, is_operational into v_survivor_key, v_is_operational
        from core.charge_point where id = v_survivor_id;

        foreach other_id in array grp.ids[2:array_length(grp.ids, 1)]
        loop
            select v_is_operational or cp.is_operational into v_is_operational
            from core.charge_point cp where cp.id = other_id;

            perform core.merge_charge_points(
                v_survivor_id, other_id,
                (select name from core.charge_point where id = v_survivor_id),
                (select operator from core.charge_point where id = v_survivor_id),
                (select network from core.charge_point where id = v_survivor_id),
                (select address from core.charge_point where id = v_survivor_id),
                (select postcode from core.charge_point where id = v_survivor_id),
                (select city from core.charge_point where id = v_survivor_id),
                (select country_code from core.charge_point where id = v_survivor_id),
                (select access_type from core.charge_point where id = v_survivor_id),
                v_is_operational
            );
            v_merged_count := v_merged_count + 1;
        end loop;

        return query select v_survivor_key, v_merged_count;
    end loop;
end;
$$;

grant execute on function core.consolidate_bnetza_same_location() to service_role;
