-- ============================================================
--  MyKunda — meldingen bij een statuswissel van een advertentie (30-08-2026)
--  Toegepast op jejaerpqltqryqzjvbjp via de Supabase-MCP als migratie
--  'listing_status_notifications'. Deze kopie is de bron in de repo.
--
--  Tot nu toe ging er bij precies één moment in het leven van een advertentie
--  een mail uit: het indienen. Goedgekeurd, afgewezen en uit de lucht leverden
--  niets op, terwijl de bevestigingsmail wél beloofde "usually within one
--  working day". De verkoper moest zelf gaan kijken.
-- ============================================================

alter table public.listings
  add column if not exists review_note text;

comment on column public.listings.review_note is
  'Reden die bij een afwijzing (status=rejected) naar de aanbieder gaat. Wordt letterlijk in de e-mail getoond, dus schrijf hem voor de verkoper, niet voor de backoffice.';

create unique index if not exists email_events_listing_status_once
  on public.email_events (((payload ->> 'listing_id')), ((payload ->> 'status')))
  where event_type = 'listing_status';

create or replace function public.notify_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-listing-status';
  v_sleutel text;
  v_headers jsonb;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Alleen de drie overgangen waar de aanbieder iets aan heeft.
  -- sold, let en under_offer zet hij zelf; draft en pending_review zijn
  -- tussenstanden. Die horen geen mail te geven.
  if new.status not in ('active', 'rejected', 'archived') then
    return new;
  end if;

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
    raise warning 'notify_listing_status_change: geen notify_shared_key in de kluis, verzoek gaat zonder sleutel de deur uit';
  end if;

  perform net.http_post(
    url                  => v_url,
    body                 => jsonb_strip_nulls(jsonb_build_object(
                              'listing_id', new.id::text,
                              'status',     new.status::text,
                              'reason',     case when new.status = 'rejected'
                                                 then nullif(btrim(coalesce(new.review_note, '')), '')
                                                 else null end
                            )),
    headers              => v_headers,
    timeout_milliseconds => 8000
  );

  return new;

exception when others then
  -- De statuswissel gaat voor de mail. Loopt het versturen stuk, dan blijft
  -- de wissel staan en zien we hier waarom.
  raise warning 'notify_listing_status_change: mail niet in de wachtrij voor % (% -> %): %',
    new.id, old.status, new.status, sqlerrm;
  return new;
end
$$;

drop trigger if exists listings_notify_status on public.listings;

create trigger listings_notify_status
after update of status on public.listings
for each row
when (new.status is distinct from old.status
      and new.status in ('active', 'rejected', 'archived'))
execute function public.notify_listing_status_change();
