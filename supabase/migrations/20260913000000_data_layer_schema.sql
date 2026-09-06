-- Datenschicht Charge2Camp (Auftrag A-G, siehe CLAUDE_CODE_AUFTRAG.md) --
-- raw/core/enrich-Schema fuer echte europaeische Campingplatz-/
-- Ladesaeulendaten (Open Charge Map + OpenStreetMap), integriert in die
-- bestehende Supabase-Postgres-Instanz (nicht als separate Datenbank).
--
-- WICHTIG (Grundprinzip, siehe Auftragsdokument Abschnitt 5.1): Kein
-- Importskript darf jemals UPDATE/DELETE auf enrich.* ausfuehren. Die
-- Verbindung zwischen core und enrich laeuft ausschliesslich ueber den
-- stabilen Textschluessel external_key (z. B. 'ocm:12345', 'osm:way/123456'),
-- niemals ueber interne UUIDs.
--
-- Bewusst additiv: die bestehenden public.campsites/public.charging_stations
-- (Demo- + recherchierte Referenzdaten, siehe docs/data-sources.md) bleiben
-- unangetastet. Diese neuen Schemas sind eine zusaetzliche, echte
-- Datenquelle -- die Frage, ob/wie bestehende Detailseiten/Favoriten/
-- Bewertungen spaeter auf core.* umgestellt werden, ist bewusst noch NICHT
-- Teil dieser Migration.

create extension if not exists postgis;
create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

create schema if not exists raw;
create schema if not exists core;
create schema if not exists enrich;

-- ============ RAW ============

create table raw.import_run (
    id            bigserial primary key,
    source        text not null,          -- 'ocm' | 'osm'
    scope         text,                   -- 'IT' | 'bbox:...' | 'europe'
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    record_count  int,
    status        text not null default 'running',  -- running|ok|failed
    notes         text
);

create table raw.charge_point (
    source        text not null,
    source_id     text not null,
    import_run_id bigint references raw.import_run(id),
    payload       jsonb not null,         -- komplettes Quell-JSON aufheben
    lat           double precision,
    lon           double precision,
    fetched_at    timestamptz not null default now(),
    primary key (source, source_id)
);

create table raw.campsite (
    source        text not null,
    source_id     text not null,
    import_run_id bigint references raw.import_run(id),
    payload       jsonb not null,
    lat           double precision,
    lon           double precision,
    fetched_at    timestamptz not null default now(),
    primary key (source, source_id)
);

-- ============ CORE ============

create table core.charge_point (
    id             uuid primary key default uuid_generate_v4(),
    external_key   text not null unique,     -- 'ocm:12345'
    name           text,
    operator       text,
    network        text,
    geom           geography(Point, 4326) not null,
    address        text,
    postcode       text,
    city           text,
    country_code   char(2),
    access_type    text,                     -- public|restricted|private
    -- KEIN Live-Status: nur "laut Quelle betriebsbereit gemeldet"
    is_operational boolean default true,
    max_power_kw   numeric(6,2),             -- denormalisiert fuer Filter
    connector_count int,                     -- Summe aller Stecker
    source         text not null,
    source_updated_at timestamptz,           -- Stand laut Quelle
    last_seen_at   timestamptz not null default now(),
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);
create index idx_cp_geom    on core.charge_point using gist (geom);
create index idx_cp_power   on core.charge_point (max_power_kw);
create index idx_cp_country on core.charge_point (country_code);

create table core.connector (
    id              bigserial primary key,
    charge_point_id uuid not null references core.charge_point(id) on delete cascade,
    standard        text,        -- CCS2|Type2|CHAdeMO|Schuko|Type2_Socket|CEE
    power_kw        numeric(6,2),
    current_type    text,        -- AC|DC
    quantity        int not null default 1
);
create index idx_conn_cp  on core.connector (charge_point_id);
create index idx_conn_std on core.connector (standard);

create table core.campsite (
    id            uuid primary key default uuid_generate_v4(),
    external_key  text not null unique,      -- 'osm:way/123456'
    name          text not null,
    slug          text unique,
    geom          geography(Point, 4326) not null,
    boundary      geography(Polygon, 4326),  -- falls OSM-Flaeche vorhanden
    address       text,
    postcode      text,
    city          text,
    country_code  char(2),
    website       text,
    phone         text,
    email         text,
    capacity      int,
    source        text not null,
    last_seen_at  timestamptz not null default now(),
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index idx_cs_geom      on core.campsite using gist (geom);
create index idx_cs_boundary  on core.campsite using gist (boundary);
create index idx_cs_country   on core.campsite (country_code);
create index idx_cs_name_trgm on core.campsite using gin (name gin_trgm_ops);

-- Merkmalskatalog statt freier Tags. Sonst stehen in drei Monaten 'Pool',
-- 'pool', 'Schwimmbad' und 'swimming_pool' nebeneinander in der DB.
create table core.amenity (
    key        text primary key,
    category   text not null,      -- lage|wasser|familie|infra|stellplatz|laden|sonstig
    label_de   text not null,
    label_en   text,
    value_type text not null default 'bool'   -- bool|num|text
);

create table core.campsite_amenity (
    campsite_id uuid not null references core.campsite(id) on delete cascade,
    amenity_key text not null references core.amenity(key),
    value_bool  boolean,
    value_num   numeric,
    value_text  text,
    source      text not null,      -- Provenienz je einzelnem Merkmal
    confidence  smallint not null default 50,   -- 0..100
    updated_at  timestamptz not null default now(),
    primary key (campsite_id, amenity_key)
);
create index idx_ca_key on core.campsite_amenity (amenity_key)
    where value_bool is true;

-- Vorberechnete Verknuepfung Campingplatz <-> Ladepunkt
create table core.campsite_charge_link (
    campsite_id     uuid not null references core.campsite(id) on delete cascade,
    charge_point_id uuid not null references core.charge_point(id) on delete cascade,
    relation        text not null,   -- on_site|walking|nearby_drive
    air_distance_m  int not null,
    walk_distance_m int,             -- NULL = OSRM fand keine Fussroute
    walk_duration_s int,
    computed_at     timestamptz not null default now(),
    primary key (campsite_id, charge_point_id)
);
create index idx_link_cs  on core.campsite_charge_link (campsite_id, walk_distance_m);
create index idx_link_cp  on core.campsite_charge_link (charge_point_id);
create index idx_link_rel on core.campsite_charge_link (relation);

-- ============ ENRICH ============

create table enrich.app_user (
    id           uuid primary key default uuid_generate_v4(),
    display_name text,
    trust_level  smallint not null default 1,  -- 1=neu 3=verifiziert 5=Moderator
    created_at   timestamptz not null default now()
);

-- Anhaengertauglichkeit. Vierstufig, NICHT boolesch:
-- 'unhitch' (nur abgekuppelt erreichbar) ist der haeufigste reale Fall und
-- fuer die Nutzer eine voellig andere Information als 'no'.
-- 'unknown' unterscheidet "ungeeignet" von "noch nicht bewertet".
create table enrich.trailer_suitability (
    charge_point_key  text primary key,
    verdict           text not null
        check (verdict in ('yes','unhitch','no','unknown')),
    drive_through     boolean,
    pull_in_length_m  numeric(4,1),
    maneuvering_space text check (maneuvering_space in ('ample','tight','none')),
    notes             text,
    origin            text not null,  -- sascha_list|community|operator|staff|auto
    confirm_count     int not null default 0,
    dispute_count     int not null default 0,
    verified_at       timestamptz,
    verified_by       uuid references enrich.app_user(id),
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);
create index idx_ts_verdict on enrich.trailer_suitability (verdict);

create table enrich.trailer_report (
    id               bigserial primary key,
    charge_point_key text not null,
    user_id          uuid references enrich.app_user(id),
    verdict          text not null check (verdict in ('yes','unhitch','no')),
    drive_through    boolean,
    notes            text,
    photo_url        text,
    rig_length_m     numeric(4,1),
    status           text not null default 'pending'
        check (status in ('pending','approved','rejected')),
    created_at       timestamptz not null default now()
);
create index idx_tr_cp on enrich.trailer_report (charge_point_key, status);

-- Ladeinfrastruktur auf dem Campingplatz. Wird ueberwiegend durch eigene
-- Website-Recherche gefuellt.
create table enrich.campsite_charging (
    campsite_key     text primary key,
    has_charging     boolean not null default false,
    charging_type    text check (charging_type in
                        ('wallbox','schuko_only','dc_fast','cee','mixed')),
    max_power_kw     numeric(6,2),
    point_count      int,
    guests_only      boolean,
    pitch_charging   boolean,     -- Laden direkt am Stellplatz?
    booking_required boolean,
    price_note       text,
    origin           text not null,  -- website_research|operator|community|osm_derived
    evidence_url     text,           -- Beleg: welche Unterseite sagt das aus
    evidence_quote   text,           -- kurzes Zitat der Fundstelle
    checked_at       timestamptz,    -- wann zuletzt geprueft
    recheck_after    date,           -- Wiedervorlage
    verified_at      timestamptz,
    updated_at       timestamptz not null default now()
);
create index idx_ecc_recheck on enrich.campsite_charging (recheck_after)
    where recheck_after is not null;

-- Arbeitsliste fuer die Website-Recherche
create table enrich.research_task (
    campsite_key text primary key,
    status       text not null default 'open'
        check (status in ('open','in_progress','done','no_website','unreachable')),
    assigned_to  uuid references enrich.app_user(id),
    updated_at   timestamptz not null default now()
);
create index idx_rt_status on enrich.research_task (status);
