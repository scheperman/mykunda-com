-- ============================================================================
--  MyKunda — de laatste vier aanroepers sturen de sleutel mee      (03-09-2026)
--  Toegepast op jejaerpqltqryqzjvbjp; deze kopie is de bron in de repo.
--
--  T9 uit de aanmeldaudit van 02-09, en de drie zusjes die erbij bleken te
--  horen. Zes databasefuncties (advertentiestatus, betaling, titelonderzoek,
--  mailcontrole, planverloop, zoekalerts) haalden de gedeelde sleutel al uit
--  de kluis en stuurden hem mee als x-notify-key. Vier deden dat nog niet:
--
--    notify_signup_confirmed()     → notify-signup           (trigger)
--    run_welcome_backlog()         → notify-signup           (cron, 5 min)
--    messages_after_insert()       → notify-message          (trigger)
--    send_viewing_reminder_mail()  → notify-viewing-reminder (cron, kwartier)
--
--  De vier edge functions weigeren sinds vandaag zonder sleutel (notify-signup
--  en notify-viewing laten daarnaast het sessietoken van de gebruiker zelf
--  door, want die hebben een browserpad). Zonder deze migratie zouden de
--  triggers en crons dus 401 krijgen. Volgorde bij uitrollen: EERST deze
--  migratie (een extra header doet de oude functies niets), DAN de functies.
--
--  Eén helper in plaats van vier keer dezelfde tien regels: notify_headers().
--  De zes oudere functies blijven zoals ze zijn — ze werken, en ze
--  herschrijven zonder aanleiding is het soort opruimen dat iets kapotmaakt.
--  Nieuwe aanroepers horen de helper te gebruiken.
--
--  Als de sleutel niet in de kluis staat, geeft de helper alleen Content-Type
--  terug en een WARNING. De edge function weigert dan (401), de trigger
--  faalt niet, en de veger of de kwartiercron probeert het later opnieuw.
--  Zo wordt een ontbrekende sleutel zichtbaar in plaats van een open poort.
--
--  Nagemeten 03-09-2026: notify_headers() geeft een sleutel van 48 tekens,
--  anon en authenticated mogen hem niet aanroepen. Via net.http_post met deze
--  headers: notify-signup → 200 already_welcomed, de drie andere → 404 op een
--  verzonnen id (dus voorbij de poort). Van buiten zonder sleutel of met de
--  anon-sleutel als Bearer: alle vier 401. Met een echt sessietoken:
--  notify-signup eigen id 200, ander id 403 not_you; notify-viewing 404 op een
--  onbekend id; notify-message 401 (geen browserdeur).
-- ============================================================================

create or replace function public.notify_headers()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_sleutel text;
begin
  begin
    select s.decrypted_secret into v_sleutel
      from vault.decrypted_secrets s
     where s.name = 'notify_shared_key';
  exception when others then
    v_sleutel := null;
  end;
  if v_sleutel is null or v_sleutel = '' then
    raise warning 'notify_headers: geen notify_shared_key in de kluis; de edge function zal dit verzoek weigeren';
    return jsonb_build_object('Content-Type', 'application/json');
  end if;
  return jsonb_build_object('Content-Type', 'application/json', 'x-notify-key', v_sleutel);
end;
$function$;

comment on function public.notify_headers() is
  'De headers voor een interne aanroep van een notify-edge function: Content-Type plus x-notify-key uit de kluis (vault-secret notify_shared_key). Alleen voor SECURITY DEFINER-functies; nooit aan een client teruggeven.';

-- Niemand van buiten mag deze aanroepen: hij geeft de sleutel terug.
revoke execute on function public.notify_headers() from public, anon, authenticated;

-- 1. De trigger bij het bevestigen van een e-mailadres.
create or replace function public.notify_signup_confirmed()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Alleen bij het BEVESTIGEN van een adres, niet bij het aanmaken. Een
  -- Google-aanmelding komt al bevestigd binnen; vuurde de trigger daar ook,
  -- dan vertrok de welkomstmail voordat de browser de rol en de toestemming
  -- had weggeschreven. Voor die route mailt de browser zelf (finishOAuth), en
  -- run_welcome_backlog() vangt op wat daar doorheen valt.
  if tg_op = 'UPDATE'
     and new.email_confirmed_at is not null
     and old.email_confirmed_at is null then
    perform net.http_post(
      url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-signup',
      headers := public.notify_headers(),
      body    := jsonb_build_object('user_id', new.id)
    );
  end if;
  return new;
end;
$function$;

-- 2. De veger, elke vijf minuten.
create or replace function public.run_welcome_backlog()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id      uuid;
  v_n       integer := 0;
  v_headers jsonb := public.notify_headers();
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
      headers              := v_headers,
      body                 := jsonb_build_object('user_id', v_id),
      timeout_milliseconds := 30000
    );
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$function$;

revoke execute on function public.run_welcome_backlog() from public, anon, authenticated;

-- 3. De trigger op een nieuw bericht.
create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conv        public.conversations;
  v_last_notify timestamptz;
begin
  update public.conversations c
     set last_message_at      = new.created_at,
         last_message_preview = left(btrim(new.body), 160),
         last_sender_id       = new.sender_id,
         buyer_unread  = case when c.buyer_id  <> new.sender_id then c.buyer_unread  + 1 else c.buyer_unread  end,
         seller_unread = case when c.seller_id <> new.sender_id then c.seller_unread + 1 else c.seller_unread end
   where c.id = new.conversation_id
  returning c.* into v_conv;

  if v_conv.id is null then
    return new;
  end if;

  v_last_notify := case when v_conv.buyer_id = new.sender_id
                        then v_conv.seller_notified_at
                        else v_conv.buyer_notified_at end;

  if v_last_notify is null or v_last_notify < now() - interval '15 minutes' then
    perform net.http_post(
      url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-message',
      headers := public.notify_headers(),
      body    := jsonb_build_object('message_id', new.id)
    );
  else
    -- Bewust geen mail. Noteer dat, anders lijkt dit later op een storing.
    update public.messages
       set notify_error = 'throttled: recipient already notified within 15 minutes'
     where id = new.id;
  end if;

  return new;
end;
$function$;

-- 4. De herinnering, vanuit de kwartiercron.
create or replace function public.send_viewing_reminder_mail(p_viewing_id uuid, p_phase text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- Zelfde mailkanaal als de bestaande trigger op messages: pg_net ->
  -- Edge Function -> Resend. Die functie stuurt naar proposer_id en
  -- invitee_id, respecteert profiles.notify_messages en de unsubscribe-link.
  perform net.http_post(
    url     := 'https://jejaerpqltqryqzjvbjp.functions.supabase.co/notify-viewing-reminder',
    headers := public.notify_headers(),
    body    := jsonb_build_object('viewing_id', p_viewing_id, 'phase', p_phase)
  );
end $function$;

