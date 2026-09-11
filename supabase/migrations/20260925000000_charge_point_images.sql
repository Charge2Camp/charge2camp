-- Bilder auf der Ladesaeulen-Detailseite (Auftrag "Ladesaeulen-Bilder").
-- Automatisch befuellt vom Fetcher (ingest/fetch_charge_point_images.py),
-- jederzeit neu erzeugbar -- deshalb in core, nicht in enrich. Manuelle
-- Eingriffe (Ausblenden/Umsortieren) gehoeren separat nach enrich und
-- werden vom Fetcher NIEMALS angefasst (siehe enrich.charge_point_image_override
-- unten und ingest/test_enrich_immutability.py-Muster).

create table core.charge_point_image (
    id              bigserial primary key,
    external_key    text not null,
    source          text not null check (source in ('wikimedia_commons', 'mapillary')),
    source_id       text not null,
    url_full        text not null,
    url_thumb       text not null,
    width           int,
    height          int,
    captured_at     timestamptz,
    distance_m      numeric(6, 1),
    bearing_delta   numeric(5, 1),
    license         text not null,
    license_url     text,
    attribution     text not null,
    confidence      smallint not null,
    sort_order      smallint not null default 0,
    fetched_at      timestamptz not null default now(),
    unique (external_key, source, source_id)
);

create index on core.charge_point_image (external_key, sort_order);

create table enrich.charge_point_image_override (
    external_key    text not null,
    source          text not null,
    source_id       text not null,
    hidden          boolean not null default false,
    sort_order      smallint,
    note            text,
    updated_at      timestamptz not null default now(),
    primary key (external_key, source, source_id)
);

-- Ausliefernde View, wendet den Override an -- die App liest ausschliesslich
-- hieraus (siehe /api/charge-points/[external_key]/images), nie direkt aus
-- core.charge_point_image.
create view core.v_charge_point_image as
select i.*
from core.charge_point_image i
left join enrich.charge_point_image_override o
  on  o.external_key = i.external_key
  and o.source       = i.source
  and o.source_id    = i.source_id
where coalesce(o.hidden, false) = false
order by coalesce(o.sort_order, i.sort_order), i.confidence desc, i.captured_at desc;

grant select on core.v_charge_point_image to anon, authenticated;
