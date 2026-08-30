-- De verzendkant van de opgeslagen zoekopdrachten.
-- Toegepast op jejaerpqltqryqzjvbjp op 30-08-2026.
--
-- Er werden wel zoekopdrachten en alertvoorkeuren bewaard, maar er ging nooit
-- iets uit. Dit zet de laatste helft erop: een stempel om te weten wat er al
-- gemeld is, en een cron-taak die de edge function notify-saved-search wekt.

alter table public.saved_searches
  add column if not exists last_alert_at timestamptz;

comment on column public.saved_searches.last_alert_at is
  'Wanneer er voor het laatst een alert over deze zoekopdracht is verstuurd. Wordt pas gezet nadat de mail echt weg is; blijft leeg zolang er nooit iets gestuurd is, en dan geldt created_at als startpunt. notify-saved-search meldt alleen advertenties die na dit moment live zijn gegaan.';

/* Zelfde patroon als run_mail_health_check(): de gedeelde sleutel komt uit de
   kluis, niet uit de code, en de aanroep gaat via pg_net. */
create or replace function public.run_saved_search_alerts()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-saved-search';
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
    raise warning 'run_saved_search_alerts: geen notify_shared_key in de kluis';
  end if;

  perform net.http_post(
    url                  => v_url,
    body                 => '{}'::jsonb,
    headers              => v_headers,
    timeout_milliseconds => 60000
  );
end
$function$;

/* Een keer per dag, 08:00 Banjul (Africa/Banjul is UTC+0). 's Ochtends, zodat
   iemand er iets mee kan doen op dezelfde dag, en niet vaker dan een keer:
   een alert die twee keer per dag komt wordt spam. */
select cron.schedule('saved-search-alerts', '0 8 * * *', 'select public.run_saved_search_alerts()');

-- Nagemeten op 30-08-2026, telkens via run_saved_search_alerts() zodat de hele
-- keten (cron -> pg_net -> edge function -> Resend) meedeed:
--   · geen zoekopdrachten            -> {"searches":0,"users":0,"sent":0}
--   · een passende nieuwe advertentie -> een mail, onderwerp in enkelvoud;
--     de te dure advertentie viel er terecht buiten (pMax 5.000.000)
--   · nog een keer draaien            -> {"users":0,"sent":0}, geen herhaling
--   · channel = 'off'                 -> niets
--   · consent_marketing = false       -> niets
-- De verstuurde mail droeg List-Unsubscribe en List-Unsubscribe-Post; dat is de
-- eerste MyKunda-mail met een afmeldkop.
