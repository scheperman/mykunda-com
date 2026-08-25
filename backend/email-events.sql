-- ============================================================
--  MyKunda — Email deliverability events (Resend webhook)
--  Apply in Supabase: SQL Editor → New query → paste → Run
--  Safe to re-run: uses IF NOT EXISTS.
-- ============================================================

create table if not exists public.email_events (
  id              uuid primary key default uuid_generate_v4(),
  resend_email_id text,
  event_type      text not null,          -- bounced | complained | delivery_delayed | failed | suppressed
  recipient       text,
  subject         text,
  reason          text,
  payload         jsonb default '{}',
  created_at      timestamptz not null default now()
);
create index if not exists email_events_type_idx      on public.email_events(event_type);
create index if not exists email_events_recipient_idx on public.email_events(recipient);
create index if not exists email_events_created_idx   on public.email_events(created_at desc);

alter table public.email_events enable row level security;
drop policy if exists "email_events admin read" on public.email_events;
create policy "email_events admin read" on public.email_events for select using (public.is_admin());
-- No insert policy: rows are written by resend-webhook using the service-role key, which bypasses RLS.

-- Flag bad addresses directly on the lead row (best-effort match by email).
alter table public.leads add column if not exists email_bounced_at timestamptz;
alter table public.leads add column if not exists email_bounce_reason text;
