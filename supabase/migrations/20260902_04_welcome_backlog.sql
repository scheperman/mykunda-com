-- ============================================================================
--  MyKunda — een vangnet voor de welkomstmail                   (02-09-2026)
--  Toegepast op jejaerpqltqryqzjvbjp; deze kopie is de bron in de repo.
--
--  Twee problemen, één oorzaak: de welkomstmail werd precies één keer
--  aangeboden, door een databasetrigger via pg_net, en pg_net doet geen retry.
--
--  1) Mislukte de mail, dan zette notify-signup welcomed_at netjes weer op
--     null — maar niemand pakte de draad ooit op. Een korte storing bij Resend
--     betekende dus definitief geen welkomstmail, en niets liet dat zien.
--  2) Een Google-aanmelding komt al bevestigd binnen. De trigger vuurde daar
--     op INSERT, dus de mail vertrok vóórdat de browser de rol en de
--     toestemming had weggeschreven: een kantoor kreeg de zoekersversie. Dat
--     stond sinds 30-08 als bewuste keuze in het commentaar ("liever een iets
--     te algemene mail dan geen mail"); met een vangnet hoeft die keuze niet
--     meer gemaakt te worden.
--
--  Nieuwe verdeling van het werk:
--   - e-mailcode  → de trigger, op het moment van bevestigen. De rol en de
--                   toestemming staan er dan al in, want ze reisden mee in de
--                   signup-metadata. Onveranderd snel.
--   - Google      → de browser, in finishOAuth(), zodra de rol en de
--                   toestemming echt in profiles staan.
--   - alles wat daar doorheen valt → run_welcome_backlog(), elke vijf minuten.
--
--  Waarom consent_contact een voorwaarde is: sinds de toestemmingspoort van
--  vandaag komt niemand de site op zonder aanvaarde voorwaarden. Een profiel
--  zonder toestemming is dus een aanmelding die halverwege is afgebroken, en
--  die hoort geen "Welcome to MyKunda" te krijgen.
-- ============================================================================

-- 1. Teller, zodat een onbereikbaar adres de wachtrij niet eindeloos bezet.
alter table public.profiles
  add column if not exists welcome_attempts integer not null default 0;

comment on column public.profiles.welcome_attempts is
  'Mislukte pogingen om de welkomstmail te versturen. notify-signup hoogt hem op zodra de klantmail faalt en zet welcomed_at dan weer op null; run_welcome_backlog() slaat een profiel over vanaf 5 pogingen.';

-- 2. De trigger vuurt niet meer op INSERT.
--    De triggerdefinitie zelf blijft staan (AFTER INSERT OR UPDATE OF
--    email_confirmed_at) — de poort zit hier, in de functie, zodat er niets
--    gedropt en opnieuw gemaakt hoeft te worden.
create or replace function public.notify_signup_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE'
     and new.email_confirmed_at is not null
     and old.email_confirmed_at is null then
    perform net.http_post(
      url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-signup',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := jsonb_build_object('user_id', new.id)
    );
  end if;
  return new;
end;
$function$;

-- 3. De veger. Biedt aan wat er is blijven liggen; notify-signup is idempotent
--    (het claimt welcomed_at met een update where welcomed_at is null), dus een
--    dubbele aanbieding kan geen dubbele mail geven.
create or replace function public.run_welcome_backlog()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id  uuid;
  v_n   integer := 0;
begin
  for v_id in
    select p.id
      from public.profiles p
      join auth.users u on u.id = p.id
     where p.welcomed_at is null
       and p.consent_contact is true
       and p.welcome_attempts < 5
       and u.email_confirmed_at is not null
       -- Even wachten: de trigger en de browser zijn sneller, en die horen
       -- eerst aan de beurt te zijn.
       and u.email_confirmed_at < now() - interval '90 seconds'
       -- Wat een week blijft liggen komt niet meer goed; dan is het een geval
       -- voor de mailcontrole, niet voor deze wachtrij.
       and p.created_at > now() - interval '7 days'
     order by p.created_at
     limit 25
  loop
    perform net.http_post(
      url                  := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-signup',
      headers              := '{"Content-Type":"application/json"}'::jsonb,
      body                 := jsonb_build_object('user_id', v_id),
      timeout_milliseconds := 30000
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

-- Zelfde les als op 30-08: intrekken bij anon en authenticated is niet genoeg,
-- want Postgres geeft een nieuwe functie EXECUTE aan PUBLIC en beide rollen
-- erven het daarvan. Dus eerst PUBLIC.
revoke execute on function public.run_welcome_backlog() from public, anon, authenticated;

-- 4. Elke vijf minuten. Vaker heeft geen zin: de twee snelle routes hierboven
--    doen het werk, dit is het vangnet.
select cron.schedule('welcome-backlog', '*/5 * * * *', $job$select public.run_welcome_backlog()$job$);
