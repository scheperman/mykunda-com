-- ============================================================
--  MyKunda — lead handling fixes (Aug 2026)
--  1) Record what notify-lead actually sent. Without these columns a
--     Resend failure is only visible in the function logs: the lead sits
--     in the console looking healthy while nobody was emailed.
--     notify-lead writes both fields after every run (and skips them
--     silently if this file was never applied).
--  2) Let admins delete a lead. admin.html has a delete button, but RLS
--     only had insert/select/update policies — the row vanished from the
--     screen and came back on the next refresh.
--  Apply in Supabase: SQL Editor → New query → paste → Run
-- ============================================================
alter table public.leads add column if not exists notified_at  timestamptz;
alter table public.leads add column if not exists notify_error text;

comment on column public.leads.notified_at  is 'Last time notify-lead ran for this lead (team mail + auto-reply).';
comment on column public.leads.notify_error is 'Resend error(s) from that run; null when both emails went out.';

drop policy if exists "leads admin delete" on public.leads;
create policy "leads admin delete" on public.leads for delete using (public.is_admin());

-- Leads stored but never emailed — should return zero rows.
-- select id, source, email, created_at, notify_error
--   from public.leads
--  where created_at > now() - interval '30 days'
--    and (notified_at is null or notify_error is not null)
--  order by created_at desc;
