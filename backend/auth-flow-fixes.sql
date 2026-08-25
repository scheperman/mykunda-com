-- ============================================================
--  MyKunda — aanmeldflow fixes, 15 augustus 2026
--  1) RPC waarmee de auth-email Edge Function (met de service-
--     role key) kan opzoeken of een e-mailadres al een account
--     heeft en of dat bevestigd is, zonder te moeten gokken aan
--     de foutmelding van generateLink().
--  2) handle_new_user schrijft nu ook consent_contact /
--     consent_marketing / consent_at weg als de client die
--     meestuurt in de signup-metadata.
--  Draaien in de Supabase SQL Editor (of als migratie).
-- ============================================================

-- ---- 1 · bestaat dit e-mailadres, en is het bevestigd? ----
create or replace function public.auth_user_lookup(p_email text)
returns table(user_exists boolean, confirmed boolean)
language sql
security definer
set search_path = public, auth
as $$
  select
    exists (select 1 from auth.users u where lower(u.email) = lower(p_email)) as user_exists,
    coalesce(
      (select u.email_confirmed_at is not null
         from auth.users u
        where lower(u.email) = lower(p_email)),
      false
    ) as confirmed;
$$;

-- Alleen de Edge Function (met de service-role key) mag dit aanroepen —
-- nooit vanaf de client, anders lekt dit of een e-mailadres bestaat.
revoke all on function public.auth_user_lookup(text) from public, anon, authenticated;
grant execute on function public.auth_user_lookup(text) to service_role;

-- ---- 2 · consent vastleggen bij aanmaak van het profiel ----
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, phone,
    consent_contact, consent_marketing, consent_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    coalesce((new.raw_user_meta_data->>'consent_contact')::boolean, false),
    coalesce((new.raw_user_meta_data->>'consent_marketing')::boolean, false),
    case
      when coalesce((new.raw_user_meta_data->>'consent_contact')::boolean, false)
      then now()
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
