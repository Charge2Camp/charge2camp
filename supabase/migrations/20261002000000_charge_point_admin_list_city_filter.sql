-- Nutzerwunsch: Ladestationen-Liste im Admin-Bereich zusaetzlich nach Stadt
-- filtern koennen (z.B. um alle Stationen in "Muenchen" fuer eine
-- Massenkorrektur zu finden, ohne sie ueber Name/Betreiber suchen zu
-- muessen -- siehe bulkUpdateChargePoints in
-- admin/.../ladestationen/actions.ts). Freitext-ILIKE statt Dropdown, da
-- core.charge_point.city zu viele unterschiedliche Werte hat, um sinnvoll
-- als feste Optionsliste angeboten zu werden (anders als Land/Anbieter in
-- core.charge_point_filter_options()).
create or replace function core.charge_point_admin_list(
    p_q text default null,
    p_country_code text default null,
    p_operator text default null,
    p_verdict text default null, -- 'checked' | 'unchecked' | null (alle)
    p_min_power_kw numeric default null,
    p_sort text default 'name_asc',
    p_limit int default 30,
    p_offset int default 0,
    p_city text default null
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
      and (p_city is null or cp.city ilike '%' || p_city || '%')
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
