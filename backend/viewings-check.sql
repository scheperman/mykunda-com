-- ============================================================
--  MyKunda — viewings: controle + reparatie (idempotent)
--  Datum: 20-08-2026
--  Hoort bij: property.html / dashboard.html / supabase.js
--             (bezichtiging aanvragen, accepteren, tijden voorstellen)
--
--  Veilig om meerdere keren uit te voeren. Wijzigt geen data.
--  Nodig alleen als backend/schema.sql niet (volledig) is gedraaid.
-- ============================================================

-- 1) statuswaarden die de site gebruikt
do $$ begin
  create type viewing_status as enum
    ('requested','slots_proposed','confirmed','declined','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin alter type viewing_status add value if not exists 'requested';      exception when others then null; end $$;
do $$ begin alter type viewing_status add value if not exists 'slots_proposed'; exception when others then null; end $$;
do $$ begin alter type viewing_status add value if not exists 'confirmed';      exception when others then null; end $$;

-- 2) kolommen die de site schrijft en leest
alter table public.viewings add column if not exists buyer_name     text;
alter table public.viewings add column if not exists buyer_email    text;
alter table public.viewings add column if not exists buyer_phone    text;
alter table public.viewings add column if not exists requested_slot timestamptz;
alter table public.viewings add column if not exists proposed_slots timestamptz[] default '{}';
alter table public.viewings add column if not exists chosen_slot    timestamptz;
alter table public.viewings add column if not exists note           text;

-- 3) RLS: bezoeker mag aanvragen, alleen de betrokkenen mogen lezen en bijwerken
alter table public.viewings enable row level security;

drop policy if exists "viewings insert anyone" on public.viewings;
drop policy if exists "viewings party read"    on public.viewings;
drop policy if exists "viewings party update"  on public.viewings;

create policy "viewings insert anyone" on public.viewings
  for insert with check (true);

create policy "viewings party read" on public.viewings
  for select using (
    public.is_admin()
    or buyer_id = auth.uid()
    or exists (select 1 from public.listings l
                where l.id = listing_id
                  and (l.owner_id = auth.uid() or l.agent_id = auth.uid()))
  );

-- Deze policy is wat "Accept" en "Change" in het dashboard laat werken:
-- zonder UPDATE-recht voor de eigenaar doet de knop niets.
create policy "viewings party update" on public.viewings
  for update using (
    public.is_admin()
    or exists (select 1 from public.listings l
                where l.id = listing_id
                  and (l.owner_id = auth.uid() or l.agent_id = auth.uid()))
  );

create index if not exists viewings_listing_idx on public.viewings(listing_id);

-- 4) controle achteraf — verwacht: drie policies, alle kolommen aanwezig
select policyname, cmd from pg_policies
 where schemaname='public' and tablename='viewings' order by policyname;

select column_name, data_type from information_schema.columns
 where table_schema='public' and table_name='viewings' order by ordinal_position;
