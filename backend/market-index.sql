-- ============================================================
--  MARKET INDEX — monthly price development of property & land
--  Run once in the Supabase SQL editor, then schedule the jobs
--  at the bottom. Safe to re-run.
--
--  What it does
--   1. Logs every price event on a listing (listed / changed / sold)
--   2. Lets admins add manual market observations (off-platform deals)
--   3. Rolls both up into public.market_snapshots — one row per
--      month × segment × sale|rent, with median price, median price
--      per m², index (first month = 100), MoM and YoY change
--   4. market.html reads those snapshots. Admin-only via RLS.
-- ============================================================

-- ---------- 1 · sold price + date on listings ----------
alter table public.listings add column if not exists sold_price numeric(14,2);
alter table public.listings add column if not exists sold_at    timestamptz;
create index if not exists listings_sold_at_idx on public.listings(sold_at);
create index if not exists listings_created_idx on public.listings(created_at);

-- ---------- 2 · price event log ----------
create table if not exists public.listing_price_events (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings(id) on delete cascade,
  event       text not null,                      -- listed | change | sold
  old_price   numeric(14,2),
  new_price   numeric(14,2) not null,             -- USD, same as listings.price
  pct         numeric(6,2),                       -- % move vs old_price
  occurred_at timestamptz not null default now()
);
create index if not exists lpe_listing_idx on public.listing_price_events(listing_id, occurred_at desc);
create index if not exists lpe_when_idx    on public.listing_price_events(occurred_at desc);

-- Stamp sold_at / sold_price the moment a listing flips to sold or let.
create or replace function public.listings_sold_stamp()
returns trigger language plpgsql as $$
begin
  if new.status in ('sold','let') and old.status not in ('sold','let') then
    new.sold_at    := coalesce(new.sold_at, now());
    new.sold_price := coalesce(new.sold_price, new.price);
  end if;
  return new;
end $$;

drop trigger if exists trg_listings_sold_stamp on public.listings;
create trigger trg_listings_sold_stamp before update on public.listings
  for each row execute function public.listings_sold_stamp();

-- Log the event itself (after the row exists, so the FK holds).
create or replace function public.listings_price_event()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.status <> 'draft' and new.price > 0 then
      insert into public.listing_price_events(listing_id, event, new_price, occurred_at)
      values (new.id, 'listed', new.price, coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  if new.status in ('sold','let') and old.status not in ('sold','let') then
    insert into public.listing_price_events(listing_id, event, old_price, new_price, pct, occurred_at)
    values (new.id, 'sold', old.price, coalesce(new.sold_price, new.price),
            case when old.price > 0 then round((coalesce(new.sold_price,new.price)/old.price - 1) * 100, 2) end,
            coalesce(new.sold_at, now()));
  elsif old.status = 'draft' and new.status <> 'draft' and new.price > 0 then
    insert into public.listing_price_events(listing_id, event, new_price)
    values (new.id, 'listed', new.price);
  elsif new.price is distinct from old.price and old.price > 0 and new.price > 0 then
    insert into public.listing_price_events(listing_id, event, old_price, new_price, pct)
    values (new.id, 'change', old.price, new.price, round((new.price/old.price - 1) * 100, 2));
  end if;
  return new;
end $$;

drop trigger if exists trg_listings_price_event on public.listings;
create trigger trg_listings_price_event after insert or update on public.listings
  for each row execute function public.listings_price_event();

-- Backfill: every existing listing gets its opening price event.
insert into public.listing_price_events (listing_id, event, new_price, occurred_at)
select l.id, 'listed', l.price, l.created_at
from public.listings l
where l.price > 0 and l.status <> 'draft'
  and not exists (select 1 from public.listing_price_events e where e.listing_id = l.id);

-- ---------- 3 · manual market observations ----------
-- Deals the platform never saw: notary figures, agent reports, own research.
create table if not exists public.market_observations (
  id         uuid primary key default gen_random_uuid(),
  month      date not null,                       -- any day in the month
  area       text,                                -- "Kololi · Kombo South"
  category   listing_category not null default 'land',
  kind       listing_kind     not null default 'sale',
  price_usd  numeric(14,2) not null,
  sqm        integer,                             -- plot m² for land, built m² otherwise
  source     text,                                -- who/where it came from
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists market_obs_month_idx on public.market_observations(month desc);

-- ---------- 4 · monthly snapshots ----------
create table if not exists public.market_snapshots (
  month         date not null,                    -- first day of the month
  segment_type  text not null,                    -- market | area | region | category | landuse | area_land | area_built
  segment_key   text not null,                    -- 'All Gambia' | 'Kololi' | 'land' | …
  kind          listing_kind not null,            -- sale | rent
  n_listings    integer not null default 0,       -- on the market that month
  n_new         integer not null default 0,
  n_sold        integer not null default 0,
  n_reduced     integer not null default 0,       -- listings with a price cut that month
  median_price  numeric(14,2),                    -- USD
  median_ppsm   numeric(12,2),                    -- USD per m²
  avg_price     numeric(14,2),
  sample        integer not null default 0,       -- observations behind the median
  thin          boolean not null default false,   -- fewer than 5 that month → 3-month pool
  method        text not null default 'month',    -- month | 3m
  mom_pct       numeric(6,2),
  yoy_pct       numeric(6,2),
  index_100     numeric(8,1),                     -- first month of the segment = 100
  computed_at   timestamptz not null default now(),
  primary key (month, segment_type, segment_key, kind)
);
create index if not exists market_snap_seg_idx on public.market_snapshots(segment_type, segment_key, kind, month);

create table if not exists public.market_index_runs (
  id           uuid primary key default gen_random_uuid(),
  ran_at       timestamptz not null default now(),
  months       integer,
  rows_written integer
);

-- ---------- 5 · the rollup ----------
-- Everything that counted as market evidence in one month, listing by listing.
create or replace function public.market_pool(p_month date)
returns table (
  ref_id     uuid,
  kind       listing_kind,
  category   listing_category,
  area_key   text,
  region_key text,
  landuse    text,
  price      numeric,
  ref_sqm    numeric,
  is_new     boolean,
  is_sold    boolean,
  is_reduced boolean
) language sql stable set search_path = public as $$
  with b as (
    select date_trunc('month', p_month)::date                       as m_start,
           (date_trunc('month', p_month) + interval '1 month')::date as m_end
  ),
  l as (
    select li.*,
           coalesce((select e.new_price from public.listing_price_events e
                     where e.listing_id = li.id and e.occurred_at < b.m_end
                     order by e.occurred_at desc limit 1), li.price) as px
    from public.listings li, b
    where li.created_at < b.m_end
      and li.status not in ('draft','rejected','archived')
      and (li.sold_at is null or li.sold_at >= b.m_start)
  )
  select l.id, l.kind, l.category,
         nullif(btrim(split_part(l.area, '·', 1)), ''),
         nullif(btrim(split_part(l.area, '·', 2)), ''),
         case when l.category = 'land' then 'land' else 'built' end,
         l.px,
         nullif(case when l.category = 'land' then l.plot_sqm
                     else coalesce(nullif(l.sqm, 0), l.plot_sqm) end, 0)::numeric,
         (l.created_at >= b.m_start and l.created_at < b.m_end),
         (l.sold_at is not null and l.sold_at >= b.m_start and l.sold_at < b.m_end),
         exists (select 1 from public.listing_price_events e2
                 where e2.listing_id = l.id and e2.event = 'change' and e2.pct < 0
                   and e2.occurred_at >= b.m_start and e2.occurred_at < b.m_end)
  from l, b
  where l.px > 0
  union all
  select o.id, o.kind, o.category,
         nullif(btrim(split_part(o.area, '·', 1)), ''),
         nullif(btrim(split_part(o.area, '·', 2)), ''),
         case when o.category = 'land' then 'land' else 'built' end,
         o.price_usd, nullif(o.sqm, 0)::numeric,
         false, false, false
  from public.market_observations o, b
  where o.month >= b.m_start and o.month < b.m_end and o.price_usd > 0;
$$;

-- Build (or rebuild) one month. Thin segments fall back to a 3-month pool.
create or replace function public.market_build_month(p_month date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_m date := date_trunc('month', p_month)::date; v_rows integer;
begin
  delete from public.market_snapshots where month = v_m;

  insert into public.market_snapshots
    (month, segment_type, segment_key, kind, n_listings, n_new, n_sold, n_reduced,
     median_price, median_ppsm, avg_price, sample, thin, method)
  with cur as (select * from public.market_pool(v_m)),
  pool as (
    select * from public.market_pool(v_m)
    union all select * from public.market_pool((v_m - interval '1 month')::date)
    union all select * from public.market_pool((v_m - interval '2 months')::date)
  ),
  seg_cur as (
    select s.t as segment_type, s.k as segment_key, c.*
    from cur c cross join lateral (values
      ('market','All Gambia'), ('area', c.area_key), ('region', c.region_key),
      ('category', c.category::text), ('landuse', c.landuse),
      ('area_land',  case when c.landuse = 'land'  then c.area_key end),
      ('area_built', case when c.landuse = 'built' then c.area_key end)) as s(t, k)
    where s.k is not null
  ),
  seg_pool as (
    select s.t as segment_type, s.k as segment_key, p.*
    from pool p cross join lateral (values
      ('market','All Gambia'), ('area', p.area_key), ('region', p.region_key),
      ('category', p.category::text), ('landuse', p.landuse),
      ('area_land',  case when p.landuse = 'land'  then p.area_key end),
      ('area_built', case when p.landuse = 'built' then p.area_key end)) as s(t, k)
    where s.k is not null
  ),
  agg_cur as (
    select segment_type, segment_key, kind,
           count(*)::int                                     as n,
           count(*) filter (where is_new)::int                as n_new,
           count(*) filter (where is_sold)::int               as n_sold,
           count(*) filter (where is_reduced)::int            as n_red,
           percentile_cont(0.5) within group (order by price) as med,
           percentile_cont(0.5) within group (order by price / ref_sqm)
             filter (where ref_sqm is not null and ref_sqm > 0) as ppsm,
           round(avg(price), 2)                               as avgp
    from seg_cur group by 1, 2, 3
  ),
  agg_pool as (
    select segment_type, segment_key, kind,
           count(*)::int                                     as pn,
           percentile_cont(0.5) within group (order by price) as pmed,
           percentile_cont(0.5) within group (order by price / ref_sqm)
             filter (where ref_sqm is not null and ref_sqm > 0) as pppsm
    from seg_pool group by 1, 2, 3
  )
  select v_m, a.segment_type, a.segment_key, a.kind, a.n, a.n_new, a.n_sold, a.n_red,
         round(case when a.n >= 5 then a.med  else coalesce(p.pmed,  a.med)  end, 2),
         round(case when a.n >= 5 then a.ppsm else coalesce(p.pppsm, a.ppsm) end, 2),
         a.avgp,
         case when a.n >= 5 then a.n else coalesce(p.pn, a.n) end,
         (a.n < 5),
         case when a.n >= 5 then 'month' else '3m' end
  from agg_cur a
  left join agg_pool p
    on p.segment_type = a.segment_type and p.segment_key = a.segment_key and p.kind = a.kind;

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

-- Index, month-on-month and year-on-year across the whole table.
-- Computed on price per m² wherever we have it: a median price alone moves
-- with whatever happened to be on the market that month (one extra villa
-- lifts a whole area), price per m² does not.
create or replace function public.market_recompute_derived()
returns void language sql security definer set search_path = public as $$
  with first_month as (
    select segment_type, segment_key, kind, min(month) as m0
    from public.market_snapshots group by 1, 2, 3
  ),
  calc as (
    -- Compare like with like. A month without floor areas has no ppsm, and
    -- coalescing to the absolute price turned that switch into a 99,000%
    -- "rise" — which overflowed mom_pct numeric(6,2) and aborted the whole
    -- nightly job (17 Aug 2026). Each ratio now uses one basis for both
    -- months, or stays null.
    select s.month, s.segment_type, s.segment_key, s.kind,
           case
             when s.median_ppsm  is not null and pm.median_ppsm  > 0 then s.median_ppsm  / pm.median_ppsm
             when s.median_price is not null and pm.median_price > 0 then s.median_price / pm.median_price
           end as r_mom,
           case
             when s.median_ppsm  is not null and py.median_ppsm  > 0 then s.median_ppsm  / py.median_ppsm
             when s.median_price is not null and py.median_price > 0 then s.median_price / py.median_price
           end as r_yoy,
           case
             when s.median_ppsm  is not null and b.median_ppsm  > 0 then s.median_ppsm  / b.median_ppsm
             when s.median_price is not null and b.median_price > 0 then s.median_price / b.median_price
           end as r_base
    from public.market_snapshots s
    left join public.market_snapshots pm
      on pm.segment_type = s.segment_type and pm.segment_key = s.segment_key
     and pm.kind = s.kind and pm.month = (s.month - interval '1 month')::date
    left join public.market_snapshots py
      on py.segment_type = s.segment_type and py.segment_key = s.segment_key
     and py.kind = s.kind and py.month = (s.month - interval '12 months')::date
    left join first_month f
      on f.segment_type = s.segment_type and f.segment_key = s.segment_key and f.kind = s.kind
    left join public.market_snapshots b
      on b.segment_type = s.segment_type and b.segment_key = s.segment_key
     and b.kind = s.kind and b.month = f.m0
  )
  update public.market_snapshots s set
    mom_pct   = case when c.r_mom  between 0.01 and 100 then round((c.r_mom - 1) * 100, 2) end,
    yoy_pct   = case when c.r_yoy  between 0.01 and 100 then round((c.r_yoy - 1) * 100, 2) end,
    index_100 = case when c.r_base between 0.0001 and 10000 then round(c.r_base * 100, 1) end
  from calc c
  where c.month = s.month and c.segment_type = s.segment_type
    and c.segment_key = s.segment_key and c.kind = s.kind;

  -- The whole-market line is a sample-weighted composite of the land and built
  -- indices; a plain median across both would just track the month's mix.
  with w as (
    select month, kind, sum(index_100 * sample) / nullif(sum(sample), 0) as idx
    from public.market_snapshots
    where segment_type = 'landuse' and index_100 is not null
    group by 1, 2
  ),
  comp as (
    select w.month, w.kind, w.idx,
           (select p.idx from w p  where p.kind  = w.kind and p.month  = (w.month - interval '1 month')::date)   as prev_m,
           (select p2.idx from w p2 where p2.kind = w.kind and p2.month = (w.month - interval '12 months')::date) as prev_y
    from w
  )
  update public.market_snapshots m set
    index_100 = round(c.idx, 1),
    mom_pct   = case when c.prev_m > 0 and c.idx / c.prev_m between 0.01 and 100 then round((c.idx / c.prev_m - 1) * 100, 2) end,
    yoy_pct   = case when c.prev_y > 0 and c.idx / c.prev_y between 0.01 and 100 then round((c.idx / c.prev_y - 1) * 100, 2) end
  from comp c
  where m.segment_type = 'market' and m.month = c.month and m.kind = c.kind;
$$;

-- What the "Recalculate" button in market.html calls.
create or replace function public.rebuild_market_index(p_months integer default 24)
returns table (months_built integer, rows_written integer)
language plpgsql security definer set search_path = public as $$
declare i integer; v_rows integer := 0; v_n integer := greatest(coalesce(p_months, 24), 1);
begin
  if auth.uid() is not null and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  then raise exception 'admin only'; end if;

  for i in reverse v_n - 1 .. 0 loop
    v_rows := v_rows + public.market_build_month(
      (date_trunc('month', now()) - make_interval(months => i))::date);
  end loop;

  perform public.market_recompute_derived();
  insert into public.market_index_runs(months, rows_written) values (v_n, v_rows);
  return query select v_n, v_rows;
end $$;

revoke execute on function public.rebuild_market_index(integer) from anon;
grant   execute on function public.rebuild_market_index(integer) to authenticated, service_role;

-- ---------- 6 · security: backoffice only ----------
alter table public.listing_price_events enable row level security;
alter table public.market_observations  enable row level security;
alter table public.market_snapshots     enable row level security;
alter table public.market_index_runs    enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

drop policy if exists "price events admin read" on public.listing_price_events;
create policy "price events admin read" on public.listing_price_events for select using (public.is_admin());

drop policy if exists "observations admin read" on public.market_observations;
create policy "observations admin read" on public.market_observations for select using (public.is_admin());
drop policy if exists "observations admin write" on public.market_observations;
create policy "observations admin write" on public.market_observations for insert with check (public.is_admin());
drop policy if exists "observations admin edit" on public.market_observations;
create policy "observations admin edit" on public.market_observations for update using (public.is_admin());
drop policy if exists "observations admin delete" on public.market_observations;
create policy "observations admin delete" on public.market_observations for delete using (public.is_admin());

-- Snapshots stay private for now. To publish a market page later, swap this
-- policy for `using (true)` — the table holds no personal data.
drop policy if exists "snapshots admin read" on public.market_snapshots;
create policy "snapshots admin read" on public.market_snapshots for select using (public.is_admin());

drop policy if exists "runs admin read" on public.market_index_runs;
create policy "runs admin read" on public.market_index_runs for select using (public.is_admin());

-- ---------- 7 · first build (24 months back from today) ----------
select public.rebuild_market_index(24);

-- ---------- 8 · schedules (requires pg_cron) ----------
-- Monthly close: the 1st at 02:15, finalises the month that just ended.
-- select cron.schedule('market-index-monthly', '15 2 1 * *', $$
--   select public.market_build_month((date_trunc('month', now()) - interval '1 day')::date);
--   select public.market_recompute_derived();
-- $$);
--
-- Running month, refreshed nightly so the console is never stale:
-- Live job (name: market-index-nightly). The advisory lock keeps two runs
-- from colliding, and the run is logged in market_index_runs — the freshness
-- badge on market.html reads that table, so a job that does not log looks
-- stale even when it succeeded.
-- select cron.schedule('market-index-nightly', '45 2 * * *', $j$
--   do $lock$
--   declare v_rows integer;
--   begin
--     perform pg_advisory_xact_lock(4711001);
--     perform public.market_dedup();
--     v_rows := public.market_build_month(current_date);
--     perform public.market_recompute_derived();
--     perform public.market_recompute_real();
--     insert into public.market_index_runs(months, rows_written) values (1, v_rows);
--   end
--   $lock$;
-- $j$);
