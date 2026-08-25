-- ============================================================
--  FX RATES — Central Bank of The Gambia daily valuation rates
--  Populated by the fx-rates edge function (see edge-functions/fx-rates).
--  Run this once, then schedule the function.
-- ============================================================

create table if not exists public.fx_rates (
  as_at       date primary key,               -- CBG publication date
  eur_gmd     numeric(10,4) not null,         -- dalasi per 1 euro
  usd_gmd     numeric(10,4),                  -- dalasi per 1 dollar
  gbp_gmd     numeric(10,4),                  -- dalasi per 1 pound
  source      text not null default 'Central Bank of The Gambia',
  source_url  text,
  fetched_at  timestamptz not null default now()
);
create index if not exists fx_rates_as_at_idx on public.fx_rates(as_at desc);

-- Rejected fetches: a move larger than the tolerance is logged, never applied.
-- Check this table if the site is showing an old rate.
create table if not exists public.fx_rate_rejects (
  id               uuid primary key default gen_random_uuid(),
  as_at            date not null,
  eur_gmd          numeric(10,4) not null,
  previous_eur_gmd numeric(10,4),
  move_pct         numeric(6,2),
  source           text,
  created_at       timestamptz not null default now()
);

-- Rates are public information; only the service role writes them.
alter table public.fx_rates        enable row level security;
alter table public.fx_rate_rejects enable row level security;

drop policy if exists "fx rates readable" on public.fx_rates;
create policy "fx rates readable" on public.fx_rates for select using (true);

drop policy if exists "fx rejects admin only" on public.fx_rate_rejects;
create policy "fx rejects admin only" on public.fx_rate_rejects for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Seed with the rate the site shipped with, so there is never an empty table.
insert into public.fx_rates (as_at, eur_gmd, usd_gmd, gbp_gmd, source_url)
values ('2026-07-25', 85.20, 72.60, 96.04, 'https://www.cbg.gm/')
on conflict (as_at) do nothing;

-- ---- Daily schedule (requires pg_cron + pg_net) ----
-- Replace <project> with your project ref before running.
--
-- select cron.schedule(
--   'fx-rates-daily',
--   '0 13 * * 1-5',
--   $$ select net.http_post(
--        url := 'https://<project>.functions.supabase.co/fx-rates',
--        headers := '{"Content-Type":"application/json"}'::jsonb,
--        body := '{"refresh":true}'::jsonb
--      ) $$
-- );
