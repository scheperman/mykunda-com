-- ============================================================
--  MyKunda — payments audit table (optional)
--  notify-payment emails the receipt and the backoffice alert
--  whether or not this table exists. Create it and every order
--  also leaves a row you can reconcile against the bank.
--
--  Run once in the Supabase SQL editor.
-- ============================================================
create table if not exists public.payments (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  reference   text not null,
  plan        text not null,
  amount_display text,
  method      text,
  status      text not null default 'paid',   -- paid | awaiting_transfer | refunded | cancelled
  name        text,
  email       text,
  phone       text,
  payload     jsonb,
  settled_at  timestamptz
);

create unique index if not exists payments_reference_idx on public.payments (reference);
create index if not exists payments_created_idx on public.payments (created_at desc);

alter table public.payments enable row level security;

-- Only the service role (the edge function) writes; only admins read.
drop policy if exists "payments admin read" on public.payments;
create policy "payments admin read" on public.payments
  for select using (public.is_admin());

drop policy if exists "payments admin update" on public.payments;
create policy "payments admin update" on public.payments
  for update using (public.is_admin());

-- Reconciliation: transfers registered but never matched to money in.
-- select reference, plan, amount_display, name, email, created_at
--   from public.payments
--  where status = 'awaiting_transfer'
--    and created_at < now() - interval '7 days'
--  order by created_at;
