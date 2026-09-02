-- ============================================================================
--  MyKunda — blijven steken aanmeldingen opruimen                (02-09-2026)
--  Toegepast op jejaerpqltqryqzjvbjp; deze kopie is de bron in de repo.
--
--  generateLink(type 'signup') maakt de auth-gebruiker meteen aan, nog vóór de
--  code is ingetypt. Wie het codescherm verlaat, laat dus een lege schil achter:
--  een onbevestigde rij in auth.users plus het profiel dat handle_new_user()
--  eraan hangt. Niets ruimde die ooit op. Vandaag nul stuks, maar zodra er
--  verkeer komt vervuilt dit elke telling, elk overzicht en elke teammail.
--
--  Het blokkeert overigens niemand: auth-email geeft een bestaand-maar-
--  onbevestigd adres gewoon opnieuw een aanmeldcode. Dit is hygiëne.
--
--  DRIE VOORZORGEN, want een verwijdering in auth.users is niet terug te draaien
--  en verschillende sleutels ernaartoe staan op ON DELETE CASCADE:
--
--  1. user_has_any_data() leest de CATALOGUS in plaats van een met de hand
--     bijgehouden lijst tabellen. Elke vreemde sleutel in `public` die naar
--     auth.users of public.profiles wijst wordt gecontroleerd — ook eentje die
--     er volgende maand bij komt. Een gemiste tabel zou hier niet "vergeten"
--     betekenen maar "meegenomen in de cascade".
--  2. stale_signups() kijkt alleen naar rijen die nooit bevestigd zijn, nooit
--     hebben ingelogd, geen telefoonbevestiging hebben, niet al verwijderd zijn
--     en nergens in de database voorkomen. De ondergrens van zeven dagen zit in
--     de functie zelf, zodat een verkeerd meegegeven getal nooit een verse
--     aanmelding kan raken.
--  3. purge_stale_signups() schrijft eerst een bonnetje in
--     signup_shells_purged — de auth-rij zoals hij was, zonder wachtwoordhash
--     en zonder tokens — en verwijdert daarna pas. Zo is achteraf na te gaan
--     wat er weg is, en kan een account desnoods opnieuw aangemaakt worden.
--
--  Eén rij die niet weg kan (viewings.cancelled_by staat op NO ACTION) houdt de
--  ronde niet op; die wordt overgeslagen met een warning.
--
--  Cron: 'purge-stale-signups', 0 4 1 * * (Banjul = UTC), dus de eerste van de
--  maand om vier uur 's nachts.
-- ============================================================================

-- 1. Het bonnetje.
create table if not exists public.signup_shells_purged (
  user_id      uuid primary key,
  email        text,
  signed_up_at timestamptz,
  purged_at    timestamptz not null default now(),
  snapshot     jsonb
);

comment on table public.signup_shells_purged is
  'Het bonnetje bij purge_stale_signups(): wie er is opgeruimd, wanneer, en de auth-rij zoals hij was (zonder wachtwoordhash en zonder tokens). Een verwijdering in auth.users is niet terug te draaien; deze tabel zorgt dat wel na te gaan is wat er weg is en dat een account desnoods opnieuw aangemaakt kan worden.';

alter table public.signup_shells_purged enable row level security;

drop policy if exists "purged shells admin read" on public.signup_shells_purged;
create policy "purged shells admin read"
  on public.signup_shells_purged for select
  using ((select public.is_admin()));

-- 2. Komt deze gebruiker ergens in de database voor?
create or replace function public.user_has_any_data(p_user uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  r record;
  v boolean;
begin
  for r in
    select src_ns.nspname as sch, src.relname as tbl, a.attname as col
      from pg_constraint con
      join pg_class src            on src.oid = con.conrelid
      join pg_namespace src_ns     on src_ns.oid = src.relnamespace
      join pg_class tgt            on tgt.oid = con.confrelid
      join pg_namespace tgt_ns     on tgt_ns.oid = tgt.relnamespace
      join lateral unnest(con.conkey) k(attnum) on true
      join pg_attribute a          on a.attrelid = con.conrelid and a.attnum = k.attnum
     where con.contype = 'f'
       and src_ns.nspname = 'public'
       and src.relkind = 'r'
       and ( (tgt_ns.nspname = 'auth'   and tgt.relname = 'users')
          or (tgt_ns.nspname = 'public' and tgt.relname = 'profiles') )
       and not (src_ns.nspname = 'public' and src.relname = 'profiles')
  loop
    execute format('select exists(select 1 from %I.%I where %I = $1)', r.sch, r.tbl, r.col)
      into v using p_user;
    if v then return true; end if;
  end loop;
  return false;
end;
$function$;

revoke execute on function public.user_has_any_data(uuid) from public, anon, authenticated;

-- 3. De kandidaten, om ze te kunnen bekijken vóórdat er iets gebeurt.
create or replace function public.stale_signups(p_days integer default 30)
returns table(user_id uuid, email text, signed_up_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select u.id, u.email, u.created_at
    from auth.users u
   where u.email_confirmed_at is null
     and u.phone_confirmed_at is null
     and u.last_sign_in_at   is null
     and u.deleted_at        is null
     and u.created_at < now() - make_interval(days => greatest(p_days, 7))
     and not public.user_has_any_data(u.id)
   order by u.created_at;
$function$;

comment on function public.stale_signups(integer) is
  'Aanmeldingen die zijn blijven steken: generateLink(type signup) maakt de auth-gebruiker meteen aan, dus wie het codescherm verlaat laat een lege schil achter. Alleen rijen die nooit bevestigd zijn, nooit hebben ingelogd en nergens in de database voorkomen. De ondergrens van zeven dagen staat er zodat een verkeerd meegegeven getal nooit een verse aanmelding raakt.';

-- 4. Opruimen, met bonnetje.
create or replace function public.purge_stale_signups(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  r record;
  n integer := 0;
begin
  for r in select * from public.stale_signups(p_days) loop
    begin
      insert into public.signup_shells_purged(user_id, email, signed_up_at, snapshot)
      select u.id, u.email, u.created_at,
             to_jsonb(u)
               - 'encrypted_password' - 'confirmation_token' - 'recovery_token'
               - 'email_change_token_new' - 'email_change_token_current'
               - 'phone_change_token' - 'reauthentication_token'
        from auth.users u
       where u.id = r.user_id
      on conflict (user_id) do nothing;

      delete from auth.users where id = r.user_id;
      n := n + 1;
    exception when others then
      raise warning 'purge_stale_signups: % overgeslagen (%)', r.user_id, sqlerrm;
    end;
  end loop;
  return n;
end;
$function$;

revoke execute on function public.stale_signups(integer)       from public, anon, authenticated;
revoke execute on function public.purge_stale_signups(integer) from public, anon, authenticated;

-- 5. Eén keer per maand.
select cron.schedule('purge-stale-signups', '0 4 1 * *', $job$select public.purge_stale_signups(30)$job$);
