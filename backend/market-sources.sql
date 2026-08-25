-- ============================================================
--  MARKET SOURCES — broadening the index beyond mykunda.com
--  Run AFTER backend/market-index.sql, once, in the Supabase SQL
--  editor. Safe to re-run.
--
--  What it adds
--   1. A source registry: every place evidence comes from, with a
--      trust weight between 0 and 1 that decides how much its
--      prices move the index.
--   2. external_listings — normalised rows harvested from other
--      portals, agent lists, registry deals.
--   3. Area aliases, so "Kerr Serigne" and "kerr serign" land in
--      the same segment as our own listings.
--   4. Fingerprint de-duplication: the same villa on four portals
--      counts once, at the trust of the best source that has it.
--   5. market_macro — CPI, policy rate, FX, cement — which gives
--      the console a real (inflation-adjusted) index.
--   6. A rewritten rollup that takes a WEIGHTED median, so a
--      scraped aggregator can add coverage without being able to
--      drag the index around.
--   7. A fetch log, so a broken scraper is visible instead of
--      silently thinning the data.
-- ============================================================

-- ---------- 1 · source registry ----------
create table if not exists public.market_sources (
  key         text primary key,                    -- 'gamrealty'
  name        text not null,
  host        text,
  url         text,
  kind        text not null default 'portal',      -- own | portal | aggregator | agent | registry | official | costs
  trust       numeric(3,2) not null default 0.60,  -- 0..1 weight in the index
  active      boolean not null default true,
  in_index    boolean not null default true,       -- false = context only, never priced in
  cadence     text not null default 'daily',       -- daily | weekly | monthly | manual
  adapter     text not null default 'html',        -- html | json | cbg | gbos | manual
  parse       jsonb not null default '{}'::jsonb,  -- selectors / config for the adapter
  robots_ok   boolean,
  tos_note    text,
  last_ok_at  timestamptz,
  last_error  text,
  sort        integer not null default 100,
  created_at  timestamptz not null default now()
);

-- Trust weights, stated plainly so they can be argued with:
--   1.00  a closed deal we witnessed ourselves
--   0.95  a notary / registry figure
--   0.90  our own live asking price
--   0.85  an agent's own list, sent to us directly
--   0.65  a specialist Gambian portal — real stock, asking prices
--   0.40  an international aggregator — stale and thin, but wide
insert into public.market_sources (key, name, host, url, kind, trust, adapter, cadence, sort, tos_note, parse) values
  ('mykunda',      'MyKunda listings',        'mykunda.com',              null, 'own',        0.90, 'manual', 'daily',  10, 'Own platform.', '{}'),
  ('mykunda_sold', 'MyKunda closed deals',    'mykunda.com',              null, 'own',        1.00, 'manual', 'daily',  11, 'Own platform.', '{}'),
  ('observation',  'Manual observations',     null,                       null, 'registry',   0.95, 'manual', 'manual', 12, 'Entered by an admin in the console.', '{}'),
  ('registry',     'Notary & land registry',  null,                       null, 'registry',   0.95, 'manual', 'manual', 13, 'Entered by hand from transfer documents.', '{}'),
  ('agent_csv',    'Agent lists (CSV/email)', null,                       null, 'agent',      0.85, 'manual', 'monthly',14, 'Supplied to us directly by the agency.', '{}'),
  ('gamrealty',    'GamRealty',               'gamrealty.com',            'https://gamrealty.com/properties/', 'portal', 0.65, 'html', 'daily', 20,
     'Public listing pages. Internal benchmarking only, robots.txt checked before every run.',
     '{"pages":4,"item":"<article[\\\\s\\\\S]{0,80}?class=\\"[^\\"]*property[^\\"]*\\"[\\\\s\\\\S]*?</article>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[23][^>]*>([\\\\s\\\\S]*?)</h[23]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm|square met)","beds":"([0-9]+)\\\\s?bed"}}'),
  ('propertyshop', 'Gambia Property Shop',    'gambiapropertyshop.com',   'https://gambiapropertyshop.com/property-search/', 'portal', 0.65, 'html', 'daily', 21,
     'Public listing pages. Internal benchmarking only.',
     '{"pages":4,"item":"<article[\\\\s\\\\S]*?</article>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[23][^>]*>([\\\\s\\\\S]*?)</h[23]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm)","beds":"([0-9]+)\\\\s?bed"}}'),
  ('gambiarealestate','Gambia Real Estate',   'gambiarealestate.gm',      'https://gambiarealestate.gm/properties/', 'portal', 0.60, 'html', 'daily', 22,
     'Agency directory. Listings repeat across member agencies — de-duplication matters here.',
     '{"pages":4,"item":"<article[\\\\s\\\\S]*?</article>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[23][^>]*>([\\\\s\\\\S]*?)</h[23]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm)"}}'),
  ('schumann',     'Schumann Real Estate',    'propertygambiaestate.com', 'https://propertygambiaestate.com/', 'portal', 0.60, 'html', 'weekly', 23,
     'Single agency site.',
     '{"pages":2,"item":"<div[^>]*class=\\"[^\\"]*(?:property|listing|card)[^\\"]*\\"[\\\\s\\\\S]*?</div>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[234][^>]*>([\\\\s\\\\S]*?)</h[234]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm)"}}'),
  ('realigro',     'Realigro (aggregator)',   'gambia.realigro.com',      'https://gambia.realigro.com/for-sale/property/', 'aggregator', 0.40, 'html', 'weekly', 30,
     'International aggregator: wide but stale, and prices are often years old. Low weight on purpose.',
     '{"pages":3,"item":"<div[^>]*class=\\"[^\\"]*(?:annuncio|listing|result)[^\\"]*\\"[\\\\s\\\\S]*?</div>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[234][^>]*>([\\\\s\\\\S]*?)</h[234]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm)"}}'),
  ('holprop',      'Holprop (aggregator)',    'www.holprop.com',          'https://www.holprop.com/sale/property/gambia/', 'aggregator', 0.40, 'html', 'weekly', 31,
     'International aggregator. Same caveat as Realigro.',
     '{"pages":3,"item":"<div[^>]*class=\\"[^\\"]*(?:property|listing|item)[^\\"]*\\"[\\\\s\\\\S]*?</div>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","title":"<h[234][^>]*>([\\\\s\\\\S]*?)</h[234]>","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})","sqm":"([0-9][0-9.,]*)\\\\s?(?:m2|m²|sqm)"}}'),
  ('accessgambia', 'AccessGambia Property',   'www.accessgambia.com',     'https://www.accessgambia.com/real-estate.html', 'aggregator', 0.35, 'html', 'weekly', 32,
     'Directory page — thin, mostly agent contacts. Kept for coverage of areas nobody else lists.',
     '{"pages":1,"item":"<tr[\\\\s\\\\S]*?</tr>","fields":{"url":"href=\\"(https?://[^\\"]+)\\"","price":"(D|GMD|\\\\$|USD|€|EUR|£|GBP)\\\\s?([0-9][0-9.,]{2,})"}}'),
  ('gbos',         'GBoS — CPI & inflation',  'www.gbos.gov.gm',          'https://www.gbos.gov.gm/cpi.php', 'official', 0.00, 'gbos', 'monthly', 40,
     'Official national statistics. Context and deflator only — never priced into the index.', '{}'),
  ('cbg',          'Central Bank of Gambia',  'www.cbg.gm',               'https://www.cbg.gm/', 'official', 0.00, 'cbg', 'daily', 41,
     'Official rates. Context and currency conversion only.', '{}'),
  ('costs',        'Building materials',      null,                       null, 'costs', 0.00, 'manual', 'monthly', 42,
     'Cement and block prices, entered by hand — no reliable public feed exists.', '{}')
on conflict (key) do nothing;

-- Official series and cost inputs are context, never price evidence.
update public.market_sources set in_index = false, trust = 0
 where kind in ('official','costs');

-- ---------- 2 · area aliases ----------
-- Free text from another portal ("Kerr Serigne, Kombo North") has to
-- land in the same bucket as our own "Kerr Serign · Kombo North".
create table if not exists public.market_area_alias (
  alias  text primary key,              -- lowercase, matched as a substring
  area   text not null,
  region text not null
);

insert into public.market_area_alias (alias, area, region) values
  ('kololi','Kololi','Kombo South'), ('senegambia','Kololi','Kombo South'),
  ('bijilo','Bijilo','Kombo South'), ('brufut','Brufut','Kombo South'),
  ('batokunku','Brufut','Kombo South'), ('tanji','Tanji','South Coast'),
  ('sanyang','Sanyang','South Coast'), ('kartong','Kartong','South Coast'),
  ('gunjur','Gunjur','South Coast'), ('tujereng','Tujereng','South Coast'),
  ('brusubi','Brusubi','Kombo North'), ('kerr serign','Kerr Serign','Kombo North'),
  ('kerr serigne','Kerr Serign','Kombo North'), ('kerr sering','Kerr Serign','Kombo North'),
  ('sukuta','Sukuta','Kombo North'), ('jabang','Jabang','Kombo North'),
  ('salagi','Salagi','Kombo North'), ('lamin','Lamin','Kombo North'),
  ('brikama','Brikama','Kombo Central'), ('farato','Farato','Kombo Central'),
  ('cape point','Cape Point','Greater Banjul'), ('bakau','Bakau','Greater Banjul'),
  ('fajara','Fajara','Greater Banjul'), ('kotu','Kotu','Greater Banjul'),
  ('serrekunda','Serrekunda','Greater Banjul'), ('serekunda','Serrekunda','Greater Banjul'),
  ('manjai','Serrekunda','Greater Banjul'), ('jeshwang','Serrekunda','Greater Banjul'),
  ('banjul','Banjul','Greater Banjul'), ('barra','Barra','North Bank'),
  ('farafenni','Farafenni','North Bank'), ('soma','Soma','Lower River')
on conflict (alias) do nothing;

-- Longest matching alias wins: "kerr serign" beats a stray "serign".
create or replace function public.market_norm_area(p text)
returns table (area text, region text) language sql stable set search_path = public as $$
  select a.area, a.region
  from public.market_area_alias a
  where p is not null and position(a.alias in lower(p)) > 0
  order by length(a.alias) desc
  limit 1;
$$;

-- ---------- 3 · harvested listings ----------
create table if not exists public.external_listings (
  id          uuid primary key default gen_random_uuid(),
  source_key  text not null references public.market_sources(key) on delete cascade,
  external_id text not null,                       -- stable id or url hash at the source
  url         text,
  title       text,
  kind        listing_kind     not null default 'sale',
  category    listing_category not null default 'land',
  area        text,
  region      text,
  price_usd   numeric(14,2),
  price_raw   text,
  currency    text,
  sqm         integer,
  beds        smallint,
  first_seen  date not null default current_date,
  last_seen   date not null default current_date,
  delisted_at date,
  confidence  numeric(3,2) not null default 0.5,   -- how sure the parser is
  fingerprint text,
  status      text not null default 'active',      -- active | delisted | duplicate | rejected
  dupe_note   text,
  raw         jsonb,
  created_at  timestamptz not null default now(),
  unique (source_key, external_id)
);
create index if not exists ext_src_idx    on public.external_listings(source_key, status);
create index if not exists ext_seen_idx   on public.external_listings(last_seen desc);
create index if not exists ext_fp_idx     on public.external_listings(fingerprint);
create index if not exists ext_first_idx  on public.external_listings(first_seen);

-- ---------- 4 · fetch log ----------
create table if not exists public.source_fetch_runs (
  id             uuid primary key default gen_random_uuid(),
  source_key     text references public.market_sources(key) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  ok             boolean,
  http_status    integer,
  items_seen     integer default 0,
  items_new      integer default 0,
  items_updated  integer default 0,
  items_rejected integer default 0,
  error          text,
  sample         jsonb                              -- a rejected block, for tuning selectors
);
create index if not exists sfr_when_idx on public.source_fetch_runs(started_at desc);
create index if not exists sfr_src_idx  on public.source_fetch_runs(source_key, started_at desc);

-- ---------- 5 · macro series ----------
create table if not exists public.market_macro (
  month      date not null,
  series     text not null,                        -- cpi_all | cpi_housing | policy_rate | tbill_91 | eur_gmd | usd_gmd | cement_50kg
  value      numeric(14,4) not null,
  unit       text,
  source     text,
  source_url text,
  fetched_at timestamptz not null default now(),
  primary key (month, series)
);

-- ---------- 6 · de-duplication ----------
-- Same market, same type, same area, size within 25 m², price within
-- about 5%: one property, however many portals carry it.
create or replace function public.market_fingerprint(
  p_kind text, p_cat text, p_area text, p_sqm numeric, p_price numeric)
returns text language sql immutable as $$
  select coalesce(p_kind,'?') || '|' || coalesce(p_cat,'?') || '|' ||
         coalesce(lower(p_area),'?') || '|' ||
         coalesce(round(p_sqm / 25.0)::text, '?') || '|' ||
         case when p_price is null or p_price <= 0 then '?'
              else round(ln(p_price) / 0.05)::text end;
$$;

create or replace function public.external_fingerprint()
returns trigger language plpgsql as $$
begin
  new.fingerprint := public.market_fingerprint(
    new.kind::text, new.category::text, new.area, new.sqm, new.price_usd);
  return new;
end $$;

drop trigger if exists trg_external_fingerprint on public.external_listings;
create trigger trg_external_fingerprint before insert or update on public.external_listings
  for each row execute function public.external_fingerprint();

-- Keep the copy from the most trusted source; the rest become duplicates.
-- Anything that also matches one of our own live listings loses outright.
create or replace function public.market_dedup()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer;
begin
  update public.external_listings e
     set status = case when e.delisted_at is not null then 'delisted' else 'active' end,
         dupe_note = null
   where e.status = 'duplicate';

  with own as (
    select distinct public.market_fingerprint(
             l.kind::text, l.category::text,
             nullif(btrim(split_part(l.area, '·', 1)), ''),
             nullif(case when l.category = 'land' then l.plot_sqm
                         else coalesce(nullif(l.sqm,0), l.plot_sqm) end, 0)::numeric,
             l.price) as fp
    from public.listings l
    where l.status not in ('draft','rejected','archived') and l.price > 0
  )
  update public.external_listings e
     set status = 'duplicate', dupe_note = 'Also on MyKunda'
   from own
  where e.status = 'active' and e.fingerprint = own.fp;

  with ranked as (
    select e.id,
           row_number() over (
             partition by e.fingerprint
             order by s.trust desc, e.confidence desc, e.first_seen asc, e.id
           ) as rn,
           first_value(s.name) over (
             partition by e.fingerprint
             order by s.trust desc, e.confidence desc, e.first_seen asc, e.id
           ) as winner
    from public.external_listings e
    join public.market_sources s on s.key = e.source_key
    where e.status = 'active' and e.fingerprint is not null
  )
  update public.external_listings e
     set status = 'duplicate', dupe_note = 'Also on ' || r.winner
   from ranked r
  where e.id = r.id and r.rn > 1;

  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- 7 · weighted median ----------
-- percentile_cont() has no weights, and this index needs them: a
-- €-priced aggregator row should not count the same as a notary figure.
create or replace function public.wmedian(vals numeric[], wts numeric[])
returns numeric language sql immutable as $$
  with p as (
    select v, greatest(coalesce(w, 0.01), 0.01) as w
    from unnest(vals, wts) as t(v, w)
    where v is not null and v > 0
  ),
  tot as (select sum(w) as s from p),
  c as (
    select v, sum(w) over (order by v rows between unbounded preceding and current row) as cum,
           (select s from tot) as s
    from p
  )
  select coalesce((select v from c where cum >= s / 2 order by v limit 1),
                  (select v from c order by v limit 1));
$$;

-- ---------- 8 · the pool, now with every source in it ----------
drop function if exists public.market_pool(date);
create or replace function public.market_pool(p_month date)
returns table (
  ref_id     uuid,
  source_key text,
  weight     numeric,
  kind       listing_kind,
  category   listing_category,
  area_key   text,
  region_key text,
  landuse    text,
  price      numeric,
  ref_sqm    numeric,
  is_new     boolean,
  is_sold    boolean,
  is_reduced boolean,
  is_external boolean
) language sql stable set search_path = public as $$
  with b as (
    select date_trunc('month', p_month)::date                        as m_start,
           (date_trunc('month', p_month) + interval '1 month')::date as m_end
  ),
  w as (
    select key, case when in_index and active then trust else 0 end as trust
    from public.market_sources
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
  -- our own listings; a closed deal in this month carries full weight
  select l.id,
         case when l.sold_at is not null and l.sold_at >= b.m_start and l.sold_at < b.m_end
              then 'mykunda_sold' else 'mykunda' end,
         coalesce((select trust from w where key = case when l.sold_at is not null
                    and l.sold_at >= b.m_start and l.sold_at < b.m_end
                    then 'mykunda_sold' else 'mykunda' end), 0.9),
         l.kind, l.category,
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
                   and e2.occurred_at >= b.m_start and e2.occurred_at < b.m_end),
         false
  from l, b
  where l.px > 0

  union all

  -- manual observations: notary figures, agent reports, own research
  select o.id, 'observation',
         coalesce((select trust from w where key = 'observation'), 0.95),
         o.kind, o.category,
         nullif(btrim(split_part(o.area, '·', 1)), ''),
         nullif(btrim(split_part(o.area, '·', 2)), ''),
         case when o.category = 'land' then 'land' else 'built' end,
         o.price_usd, nullif(o.sqm, 0)::numeric,
         false, false, false, false
  from public.market_observations o, b
  where o.month >= b.m_start and o.month < b.m_end and o.price_usd > 0

  union all

  -- everything harvested elsewhere, de-duplicated, weighted by source
  select e.id, e.source_key,
         coalesce(w.trust, 0) * e.confidence,
         e.kind, e.category, e.area, e.region,
         case when e.category = 'land' then 'land' else 'built' end,
         e.price_usd, nullif(e.sqm, 0)::numeric,
         (e.first_seen >= b.m_start and e.first_seen < b.m_end),
         false,
         false,
         true
  from public.external_listings e
  join w on w.key = e.source_key, b
  where e.status = 'active'
    and w.trust > 0
    and e.price_usd > 0
    and e.first_seen < b.m_end
    and (e.delisted_at is null or e.delisted_at >= b.m_start);
$$;

-- ---------- 9 · the rollup, weighted ----------
create or replace function public.market_build_month(p_month date)
returns integer language plpgsql security definer set search_path = public as $$
declare v_m date := date_trunc('month', p_month)::date; v_rows integer;
begin
  delete from public.market_snapshots where month = v_m;

  insert into public.market_snapshots
    (month, segment_type, segment_key, kind, n_listings, n_new, n_sold, n_reduced,
     median_price, median_ppsm, avg_price, sample, thin, method, n_external, n_sources, sources)
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
           count(*)::int                                      as n,
           count(*) filter (where is_new)::int                 as n_new,
           count(*) filter (where is_sold)::int                as n_sold,
           count(*) filter (where is_reduced)::int             as n_red,
           count(*) filter (where is_external)::int            as n_ext,
           count(distinct source_key)::int                     as n_src,
           public.wmedian(array_agg(price order by price),
                          array_agg(weight order by price))    as med,
           public.wmedian(array_agg(price / ref_sqm order by price / ref_sqm)
                            filter (where ref_sqm > 0),
                          array_agg(weight order by price / ref_sqm)
                            filter (where ref_sqm > 0))        as ppsm,
           round(avg(price), 2)                                as avgp,
           jsonb_object_agg(source_key, cnt)                   as src_mix
    from (
      select *, count(*) over (partition by segment_type, segment_key, kind, source_key) as cnt
      from seg_cur
    ) x
    group by 1, 2, 3
  ),
  agg_pool as (
    select segment_type, segment_key, kind,
           count(*)::int                                       as pn,
           public.wmedian(array_agg(price order by price),
                          array_agg(weight order by price))     as pmed,
           public.wmedian(array_agg(price / ref_sqm order by price / ref_sqm)
                            filter (where ref_sqm > 0),
                          array_agg(weight order by price / ref_sqm)
                            filter (where ref_sqm > 0))         as pppsm
    from seg_pool group by 1, 2, 3
  )
  select v_m, a.segment_type, a.segment_key, a.kind, a.n, a.n_new, a.n_sold, a.n_red,
         round(case when a.n >= 5 then a.med  else coalesce(p.pmed,  a.med)  end, 2),
         round(case when a.n >= 5 then a.ppsm else coalesce(p.pppsm, a.ppsm) end, 2),
         a.avgp,
         case when a.n >= 5 then a.n else coalesce(p.pn, a.n) end,
         (a.n < 5),
         case when a.n >= 5 then 'month' else '3m' end,
         a.n_ext, a.n_src, a.src_mix
  from agg_cur a
  left join agg_pool p
    on p.segment_type = a.segment_type and p.segment_key = a.segment_key and p.kind = a.kind;

  get diagnostics v_rows = row_count;
  return v_rows;
end $$;

-- ---------- 10 · real (inflation-adjusted) index ----------
-- Nominal prices in a country running 6%+ inflation flatter the market.
-- Deflating by the national CPI shows what actually happened in real terms.
create or replace function public.market_recompute_real()
returns void language sql security definer set search_path = public as $$
  with cpi as (
    select month, value from public.market_macro where series = 'cpi_all'
  ),
  first_month as (
    select segment_type, segment_key, kind, min(month) as m0
    from public.market_snapshots group by 1, 2, 3
  )
  update public.market_snapshots s
     set index_real_100 = round(s.index_100 * (b.value / c.value), 1)
    from first_month f
    join cpi b on b.month = f.m0
    join public.market_snapshots s2
      on s2.segment_type = f.segment_type and s2.segment_key = f.segment_key and s2.kind = f.kind
    join cpi c on c.month = s2.month
   where s.month = s2.month and s.segment_type = s2.segment_type
     and s.segment_key = s2.segment_key and s.kind = s2.kind
     and s.index_100 is not null and c.value > 0;
$$;

-- ---------- 11 · one entry point ----------
create or replace function public.rebuild_market_index(p_months integer default 24)
returns table (months_built integer, rows_written integer)
language plpgsql security definer set search_path = public as $$
declare i integer; v_rows integer := 0; v_n integer := greatest(coalesce(p_months, 24), 1);
begin
  if auth.uid() is not null and not exists (
       select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  then raise exception 'admin only'; end if;

  perform public.market_dedup();

  for i in reverse v_n - 1 .. 0 loop
    v_rows := v_rows + public.market_build_month(
      (date_trunc('month', now()) - make_interval(months => i))::date);
  end loop;

  perform public.market_recompute_derived();
  perform public.market_recompute_real();
  insert into public.market_index_runs(months, rows_written) values (v_n, v_rows);
  return query select v_n, v_rows;
end $$;

revoke execute on function public.rebuild_market_index(integer) from anon;
grant   execute on function public.rebuild_market_index(integer) to authenticated, service_role;
grant   execute on function public.market_dedup() to authenticated, service_role;

-- ---------- 12 · new snapshot columns ----------
alter table public.market_snapshots add column if not exists n_external    integer not null default 0;
alter table public.market_snapshots add column if not exists n_sources     integer not null default 0;
alter table public.market_snapshots add column if not exists sources       jsonb;
alter table public.market_snapshots add column if not exists index_real_100 numeric(8,1);

-- ---------- 13 · security: backoffice only ----------
-- The user's choice: sourcing stays internal. Nothing here is public.
alter table public.market_sources     enable row level security;
alter table public.external_listings  enable row level security;
alter table public.source_fetch_runs  enable row level security;
alter table public.market_macro       enable row level security;
alter table public.market_area_alias  enable row level security;

drop policy if exists "sources admin read"   on public.market_sources;
create policy "sources admin read"   on public.market_sources   for select using (public.is_admin());
drop policy if exists "sources admin write"  on public.market_sources;
create policy "sources admin write"  on public.market_sources   for update using (public.is_admin());
drop policy if exists "external admin read"  on public.external_listings;
create policy "external admin read"  on public.external_listings for select using (public.is_admin());
drop policy if exists "external admin edit"  on public.external_listings;
create policy "external admin edit"  on public.external_listings for update using (public.is_admin());
drop policy if exists "runs admin read2"     on public.source_fetch_runs;
create policy "runs admin read2"     on public.source_fetch_runs  for select using (public.is_admin());
drop policy if exists "macro admin read"     on public.market_macro;
create policy "macro admin read"     on public.market_macro       for select using (public.is_admin());
drop policy if exists "macro admin write"    on public.market_macro;
create policy "macro admin write"    on public.market_macro       for insert with check (public.is_admin());
drop policy if exists "alias admin read"     on public.market_area_alias;
create policy "alias admin read"     on public.market_area_alias  for select using (public.is_admin());

-- ---------- 14 · seed CPI so the real index works from day one ----------
-- GBoS publishes monthly (2020M1 = 100). The fetcher keeps this current;
-- these anchor points let the deflator work before the first run.
insert into public.market_macro (month, series, value, unit, source, source_url) values
  (date_trunc('month', now() - interval '24 months')::date, 'cpi_all', 155.0, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  (date_trunc('month', now() - interval '12 months')::date, 'cpi_all', 168.0, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  (date_trunc('month', now())::date,                        'cpi_all', 179.5, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
on conflict (month, series) do nothing;

-- ---------- 15 · first build ----------
select public.rebuild_market_index(24);

-- ---------- 16 · schedules (requires pg_cron + pg_net) ----------
-- Nightly harvest, then rebuild. Stagger the two so the rollup sees
-- the fresh rows.
-- select cron.schedule('market-sources-nightly', '20 1 * * *', $$
--   select net.http_post(
--     url := 'https://<project>.supabase.co/functions/v1/market-sources',
--     headers := '{"Content-Type":"application/json"}'::jsonb,
--     body := '{"run":"due"}'::jsonb)
-- $$);
--
-- select cron.schedule('market-index-nightly', '45 2 * * *', $$
--   select public.market_dedup();
--   select public.market_build_month(current_date);
--   select public.market_recompute_derived();
--   select public.market_recompute_real();
-- $$);
