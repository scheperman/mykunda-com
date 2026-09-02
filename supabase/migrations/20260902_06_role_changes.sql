-- ============================================================================
--  MyKunda — een rolwijziging laat een spoor na                  (02-09-2026)
--  Toegepast op jejaerpqltqryqzjvbjp; deze kopie is de bron in de repo.
--
--  De rol bepaalt welke back-office iemand krijgt, of hij mag adverteren, en
--  of zijn bedrijfsprofiel met logo op elke advertentie verschijnt. Tot vandaag
--  stond een wijziging alleen in de log van de edge function set-role
--  (console.log) en had profiles geen updated_at. Wie wanneer van zoeker naar
--  kantoor ging, was na een maand dus niet meer na te gaan — precies het soort
--  feit waarvan je pas merkt dat je het mist op het moment dat je het nodig
--  hebt.
--
--  Waarom een TRIGGER en niet een regel in set-role: zo wordt elke weg gedekt —
--  de edge function, een beheerder die het met de hand doet, en het scherm dat
--  er ooit voor komt. Eén schrijver, geen dubbele regels, niets dat vergeten
--  kan worden.
--
--  BEWUST NIET GELOGD: de eerste rol bij het aanmelden. Die komt uit een INSERT
--  van handle_new_user(), niet uit een UPDATE. Hem meenemen zou betekenen dat
--  élk profiel meteen een rij in role_changes heeft — en dan vindt
--  user_has_any_data() (migratie 05) nooit meer een lege schil om op te ruimen.
--  De beginwaarde is bovendien gewoon af te leiden: staat er geen enkele
--  wijziging, dan is de rol nog die van het aanmelden.
--
--  Het spoor begint dus vandaag. Wat daarvoor gebeurde is niet te reconstrueren.
-- ============================================================================

create table if not exists public.role_changes (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  old_role    user_role,
  new_role    user_role not null,
  changed_by  uuid,
  via         text not null,
  changed_at  timestamptz not null default clock_timestamp()
);

create index if not exists role_changes_user_idx on public.role_changes (user_id, changed_at desc);

comment on table public.role_changes is
  'Elke wijziging van profiles.role, geschreven door de trigger profiles_log_role_change(). Het spoor begint op 02-09-2026; wat daarvoor gebeurde staat nergens meer.';

comment on column public.role_changes.via is
  'server = geschreven met de service key; vandaag is set-role de enige die dat doet. admin = een ingelogde beheerder. self = de gebruiker zelf, wat vandaag niet kan omdat authenticated geen UPDATE-recht heeft op profiles.role. Zolang elke schrijver de service key gebruikt staat hier dus altijd server; de kolom wordt pas onderscheidend zodra er een beheerdersscherm of een zelfbedieningsroute bij komt.';

comment on column public.role_changes.changed_at is
  'clock_timestamp(), niet now(): twee wijzigingen in dezelfde transactie zouden anders hetzelfde tijdstip krijgen en dus gelijktijdig lijken.';

alter table public.role_changes enable row level security;

drop policy if exists "role changes admin read" on public.role_changes;
create policy "role changes admin read"
  on public.role_changes for select
  using ((select public.is_admin()));

create or replace function public.profiles_log_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor uuid := auth.uid();
begin
  if new.role is distinct from old.role then
    insert into public.role_changes(user_id, old_role, new_role, changed_by, via)
    values (
      new.id, old.role, new.role, v_actor,
      case
        when v_actor is null  then 'server'
        when v_actor = new.id then 'self'
        else                       'admin'
      end
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists profiles_role_change_log on public.profiles;
create trigger profiles_role_change_log
  after update of role on public.profiles
  for each row execute function public.profiles_log_role_change();

-- ---------------------------------------------------------------------------
--  En de tweede helft van dezelfde bevinding: profiles had geen updated_at,
--  terwijl agencies die al jaren heeft. Door de trigger gezet, niet door de
--  client: authenticated heeft er geen schrijfrecht op en dat hoort zo te
--  blijven.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists updated_at timestamptz not null default now();

comment on column public.profiles.updated_at is
  'Wanneer deze rij voor het laatst is gewijzigd. Wordt door de trigger gezet, niet door de client. Zelfde patroon als agencies.updated_at.';

create or replace function public.profiles_touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists profiles_touch_updated on public.profiles;
create trigger profiles_touch_updated
  before update on public.profiles
  for each row execute function public.profiles_touch_updated_at();
