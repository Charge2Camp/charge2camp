-- Admin-Backend: Ladestationen sinnvoll filtern/sortieren koennen
-- (Land, Anbieter, geprueft/ungeprueft, Ladeleistung). Ein RPC statt
-- Client-seitigem Filtern, weil core.charge_point und enrich.trailer_suitability
-- bewusst nicht per FK verknuepft sind (siehe core/enrich-Trennung) und die
-- Liste serverseitig paginiert werden muss.

create or replace function core.charge_point_admin_list(
    p_q text default null,
    p_country_code text default null,
    p_operator text default null,
    p_verdict text default null, -- 'checked' | 'unchecked' | null (alle)
    p_min_power_kw numeric default null,
    p_sort text default 'name_asc',
    p_limit int default 30,
    p_offset int default 0
)
returns table (
    id uuid,
    external_key text,
    name text,
    operator text,
    city text,
    country_code text,
    max_power_kw numeric,
    is_operational boolean,
    is_active boolean,
    verdict text,
    total_count bigint
)
language plpgsql
security definer
set search_path = core, enrich, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select
        cp.id,
        cp.external_key,
        cp.name,
        cp.operator,
        cp.city,
        cp.country_code::text,
        cp.max_power_kw,
        cp.is_operational,
        cp.is_active,
        coalesce(ts.verdict, 'unknown') as verdict,
        count(*) over () as total_count
    from core.charge_point cp
    left join enrich.trailer_suitability ts on ts.charge_point_key = cp.external_key
    where (p_q is null or cp.name ilike '%' || p_q || '%' or cp.operator ilike '%' || p_q || '%')
      and (p_country_code is null or cp.country_code::text = p_country_code)
      and (p_operator is null or cp.operator = p_operator)
      and (p_min_power_kw is null or cp.max_power_kw >= p_min_power_kw)
      and (
        p_verdict is null
        or (p_verdict = 'checked' and coalesce(ts.verdict, 'unknown') <> 'unknown')
        or (p_verdict = 'unchecked' and coalesce(ts.verdict, 'unknown') = 'unknown')
      )
    order by
        case when p_sort = 'name_asc' then cp.name end asc nulls last,
        case when p_sort = 'name_desc' then cp.name end desc nulls last,
        case when p_sort = 'power_desc' then cp.max_power_kw end desc nulls last,
        case when p_sort = 'power_asc' then cp.max_power_kw end asc nulls last,
        case when p_sort = 'country_asc' then cp.country_code end asc nulls last,
        case when p_sort = 'last_seen_desc' then cp.last_seen_at end desc nulls last,
        cp.name asc nulls last
    limit p_limit offset p_offset;
end;
$$;

-- Optionen fuer die Filter-Dropdowns (Land/Anbieter), damit dort keine
-- Freitext-Tippfehler zu leeren Ergebnissen fuehren.
create or replace function core.charge_point_filter_options()
returns table (
    countries text[],
    operators text[]
)
language plpgsql
security definer
set search_path = core, public
as $$
begin
    if auth.role() <> 'service_role'
       and not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
        raise exception 'Kein Admin-Zugriff.';
    end if;

    return query
    select
        (select array_agg(distinct country_code::text order by country_code::text) from core.charge_point where country_code is not null),
        (select array_agg(distinct operator order by operator) from core.charge_point where operator is not null);
end;
$$;
