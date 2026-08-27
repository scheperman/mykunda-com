-- MyKunda — aanmeld- en inlogherstel, 27-08-2026
--
-- STATUS: TOEGEPAST op 27-08-2026, in twee losse migraties op de server:
--   signup_notify_also_on_insert      (deel 1 hieronder)
--   profiles_email_not_self_editable  (deel 2 hieronder)
-- Dit bestand is de leesbare bron; draai het niet nog eens zonder te kijken.
-- LET OP: gebruik hier geen `supabase db push`. De bestanden in deze map missen
-- de volledige tijdstempel in hun naam, terwijl ze op de server wél onder een
-- volledige versie staan — push zou ze opnieuw willen draaien.
--
-- 1) Welkomstmail + teammelding ook voor accounts die al bevestigd binnenkomen.
--    Google-users krijgen email_confirmed_at al bij de INSERT, dus de oude
--    AFTER UPDATE-trigger vuurde bij hen nooit. De enige verzender was de
--    browser na de OAuth-redirect; sloot de bezoeker het tabblad, dan ging er
--    niets uit en bleef de aanmelding onopgemerkt.
create or replace function public.notify_signup_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.email_confirmed_at is not null
     and (tg_op = 'INSERT' or old.email_confirmed_at is null) then
    perform net.http_post(
      url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-signup',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object('user_id', new.id)
    );
  end if;
  return new;
end;
$function$;

-- De triggernaam moet alfabetisch NA on_auth_user_created komen. Bij een INSERT
-- vuren beide, en notify-signup heeft het profiel nodig dat handle_new_user
-- aanmaakt. pg_net verstuurt pas na commit, dus het zou ook zonder goed gaan,
-- maar de volgorde expliciet vastleggen is goedkoper dan erop vertrouwen.
drop trigger if exists on_auth_user_confirmed on auth.users;
drop trigger if exists on_auth_user_signup_notify on auth.users;
create trigger on_auth_user_signup_notify
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.notify_signup_confirmed();

-- 2) Een ingelogde gebruiker mocht zijn eigen profiles.email overschrijven;
--    notificaties gingen dan naar een adres dat niet van hem is. Geen enkele
--    pagina schrijft die kolom (alleen consent_*, full_name, notify_messages).
revoke update (email) on public.profiles from authenticated;

-- Terugdraaien:
--   drop trigger if exists on_auth_user_signup_notify on auth.users;
--   create trigger on_auth_user_confirmed
--     after update of email_confirmed_at on auth.users
--     for each row execute function public.notify_signup_confirmed();
--   grant update (email) on public.profiles to authenticated;
-- (en de oude functiebody terugzetten: die controleerde alleen
--  old.email_confirmed_at is null, zonder de tg_op-tak)
