-- ============================================================================
--  MyKunda — aflopende Boost en Verified melden               (30-08-2026)
--  Toegepast op jejaerpqltqryqzjvbjp via de Supabase-MCP als migratie
--  'plan_expiry_notices'. Deze kopie is de bron in de repo.
--
--  listings.boosted_until en verified_until bestonden al — apply_paid_plan()
--  zet ze bij een betaling — maar er ging nooit iets over de deur uit. Een
--  klant die dertig dagen Boost kocht hoorde niet dat die dertig dagen om
--  waren. Dit is de enige plek in MyKunda met directe herhaalomzet.
--
--  Hoort bij: supabase/functions/notify-plan-expiry/index.ts (het bericht) en
--  supabase/functions/unsubscribe/index.ts (de afmeldschakelaar, k=plans).
-- ============================================================================

-- 1. Een eigen afmeldschakelaar. Deze mail zit NIET achter consent_marketing:
--    het gaat over iets wat de ontvanger zelf gekocht heeft. Maar er staat ook
--    een verlengknop in, dus hij hoort een eigen weg naar buiten te hebben —
--    en die mag niet de knop voor berichtmeldingen zijn, want dan zet je met
--    "geen aanbiedingen" ook je gesprekken uit.
alter table public.profiles
  add column if not exists notify_plan_expiry boolean not null default true;

comment on column public.profiles.notify_plan_expiry is
  'Mag deze gebruiker bericht krijgen als een Boost of Verified-periode op zijn advertentie afloopt? Standaard ja. Uit te zetten via de afmeldlink in die mail (functions/v1/unsubscribe?t=<token>&k=plans).';

-- 2. Ontdubbelen. Eén bericht per (advertentie, product, fase, einddatum).
--    De einddatum zit in de sleutel: verlengt iemand zijn Boost, dan schuift
--    boosted_until op en is de volgende afloop een ander bericht.
create unique index if not exists email_events_plan_expiry_once
  on public.email_events (
    ((payload ->> 'listing_id')),
    ((payload ->> 'product')),
    ((payload ->> 'phase')),
    ((payload ->> 'until'))
  )
  where event_type = 'plan_expiry';

-- 3. De wekker. Zelfde patroon als run_saved_search_alerts(): de sleutel komt
--    uit de kluis, de aanroep gaat via pg_net.
create or replace function public.run_plan_expiry_notices()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-plan-expiry';
  v_sleutel text;
  v_headers jsonb;
begin
  begin
    select s.decrypted_secret into v_sleutel
      from vault.decrypted_secrets s
     where s.name = 'notify_shared_key';
  exception when others then
    v_sleutel := null;
  end;

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  if v_sleutel is not null and v_sleutel <> '' then
    v_headers := v_headers || jsonb_build_object('x-notify-key', v_sleutel);
  else
    raise warning 'run_plan_expiry_notices: geen notify_shared_key in de kluis';
  end if;

  perform net.http_post(
    url                  => v_url,
    body                 => '{}'::jsonb,
    headers              => v_headers,
    timeout_milliseconds => 60000
  );
end
$function$;

-- Een half uur na de zoekalerts, zodat de twee taken elkaar niet in de weg
-- zitten en niemand twee MyKunda-mails in dezelfde minuut krijgt.
select cron.schedule('plan-expiry-notices', '30 8 * * *', 'select public.run_plan_expiry_notices()');
