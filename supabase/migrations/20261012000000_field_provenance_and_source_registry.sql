-- Feldbasierte Quellenpriorisierung & Provenance (Auftrag "Charge2Camp --
-- Verbindliche Datenpriorisierung und Importlogik", siehe
-- \\MyCloud\work\charge2camp\LAdesäule_Schnittstellen.rtf).
--
-- Ausgangslage: core.charge_point.manual_override (20261001000000) schuetzt
-- bereits eine feste Spaltenliste als Ganzes, aber NUR im Python-Importer
-- (ingest/import_ocm.py, UPSERT_CORE_SQL). Der taegliche Vercel-Cron
-- (src/app/api/cron/ocm-import/route.ts) schrieb bisher per PostgREST-
-- .upsert() OHNE diese Pruefung -- ein Admin-Korrektur an Name/Betreiber/
-- Adresse/etc. wurde also durch den naechtlichen Cron-Lauf trotzdem
-- ueberschrieben, obwohl manual_override=true war (der eigentliche Bug, den
-- manual_override beheben sollte, existierte im produktiven Pfad also nach
-- wie vor). Diese Migration konsolidiert die Merge-Logik in EINE
-- SQL-Funktion (core.upsert_charge_point), die von Python UND vom
-- TS-Cron-Job aufgerufen wird -- kein zweiter Merge-Pfad mehr moeglich.
--
-- Gleichzeitig war der Schutz der manuell verifizierten Anhaenger-
-- Tauglichkeit (enrich.trailer_suitability) bisher nur eine String-
-- Konvention (origin = 'admin_override'), separat in zwei Funktionen
-- geprueft (import_ocm.py FILL_MISSING_TRAILER_SUITABILITY_SQL,
-- enrich.moderate_trailer_report). Das wird jetzt zu einem harten
-- manual_override-Flag + einer einzigen Schreibfunktion
-- (enrich.set_trailer_suitability), die JEDER Schreibpfad verwenden muss --
-- Vorgabe Abschnitt 13 ("Diese Logik darf nicht nur in einem einzelnen
-- Importer implementiert werden").
--
-- Bewusst additiv: alle neuen Spalten haben Defaults, bestehende Daten
-- werden per Backfill-UPDATE uebernommen, nichts wird geloescht.

-- ============ SOURCE REGISTRY ============

create table core.source_registry (
    source_id             text primary key,
    source_name           text not null,
    country               char(2),                  -- NULL = laenderuebergreifend
    source_type           text not null check (source_type in
                             ('MANUAL_CHARGE2CAMP','OFFICIAL_NATIONAL','OTHER_OFFICIAL','SECONDARY','OSM_CONTEXT')),
    priority              smallint not null,
    license               text,
    commercial_use        boolean,
    attribution_required  boolean,
    update_frequency      text,
    api_information       text,
    last_successful_import timestamptz
);

comment on table core.source_registry is
  'Verbindliche Quellenprioritaet je Datenquelle, siehe Auftragsdokument Abschnitt 1/14. priority ist die Tie-Break-Referenz fuer core.upsert_charge_point(); der eigentliche Feldschutz laeuft aber ueber manual_override (core.charge_point) bzw. enrich.trailer_suitability.manual_override, nicht ueber einen reinen Prioritaetsvergleich -- siehe Abschnitt 22.';

insert into core.source_registry (source_id, source_name, country, source_type, priority, license, commercial_use, attribution_required, update_frequency, api_information, last_successful_import)
values
    ('admin_manual', 'Charge2Camp Admin (manuelle Eingabe/Korrektur)', null, 'MANUAL_CHARGE2CAMP', 100, null, true, false, 'ad-hoc', 'admin/app/(dashboard)/ladestationen', now()),
    ('sascha_list', 'Charge2Camp Sascha-Liste (recherchierte Anhaenger-Bewertungen)', null, 'MANUAL_CHARGE2CAMP', 100, 'intern', true, false, 'ad-hoc', null, null),
    -- Bundesnetzagentur ist eine offizielle nationale Quelle (Abschnitt 1,
    -- Prioritaet 2), aber noch nicht live angebunden -- siehe
    -- ingest/import_bnetza.py (Geruest, wartet auf reale Exportdatei vom
    -- Nutzer). last_successful_import bleibt NULL bis zum ersten echten Lauf.
    ('bundesnetzagentur', 'Bundesnetzagentur Ladesaeulenregister', 'DE', 'OFFICIAL_NATIONAL', 90, 'siehe ladesaeulenregister.de/Impressum', null, null, 'unbekannt (CSV-Download, kein Live-API)', 'https://www.bundesnetzagentur.de/ladesaeulenregister (CSV/XLSX-Export, Spaltenzuordnung TODO)', null),
    -- OCM ist eine community-gepflegte, keine staatliche Quelle -- entspricht
    -- Prioritaetsstufe 4 (SEKUNDAER) des Auftragsdokuments, nicht Stufe 2.
    ('ocm', 'Open Charge Map', null, 'SECONDARY', 40, 'ODbL (siehe openchargemap.org)', true, true, 'taeglich (Vercel Cron, siehe src/app/api/cron/ocm-import)', 'https://api.openchargemap.io/v3/poi', null),
    ('osm', 'OpenStreetMap', null, 'OSM_CONTEXT', 10, 'ODbL', true, true, 'unregelmaessig', null, null);

-- last_successful_import fuer ocm aus dem bisherigen Audit-Trail nachtragen,
-- damit die Registry ab sofort konsistent ist statt mit NULL zu starten,
-- obwohl taeglich importiert wird.
update core.source_registry sr
set last_successful_import = latest.finished_at
from (
    select max(finished_at) as finished_at
    from raw.import_run
    where source = 'ocm' and status = 'ok'
) latest
where sr.source_id = 'ocm' and latest.finished_at is not null;

-- ============ FIELD PROVENANCE & CHANGE LOG (core.charge_point) ============

alter table core.charge_point
  add column field_provenance jsonb not null default '{}'::jsonb;

comment on column core.charge_point.field_provenance is
  'Je Feld: {"source": "<source_id>", "updated_at": "..."} -- welche Quelle den aktuell gespeicherten Wert zuletzt geliefert hat, siehe Auftragsdokument Abschnitt 15. Wird ausschliesslich von core.upsert_charge_point() geschrieben.';

create table core.field_change_log (
    id               bigserial primary key,
    charge_point_id  uuid not null references core.charge_point(id) on delete cascade,
    field            text not null,
    incoming_value   text,
    incoming_source  text not null,
    action           text not null check (action in ('applied', 'rejected_by_manual_override')),
    existing_value   text,
    created_at       timestamptz not null default now()
);
create index idx_fcl_charge_point on core.field_change_log (charge_point_id, created_at desc);

comment on table core.field_change_log is
  'Audit-Trail fuer core.upsert_charge_point(): jeder Konflikt zwischen eingehendem und gespeichertem Feldwert, inkl. per manual_override abgelehnter Aenderungen, siehe Auftragsdokument Abschnitt 15 Beispiel.';

-- ============ ZENTRALER RESOLVER ============

-- Ersetzt UPSERT_CORE_SQL in ingest/import_ocm.py und den bisherigen
-- PostgREST-.upsert()-Aufruf in src/app/api/cron/ocm-import/route.ts. Beide
-- rufen ab jetzt AUSSCHLIESSLICH diese Funktion -- die eigentliche
-- Feld-fuer-Feld-Schutzlogik existiert nur noch an einer Stelle.
--
-- Geschuetzte Felder unter manual_override (identisch zum bisherigen
-- Python-Verhalten, siehe Kommentar an UPSERT_CORE_SQL): name, operator,
-- geom, address, city, country_code, access_type, max_power_kw,
-- connector_count. Ausnahme is_operational: eine gemeldete Nicht-
-- Betriebsbereitschaft wird IMMER uebernommen (20261008000000). network,
-- postcode und die Buchhaltungsfelder (source_updated_at/last_seen_at/
-- updated_at) sind nie geschuetzt -- das ist bewusst ein Superset des
-- Auftragsdokuments (siehe Ruecksprache: der bestehende, aus einem echten
-- Bug entstandene Schutz bleibt erhalten, statt ihn auf die im Dokument
-- explizit genannten Felder zu reduzieren).
create or replace function core.upsert_charge_point(
    p_payload jsonb,
    p_source text
) returns table(id uuid, manual_override boolean, is_new boolean)
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_external_key text := p_payload->>'external_key';
    v_lon double precision := nullif(p_payload->>'lon', '')::double precision;
    v_lat double precision := nullif(p_payload->>'lat', '')::double precision;
    v_incoming_geom geography := ST_SetSRID(ST_MakePoint(v_lon, v_lat), 4326)::geography;
    v_existing core.charge_point%rowtype;
    v_id uuid;
    v_manual boolean;
    v_incoming_is_operational boolean := (p_payload->>'is_operational')::boolean;
    v_name text; v_operator text; v_geom geography; v_address text; v_city text;
    v_country_code text; v_access_type text; v_max_power_kw numeric; v_connector_count int;
    v_is_operational boolean; v_network text; v_postcode text;
begin
    if not exists (select 1 from core.source_registry where source_id = p_source) then
        raise exception 'Unbekannte Quelle "%" -- core.source_registry benoetigt vorab einen Eintrag.', p_source;
    end if;
    if v_lon is null or v_lat is null then
        raise exception 'core.upsert_charge_point: lon/lat fehlen fuer external_key %', v_external_key;
    end if;

    select * into v_existing from core.charge_point where external_key = v_external_key for update;

    if not found then
        insert into core.charge_point (
            external_key, name, operator, network, geom, address, postcode, city,
            country_code, access_type, is_operational, max_power_kw, connector_count,
            source, source_updated_at, last_seen_at, updated_at, is_active, field_provenance
        ) values (
            v_external_key,
            p_payload->>'name', p_payload->>'operator', p_payload->>'network', v_incoming_geom,
            p_payload->>'address', p_payload->>'postcode', p_payload->>'city',
            p_payload->>'country_code', p_payload->>'access_type',
            coalesce(v_incoming_is_operational, true),
            nullif(p_payload->>'max_power_kw', '')::numeric,
            nullif(p_payload->>'connector_count', '')::int,
            p_source, nullif(p_payload->>'source_updated_at', '')::timestamptz, now(), now(),
            coalesce((p_payload->>'initial_is_active')::boolean, true),
            (
                select jsonb_object_agg(f, jsonb_build_object('source', p_source, 'updated_at', now()))
                from unnest(array[
                    'name','operator','network','geom','address','postcode','city',
                    'country_code','access_type','is_operational','max_power_kw','connector_count'
                ]) f
            )
        )
        returning core.charge_point.id into v_id;

        return query select v_id, false, true;
        return;
    end if;

    v_id := v_existing.id;
    v_manual := v_existing.manual_override;

    v_name           := case when v_manual then v_existing.name else p_payload->>'name' end;
    v_operator       := case when v_manual then v_existing.operator else p_payload->>'operator' end;
    v_geom           := case when v_manual then v_existing.geom else v_incoming_geom end;
    v_address        := case when v_manual then v_existing.address else p_payload->>'address' end;
    v_city           := case when v_manual then v_existing.city else p_payload->>'city' end;
    v_country_code   := case when v_manual then v_existing.country_code else p_payload->>'country_code' end;
    v_access_type    := case when v_manual then v_existing.access_type else p_payload->>'access_type' end;
    v_max_power_kw   := case when v_manual then v_existing.max_power_kw else nullif(p_payload->>'max_power_kw', '')::numeric end;
    v_connector_count := case when v_manual then v_existing.connector_count else nullif(p_payload->>'connector_count', '')::int end;
    v_is_operational := case
        when v_incoming_is_operational is false then false
        when v_manual then v_existing.is_operational
        else coalesce(v_incoming_is_operational, true)
    end;
    v_network  := p_payload->>'network';
    v_postcode := p_payload->>'postcode';

    update core.charge_point set
        name = v_name, operator = v_operator, network = v_network, geom = v_geom,
        address = v_address, postcode = v_postcode, city = v_city,
        country_code = v_country_code, access_type = v_access_type,
        is_operational = v_is_operational, max_power_kw = v_max_power_kw,
        connector_count = v_connector_count,
        source_updated_at = nullif(p_payload->>'source_updated_at', '')::timestamptz,
        last_seen_at = now(), updated_at = now(),
        field_provenance = field_provenance || jsonb_strip_nulls(jsonb_build_object(
            'name',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'operator',        case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'geom',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'address',         case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'city',            case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'country_code',    case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'access_type',     case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'max_power_kw',    case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'connector_count', case when not v_manual then jsonb_build_object('source', p_source, 'updated_at', now()) end,
            'is_operational',  jsonb_build_object('source', p_source, 'updated_at', now()),
            'network',         jsonb_build_object('source', p_source, 'updated_at', now()),
            'postcode',        jsonb_build_object('source', p_source, 'updated_at', now())
        ))
    where core.charge_point.id = v_id;

    with changes(field, incoming, final) as (
        values
            ('name', p_payload->>'name', v_name),
            ('operator', p_payload->>'operator', v_operator),
            ('address', p_payload->>'address', v_address),
            ('city', p_payload->>'city', v_city),
            ('country_code', p_payload->>'country_code', v_country_code),
            ('access_type', p_payload->>'access_type', v_access_type),
            -- Ueber numeric/int gecastet statt reinem Text-Vergleich: sonst
            -- meldet z.B. '150' (JSON-Text) vs. '150.00' (numeric(6,2)-
            -- Textrepraesentation) faelschlich einen Konflikt, obwohl beide
            -- Werte identisch sind.
            ('max_power_kw', (nullif(p_payload->>'max_power_kw', '')::numeric)::text, v_max_power_kw::text),
            ('connector_count', (nullif(p_payload->>'connector_count', '')::int)::text, v_connector_count::text),
            ('is_operational', v_incoming_is_operational::text, v_is_operational::text)
    )
    insert into core.field_change_log (charge_point_id, field, incoming_value, incoming_source, action, existing_value)
    select v_id, field, incoming, p_source,
           case when incoming is distinct from final then 'rejected_by_manual_override' else 'applied' end,
           final
    from changes
    where incoming is distinct from final
       or (final is distinct from (
           case field
               when 'name' then v_existing.name
               when 'operator' then v_existing.operator
               when 'address' then v_existing.address
               when 'city' then v_existing.city
               when 'country_code' then v_existing.country_code
               when 'access_type' then v_existing.access_type
               when 'max_power_kw' then v_existing.max_power_kw::text
               when 'connector_count' then v_existing.connector_count::text
               when 'is_operational' then v_existing.is_operational::text
           end
       ));

    return query select v_id, v_manual, false;
end;
$$;

comment on function core.upsert_charge_point(jsonb, text) is
  'Zentraler Feld-Resolver fuer alle Ladepunkt-Importer (Auftragsdokument Abschnitt 13). p_payload erwartet dieselben Keys wie ingest/import_ocm.py parse_poi(): external_key, name, operator, network, lat, lon, address, postcode, city, country_code, access_type, is_operational, max_power_kw, connector_count, source_updated_at, initial_is_active. Verbindet KEINE Anschluesse (core.connector) -- das bleibt Aufgabe des Aufrufers, siehe replace_connectors() in import_ocm.py.';

grant execute on function core.upsert_charge_point(jsonb, text) to service_role;

-- Bulk-Wrapper fuer den TS-Vercel-Cron (src/app/api/cron/ocm-import/route.ts):
-- der Cron-Job hat kein psycopg2/DB-Passwort zur Verfuegung (nur PostgREST/
-- RPC, siehe Kommentar in dieser Route), soll aber weiterhin in Batches statt
-- Einzelaufrufen schreiben. Ein Array-Payload + serverseitige Schleife
-- vermeidet N einzelne RPC-Roundtrips pro Land/Batch.
create or replace function core.upsert_charge_points_bulk(
    p_payloads jsonb,
    p_source text
) returns table(external_key text, id uuid, manual_override boolean, is_new boolean)
language plpgsql
security definer
set search_path = core, public
as $$
declare
    v_payload jsonb;
    v_result record;
begin
    for v_payload in select * from jsonb_array_elements(p_payloads)
    loop
        select u.id, u.manual_override, u.is_new into v_result
        from core.upsert_charge_point(v_payload, p_source) u;
        external_key := v_payload->>'external_key';
        id := v_result.id;
        manual_override := v_result.manual_override;
        is_new := v_result.is_new;
        return next;
    end loop;
end;
$$;

grant execute on function core.upsert_charge_points_bulk(jsonb, text) to service_role;

-- ============ ANHAENGER-TAUGLICHKEIT: HARTES MANUAL_OVERRIDE ============

alter table enrich.trailer_suitability
  add column manual_override boolean not null default false,
  add column source_type text not null default 'AUTO' check (source_type in ('MANUAL', 'AUTO')),
  add column verification_note text;

comment on column enrich.trailer_suitability.manual_override is
  'Wenn true: KEIN automatischer Import/keine Moderation darf verdict/drive_through/pull_in_length_m/maneuvering_space mehr aendern -- auch nicht auf UNKNOWN (Auftragsdokument Abschnitt 3+4). Einzige Ausnahme: eine erneute admin_override-Schreibung ueber enrich.set_trailer_suitability(). Ersetzt die bisherige origin=''admin_override''-Konvention als hartes Flag.';

-- Backfill: bestehende manuelle Bewertungen (Admin-Formular, Sascha-Liste,
-- Staff-Recherche) sind bereits Handarbeit und muessen denselben Schutz
-- rueckwirkend erhalten, sonst verliert eine bereits verifizierte
-- Anhaenger-Bewertung ihren Schutz bei der naechsten Moderation/dem
-- naechsten Reimport -- exakt der Datenverlust, den Auftragsdokument
-- Abschnitt 20 ausdruecklich verbietet.
update enrich.trailer_suitability
set manual_override = true, source_type = 'MANUAL'
where origin in ('admin_override', 'staff', 'sascha_list');

-- Zentrale Schreibfunktion (Auftragsdokument Abschnitt 13: "Alle
-- Datenimporte muessen denselben zentralen Resolver verwenden"). Ersetzt
-- direkte upsert()-Aufrufe auf enrich.trailer_suitability aus
-- admin/.../ladestationen/[id]/actions.ts overrideTrailerSuitability() und
-- die Merge-Logik in enrich.moderate_trailer_report().
create or replace function enrich.set_trailer_suitability(
    p_charge_point_key text,
    p_verdict text,
    p_origin text,
    p_drive_through boolean default null,
    p_pull_in_length_m numeric default null,
    p_maneuvering_space text default null,
    p_notes text default null,
    p_verification_note text default null,
    p_confirm_count int default null,
    p_dispute_count int default null,
    p_verified_by uuid default null
) returns enrich.trailer_suitability
language plpgsql
security definer
set search_path = enrich, public
as $$
declare
    v_is_manual_write boolean := p_origin = 'admin_override';
    v_existing enrich.trailer_suitability%rowtype;
    v_result enrich.trailer_suitability;
begin
    select * into v_existing from enrich.trailer_suitability where charge_point_key = p_charge_point_key for update;

    -- Bereits manuell fixiert und dieser Schreibvorgang ist KEINE erneute
    -- Admin-Korrektur -> Aenderung ablehnen, Bestand unveraendert
    -- zurueckgeben. Kein UNKNOWN-Reset (Abschnitt 4), keine stille
    -- Community-/Auto-Ueberschreibung (Abschnitt 3).
    if found and v_existing.manual_override and not v_is_manual_write then
        insert into core.field_change_log (charge_point_id, field, incoming_value, incoming_source, action, existing_value)
        select cp.id, 'caravan_suitability', p_verdict, p_origin, 'rejected_by_manual_override', v_existing.verdict
        from core.charge_point cp
        where cp.external_key = p_charge_point_key;
        return v_existing;
    end if;

    insert into enrich.trailer_suitability (
        charge_point_key, verdict, drive_through, pull_in_length_m, maneuvering_space, notes,
        origin, manual_override, source_type, verification_note,
        confirm_count, dispute_count, verified_at, verified_by, updated_at
    ) values (
        p_charge_point_key, p_verdict, p_drive_through, p_pull_in_length_m, p_maneuvering_space, p_notes,
        p_origin, v_is_manual_write, case when v_is_manual_write then 'MANUAL' else 'AUTO' end, p_verification_note,
        coalesce(p_confirm_count, 0), coalesce(p_dispute_count, 0),
        case when v_is_manual_write then now() else null end, p_verified_by, now()
    )
    on conflict (charge_point_key) do update set
        verdict = excluded.verdict,
        drive_through = excluded.drive_through,
        pull_in_length_m = excluded.pull_in_length_m,
        maneuvering_space = excluded.maneuvering_space,
        notes = excluded.notes,
        origin = excluded.origin,
        manual_override = excluded.manual_override,
        source_type = excluded.source_type,
        verification_note = excluded.verification_note,
        confirm_count = excluded.confirm_count,
        dispute_count = excluded.dispute_count,
        verified_at = coalesce(excluded.verified_at, trailer_suitability.verified_at),
        verified_by = coalesce(excluded.verified_by, trailer_suitability.verified_by),
        updated_at = now()
    returning * into v_result;

    return v_result;
end;
$$;

comment on function enrich.set_trailer_suitability(text, text, text, boolean, numeric, text, text, text, int, int, uuid) is
  'Einziger erlaubter Schreibpfad fuer enrich.trailer_suitability (Auftragsdokument Abschnitt 13). p_origin=''admin_override'' ist die einzige Quelle, die eine bestehende manual_override=true-Zeile aendern darf; jede andere Quelle wird bei manual_override=true abgelehnt und in core.field_change_log protokolliert.';

grant execute on function enrich.set_trailer_suitability(text, text, text, boolean, numeric, text, text, text, int, int, uuid) to service_role;

-- enrich.moderate_trailer_report() auf das harte manual_override-Flag
-- umstellen (bisher origin is distinct from 'admin_override', siehe
-- 20261001010000) und ueber die neue zentrale Funktion schreiben.
create or replace function enrich.moderate_trailer_report(
    p_report_id bigint,
    p_decision text,
    p_moderator_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = enrich, core, public
as $$
declare
    v_report enrich.trailer_report;
    v_key text;
    v_new_status text;
    v_verdict text;
    v_confirm_count int;
    v_dispute_count int;
    v_existing enrich.trailer_suitability%rowtype;
begin
    if p_decision not in ('approve', 'reject') then
        raise exception 'Ungueltige decision: %, erwartet approve oder reject', p_decision;
    end if;

    select * into v_report from enrich.trailer_report where id = p_report_id for update;
    if not found then
        raise exception 'trailer_report % nicht gefunden', p_report_id;
    end if;
    if v_report.status <> 'pending' then
        raise exception 'trailer_report % bereits moderiert (status=%)', p_report_id, v_report.status;
    end if;

    v_new_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;
    update enrich.trailer_report set status = v_new_status where id = p_report_id;
    v_key := v_report.charge_point_key;

    if p_decision = 'approve' then
        insert into enrich.app_user (id, display_name) values (p_moderator_id, null) on conflict (id) do nothing;

        with approved as (
            select tr.verdict, coalesce(au.trust_level, 1) as trust_level
            from enrich.trailer_report tr
            left join enrich.app_user au on au.id = tr.user_id
            where tr.charge_point_key = v_key and tr.status = 'approved'
        ),
        weighted as (
            select verdict, sum(trust_level) as weight
            from approved
            group by verdict
        ),
        ranked as (
            select verdict, weight,
                   case verdict when 'no' then 0 when 'unhitch' then 1 when 'yes' then 2 else 3 end as conservativeness
            from weighted
            order by weight desc, conservativeness asc
            limit 1
        )
        select r.verdict,
               (select count(*)::int from approved a where a.verdict = r.verdict),
               (select count(*)::int from approved a where a.verdict <> r.verdict)
        into v_verdict, v_confirm_count, v_dispute_count
        from ranked r;

        select * into v_existing from enrich.trailer_suitability where charge_point_key = v_key;

        perform enrich.set_trailer_suitability(
            p_charge_point_key => v_key,
            p_verdict => v_verdict,
            p_origin => 'community',
            p_drive_through => v_existing.drive_through,
            p_pull_in_length_m => v_existing.pull_in_length_m,
            p_maneuvering_space => v_existing.maneuvering_space,
            p_notes => v_existing.notes,
            p_confirm_count => v_confirm_count,
            p_dispute_count => v_dispute_count,
            p_verified_by => p_moderator_id
        );
    end if;

    return jsonb_build_object(
        'report', (select to_jsonb(tr) from enrich.trailer_report tr where tr.id = p_report_id),
        'trailer_suitability', (select to_jsonb(ts) from enrich.trailer_suitability ts where ts.charge_point_key = v_key)
    );
end;
$$;
