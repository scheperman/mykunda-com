-- ============================================================================
--  MyKunda — fase 5, de serverkant                            (30-08-2026)
--  Toegepast op jejaerpqltqryqzjvbjp via de Supabase-MCP als migratie
--  'professional_backoffice_backend'. Deze kopie is de bron in de repo.
--
--  Twee dingen die klaar lagen maar nergens op aangesloten waren: de
--  leadpijplijn en de bezoekcijfers.
--
--  Nagemeten in één transactie met elf stappen (eigenaar mag de fase verzetten,
--  een vreemde raakt nul rijen, de naam van de aanvrager is voor de eigenaar
--  op slot, de rollup telt op zonder dubbel te tellen, en de dagtotalen zijn
--  alleen voor de eigenaar leesbaar). Daarna alles verwijderd.
-- ============================================================================

-- 1. De leadpijplijn -------------------------------------------------------
--    leads.stage kent zeven fases en assigned_to bestaat, maar geen enkel
--    scherm gebruikte ze, en een aanbieder mocht ze ook niet aanraken: de
--    enige updateregel was is_admin() OR auth.uid() = assigned_to. Sinds de
--    leesregel van fase 0 ziet hij zijn leads wel maar kon hij niets.
alter table public.leads add column if not exists note text;
alter table public.leads add column if not exists lost_reason text;

comment on column public.leads.note is
  'Vrije aantekening van de aanbieder bij deze lead. Alleen zichtbaar voor wie de lead mag lezen; de aanvrager ziet hem nooit.';
comment on column public.leads.lost_reason is
  'Waarom de lead op stage=lost is gezet. Kort en voor eigen gebruik.';

create policy "leads owner update" on public.leads
for update
using (
  exists (select 1 from public.listings l
           where l.id = leads.listing_id
             and ((select auth.uid()) = l.owner_id or (select auth.uid()) = l.agent_id))
)
with check (
  exists (select 1 from public.listings l
           where l.id = leads.listing_id
             and ((select auth.uid()) = l.owner_id or (select auth.uid()) = l.agent_id))
);

-- De tabelbrede UPDATE stond op alle zeventien kolommen, en ook voor anon.
-- Een aanbieder hoort de fase en zijn eigen aantekeningen te kunnen zetten,
-- niet de naam, het bericht of het e-mailadres van de aanvrager te kunnen
-- herschrijven. anon had geen updateregel en kon dus al niets, maar een recht
-- dat niemand nodig heeft hoort niet uitgedeeld te zijn.
revoke update on public.leads from anon;
revoke update on public.leads from authenticated;
grant update (stage, contacted_at, note, lost_reason, assigned_to)
  on public.leads to authenticated;

-- 2. Bezoekcijfers ---------------------------------------------------------
--    bump_listing_views() schrijft bij elke objectpagina een rij in
--    listing_views, en rollup_listing_views() telt die op bij listings.views.
--    Alleen: die rollup stond in GEEN ENKELE cron-taak. Hij heeft dus nooit
--    gedraaid, listing_views groeide door en listings.views bleef nul. Elke
--    "0 views" in het dashboard was daarmee onwaar in plaats van leeg.
--
--    Tegelijk verdween met de rollup ook de geschiedenis: hij ruimde de ruwe
--    rijen op zonder er iets van te bewaren. Voor een aanbieder die wil zien
--    of het beter of slechter gaat is één totaal te weinig, dus komen er
--    dagtotalen bij.
create table if not exists public.listing_view_days (
  listing_id uuid not null references public.listings(id) on delete cascade,
  day        date not null,
  views      integer not null default 0,
  primary key (listing_id, day)
);

comment on table public.listing_view_days is
  'Dagtotalen van de bezoeken per advertentie, gevuld door rollup_listing_views(). listing_views is de ruwe buffer van één dag; deze tabel is het geheugen. Alleen leesbaar voor de eigenaar/agent van de advertentie en voor een admin.';

alter table public.listing_view_days enable row level security;

drop policy if exists "listing view days owner read" on public.listing_view_days;
create policy "listing view days owner read" on public.listing_view_days
for select using (
  exists (select 1 from public.listings l
           where l.id = listing_view_days.listing_id
             and ((select auth.uid()) = l.owner_id or (select auth.uid()) = l.agent_id))
  or (select public.is_admin())
);

revoke all on public.listing_view_days from anon;
revoke all on public.listing_view_days from authenticated;
grant select on public.listing_view_days to authenticated;

create index if not exists listing_view_days_day_idx on public.listing_view_days (day);

create or replace function public.rollup_listing_views()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cut  timestamptz := now();
  v_rows integer;
begin
  /* Eerst de dagtotalen wegschrijven, dan pas de teller op de advertentie,
     dan pas opruimen. Draait de taak twee keer op een dag, dan telt hij de
     tweede keer alleen op wat er sinds de eerste keer bij kwam — de ruwe
     rijen zijn dan immers al weg.

     Banjul ligt op UTC, dus 'at time zone UTC' geeft hier dezelfde dag als de
     kalender van de aanbieder. Staat er ooit een tweede land bij, dan is dit
     de regel die mee moet. */
  insert into listing_view_days (listing_id, day, views)
  select listing_id, ((seen_at at time zone 'UTC')::date), count(*)
    from listing_views
   where seen_at <= v_cut
   group by 1, 2
  on conflict (listing_id, day)
    do update set views = listing_view_days.views + excluded.views;

  update listings l
     set views = coalesce(l.views, 0) + c.n
    from (select listing_id, count(*) as n
            from listing_views where seen_at <= v_cut group by 1) c
   where l.id = c.listing_id;

  delete from listing_views where seen_at <= v_cut;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$function$;

-- 02:10, voor de marktindex van 02:45 en ruim na middernacht, zodat een dag
-- in listing_view_days ook echt een hele dag is.
select cron.schedule('listing-views-rollup', '10 2 * * *', 'select public.rollup_listing_views()');
