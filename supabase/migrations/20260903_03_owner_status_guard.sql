-- 20260903_03_owner_status_guard.sql
-- Aanbieder ↔ status. Gemeten op 03-09-2026: de policy "listings update" laat
-- de eigenaar elke kolom schrijven en protect_listing_paid_columns() bewaakt
-- alleen de betaalde kolommen en 'rejected'. Een eigenaar kon dus met één
-- REST-aanroep status='active' zetten en de beoordeling overslaan.
--
-- Deze trigger legt vast wat een eigenaar zélf mag:
--   draft ⇄ pending_review           (opslaan en indienen)
--   active ⇄ under_offer             (bod ontvangen / bod vervallen)
--   active|under_offer → sold|let|archived   (verkocht, verhuurd, van de markt)
--   sold|let|archived → active|under_offer   (terug op de markt — was al goedgekeurd)
--   sold|let|archived|active|under_offer → pending_review (bewerken en opnieuw indienen)
-- Alles wat uit draft of pending_review naar 'active' wil, komt alleen langs
-- een beheerder of de service key. 'rejected' blijft zoals het was.
create or replace function public.guard_owner_listing_status()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  claims text := nullif(current_setting('request.jwt.claims', true), '');
  rol    text;
  live   text[] := array['active','under_offer','sold','let','archived'];
begin
  if claims is null then return new; end if;           -- SQL editor, migraties
  begin rol := claims::jsonb ->> 'role'; exception when others then rol := null; end;
  if rol = 'service_role' or coalesce(public.is_admin(), false) then return new; end if;

  if new.status is not distinct from old.status then return new; end if;

  if new.status::text = 'draft' then
    if old.status::text not in ('draft','pending_review') then
      raise exception 'status_change_not_allowed: % -> %', old.status, new.status using errcode = '42501';
    end if;
  elsif new.status::text = 'pending_review' then
    null;   -- opnieuw indienen mag vanuit elke stand, ook vanuit rejected (zie hieronder)
  elsif new.status::text = any(live) then
    if not (old.status::text = any(live)) then
      raise exception 'status_change_not_allowed: % -> %', old.status, new.status using errcode = '42501';
    end if;
  else
    -- 'rejected' zet alleen een beheerder.
    raise exception 'status_change_not_allowed: % -> %', old.status, new.status using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.guard_owner_listing_status() from public, anon, authenticated;

drop trigger if exists listings_guard_owner_status on public.listings;
create trigger listings_guard_owner_status
  before update of status on public.listings
  for each row execute function public.guard_owner_listing_status();

-- Gemeten 03-09-2026 in een transactie met rollback: een eigenaar die zijn
-- afgekeurde advertentie opnieuw indiende, hield stil status 'rejected' —
-- protect_listing_paid_columns() zette hem terug, terwijl het dashboard zegt
-- "Change what is flagged and send it in again". Vanaf nu mag de eigenaar uit
-- 'rejected' naar 'pending_review' (en alleen daarheen); de beoordelaar kijkt
-- dan opnieuw. De rest van de functie is ongewijzigd.
create or replace function public.protect_listing_paid_columns()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  claims text := nullif(current_setting('request.jwt.claims', true), '');
  rol    text;
begin
  if claims is null then
    return new;
  end if;

  begin
    rol := claims::jsonb ->> 'role';
  exception when others then
    rol := null;
  end;

  if rol = 'service_role' or coalesce(public.is_admin(), false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified_title := false;
    new.boosted_until     := null;
    new.verified_until    := null;
    new.plan              := 'basic';
    if new.status = 'rejected' then
      new.status := 'draft';
    end if;
  else
    new.is_verified_title := old.is_verified_title;
    new.boosted_until     := old.boosted_until;
    new.verified_until    := old.verified_until;
    new.plan              := old.plan;

    -- Uit 'rejected' komt de eigenaar alleen naar 'pending_review' (opnieuw indienen).
    if old.status = 'rejected' and new.status <> 'pending_review' then
      new.status := old.status;
    end if;
  end if;

  return new;
end $function$;

-- Van de markt halen door de eigenaar zelf is geen nieuws voor hem. De mail
-- "Your listing has come off MyKunda" is geschreven voor de beheerder die
-- iets weghaalt; als de eigenaar het zelf doet, zwijgt de trigger.
create or replace function public.notify_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_url     text := 'https://jejaerpqltqryqzjvbjp.supabase.co/functions/v1/notify-listing-status';
  v_sleutel text;
  v_headers jsonb;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status not in ('active', 'rejected', 'archived') then
    return new;
  end if;

  -- 03-09-2026: de eigenaar die zelf archiveert krijgt geen mail.
  if new.status = 'archived' and auth.uid() is not null and auth.uid() = new.owner_id then
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
  raise warning 'notify_listing_status_change: mail niet in de wachtrij voor % (% -> %): %',
    new.id, old.status, new.status, sqlerrm;
  return new;
end
$function$;

-- Hygiëne uit de security advisor van 03-09-2026: triggerfuncties hoeven
-- niet via /rest/v1/rpc aanroepbaar te zijn.
revoke execute on function public.profiles_log_role_change() from public, anon, authenticated;
revoke execute on function public.profiles_touch_updated_at() from public, anon, authenticated;
