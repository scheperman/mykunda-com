-- backend/notify-signup.sql — run once in the Supabase SQL editor (or via supabase db push).
-- 1) Stamp column that makes the welcome/notification send idempotent.
alter table public.profiles add column if not exists welcomed_at timestamptz;

-- 2) When an EMAIL-CODE sign-up is confirmed (email_confirmed_at flips from null to a value),
--    ping the notify-signup edge function. Google sign-ups arrive already confirmed on INSERT
--    and are deliberately NOT handled here: auth.html calls the function itself right after it
--    has stored the consent flags, so the team email shows the real consent state.
create or replace function public.notify_signup_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    perform net.http_post(
      url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-signup',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object('user_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row execute function public.notify_signup_confirmed();

-- Safety net for accounts that already exist: never welcome them retroactively.
update public.profiles set welcomed_at = coalesce(welcomed_at, now()) where welcomed_at is null;
