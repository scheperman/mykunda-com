-- ============================================================
--  MyKunda — fix: anonymous lead submissions never got an id back
--  RLS lets anon INSERT into leads but not SELECT, so the old
--  insert().select().single() call threw, silently double-inserted
--  the lead, and — because it never got an id — never called
--  notify-lead. This RPC does the insert with definer privileges
--  and returns the new id directly, bypassing the anon SELECT block.
--  Apply in Supabase: SQL Editor → New query → paste → Run
-- ============================================================
create or replace function public.create_lead(
  p_source text, p_name text, p_email text, p_phone text,
  p_area text, p_message text, p_listing_id uuid, p_payload jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  new_id uuid;
begin
  insert into public.leads (source, name, email, phone, area, message, listing_id, payload)
  values (p_source::lead_source, p_name, p_email, p_phone, p_area, p_message, p_listing_id, coalesce(p_payload, '{}'::jsonb))
  returning id into new_id;
  return new_id;
end $$;

grant execute on function public.create_lead to anon, authenticated;
