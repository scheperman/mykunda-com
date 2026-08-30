-- ============================================================
--  MyKunda — twee stille gaten dichten (30-08-2026)
--  Toegepast via de Supabase-MCP als 'bounce_flag_and_reminder_stamp'.
--
--  1. profiles.email_bounced_at / email_bounce_reason
--     resend-webhook zette een hard gebouncet adres wél op de
--     suppressielijst van Resend, maar markeerde niets in de app — de
--     codecommentaar erkende dat er geen kolom voor was. Gevolg: de
--     gebruiker vroeg een inlogcode aan, auth-email antwoordde
--     {ok:true, code_length:6}, het scherm zei "we hebben een code
--     gestuurd", en er kwam nooit meer iets. Niemand kon dat zien.
--     In de data staat al zo'n geval: testing@mykunda.com, hard bounce
--     op "Your MyKunda sign-in code" (18-08-2026).
--
--  2. run_viewing_reminders() stempelde vooraf
--     De cron riep send_viewing_reminder_mail() aan (fire-and-forget via
--     pg_net, status wordt nooit gelezen) en zette daarna meteen
--     reminded_24h_at. Faalde Resend op dat moment, dan stond het stempel
--     er al en werd de herinnering nooit meer geprobeerd.
--     notify-viewing-reminder stempelt sinds vandaag zelf, ná verzending.
-- ============================================================

alter table public.profiles
  add column if not exists email_bounced_at   timestamptz,
  add column if not exists email_bounce_reason text;

comment on column public.profiles.email_bounced_at is
  'Gezet door resend-webhook bij een harde bounce of een spamklacht. Zolang dit gevuld is komt er geen mail meer aan op dit adres (Resend onderdrukt het), en zegt auth-email dat met zoveel woorden in plaats van te doen alsof er een code onderweg is. Leegmaken zodra de gebruiker een werkend adres heeft.';

create or replace function public.run_viewing_reminders()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare r record;
begin
  -- T-24u: alleen als het moment ook echt nog minstens 20 uur weg is,
  -- anders zou de mail "tomorrow" zeggen over een afspraak van vanmiddag
  -- en zou dezelfde afspraak twee mails krijgen.
  --
  -- Let op: hier wordt NIET meer gestempeld. notify-viewing-reminder zet
  -- reminded_24h_at / reminded_2h_at zelf zodra er echt een mail uit is
  -- gegaan. Blijft dat uit, dan staat deze rij er over een kwartier weer
  -- bij en wordt het opnieuw geprobeerd — binnen het venster.
  for r in select id from public.viewings
            where status='confirmed' and reminded_24h_at is null
              and chosen_slot between now() + interval '20 hours' and now() + interval '24 hours'
  loop
    perform public.send_viewing_reminder_mail(r.id, '24h');
  end loop;

  for r in select id from public.viewings
            where status='confirmed' and reminded_2h_at is null
              and chosen_slot between now() and now() + interval '2 hours'
  loop
    perform public.send_viewing_reminder_mail(r.id, '2h');
  end loop;

  update public.viewings set status = 'completed'
   where status = 'confirmed' and chosen_slot < now() - interval '2 hours';
end
$$;
