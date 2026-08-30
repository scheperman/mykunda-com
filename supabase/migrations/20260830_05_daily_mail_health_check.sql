-- ============================================================
--  MyKunda — dagelijkse controle op mail die niet aankwam (30-08-2026)
--  Toegepast via de Supabase-MCP als 'daily_mail_health_check'.
--
--  Alle triggers versturen hun mail met net.http_post: fire-and-forget,
--  de statuscode wordt nooit gelezen, er is geen retry en geen alarm.
--  Een echte wachtrij bouwen is een project op zich; stilte omzetten in
--  een signaal is dat niet. Deze job roept notify-health aan, dat kijkt
--  wat er de afgelopen 24 uur is misgegaan en alleen mailt als er iets
--  in staat — een dagelijkse "alles in orde"-mail leer je negeren, en
--  dan mis je juist de dag dat het ertoe doet.
--
--  07:30 UTC is 07:30 in Gambia (UTC+0), dus aan het begin van de
--  werkdag.
-- ============================================================

create or replace function public.run_mail_health_check()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-health';
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
    raise warning 'run_mail_health_check: geen notify_shared_key in de kluis';
  end if;

  perform net.http_post(
    url                  => v_url,
    body                 => '{}'::jsonb,
    headers              => v_headers,
    timeout_milliseconds => 20000
  );
end
$$;

select cron.schedule(
  'mail-health-check',
  '30 7 * * *',
  $$select public.run_mail_health_check()$$
);
