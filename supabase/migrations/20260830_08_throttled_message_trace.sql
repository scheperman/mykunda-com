-- Gevonden tijdens reis 1 van de testronde, 30-08-2026.
--
-- De rem van vijftien minuten op berichtnotificaties zit in deze trigger: bij
-- een tweede bericht binnen het venster wordt er simpelweg geen http_post
-- gedaan. Gevolg: notified_at en notify_error blijven allebei null, precies
-- zoals bij een bericht waarvan de notificatie is zoekgeraakt. Van buitenaf
-- was een bewust onderdrukte mail dus niet te onderscheiden van een verloren
-- mail, en notify-health kan er evenmin iets mee.
--
-- Vanaf nu schrijft de trigger 'throttled' in notify_error zodra hij bewust
-- overslaat. Dat is geen fout maar een verklaring; notify-health kijkt alleen
-- naar leads.notify_error, dus deze waarde geeft daar geen vals alarm.

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
      headers := '{"Content-Type":"application/json"}'::jsonb,
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
