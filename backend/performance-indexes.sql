-- ============================================================================
-- MyKunda — performance: indexen, view-teller en zoekindex
-- 15 augustus 2026 · hoort bij Performance-audit.html
--
-- Uitvoeren in Supabase → SQL Editor, in één keer, in deze volgorde.
-- Alles is idempotent: je kunt het script veilig twee keer draaien.
-- CREATE INDEX CONCURRENTLY kan niet in een transactie; draai daarom elk
-- blok apart als de editor klaagt over "cannot run inside a transaction block".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · De indexen die elke listing-query nodig heeft
--
-- Zonder deze leest Postgres de hele tabel bij elke zoekopdracht. Bij een paar
-- honderd rijen merk je dat niet; bij tienduizend is de zoekpagina traag voor
-- iedereen tegelijk. Ze kosten schijfruimte en niets anders.
-- ----------------------------------------------------------------------------

-- de standaardsortering van elke lijst: nieuwste actieve listing eerst
create index if not exists listings_status_created_idx
  on listings (status, created_at desc);

-- prijsfilter en prijssortering
create index if not exists listings_status_price_idx
  on listings (status, price);

-- kind + category zitten in vrijwel elk filter
create index if not exists listings_kind_category_idx
  on listings (kind, category);

-- gebiedspagina's: fetchAreaListings() doet ilike op area
create index if not exists listings_area_lower_idx
  on listings (lower(area));

-- "mijn listings" in het dashboard
create index if not exists listings_owner_idx
  on listings (owner_id, created_at desc);

-- de join die bij elke kaart hoort
create index if not exists listing_media_listing_idx
  on listing_media (listing_id, sort);

-- berichten: de query achter elke conversatie en achter de ongelezen-badge
create index if not exists messages_conversation_idx
  on messages (conversation_id, created_at);
create index if not exists messages_unread_idx
  on messages (conversation_id, sender_id) where read_at is null;

-- conversaties van één gebruiker (de or(...) op beide deelnemers)
create index if not exists conversations_a_idx on conversations (participant_a, last_at desc);
create index if not exists conversations_b_idx on conversations (participant_b, last_at desc);

-- favorieten en opgeslagen zoekopdrachten
create index if not exists favorites_user_idx      on favorites (user_id);
create index if not exists saved_searches_user_idx on saved_searches (user_id);

-- leads in het backoffice
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_listing_idx on leads (listing_id);


-- ----------------------------------------------------------------------------
-- 2 · Vrij-tekst zoeken dat een index kan gebruiken
--
-- De site zoekt nu met ilike '%term%' over vier kolommen. Een leading wildcard
-- sluit elke gewone index uit, dus dat is altijd een volledige tabelscan.
-- pg_trgm lost dat op: een GIN-index op trigrammen bedient wél '%term%'.
-- ----------------------------------------------------------------------------

create extension if not exists pg_trgm;

create index if not exists listings_search_trgm_idx on listings
  using gin (
    (coalesce(title,'') || ' ' || coalesce(area,'') || ' ' ||
     coalesce(street,'') || ' ' || coalesce(description,'')) gin_trgm_ops
  );

-- Controle: dit moet "Bitmap Index Scan on listings_search_trgm_idx" tonen,
-- niet "Seq Scan on listings".
--
-- explain analyze
-- select id, title from listings
--  where (coalesce(title,'')||' '||coalesce(area,'')||' '||
--         coalesce(street,'')||' '||coalesce(description,'')) ilike '%kololi%';


-- ----------------------------------------------------------------------------
-- 3 · Bekeken-teller zonder rijvergrendeling
--
-- bump_listing_views doet nu een UPDATE op de listing zelf, bij elke pageview.
-- Wordt een listing populair, dan staan alle bezoekers in de rij voor dezelfde
-- row lock — precies bij de listing waar je dat niet wil. Oplossing: schrijven
-- naar een append-only tabel (nooit een conflict) en één keer per nacht
-- optellen naar de teller die de site laat zien.
-- ----------------------------------------------------------------------------

create table if not exists listing_views (
  id          bigserial primary key,
  listing_id  uuid not null references listings(id) on delete cascade,
  seen_at     timestamptz not null default now()
);

create index if not exists listing_views_pending_idx
  on listing_views (listing_id, seen_at);

alter table listing_views enable row level security;

-- Alleen inserts, door iedereen, en niemand mag terugkijken. Een bezoeker kan
-- dus wel een view registreren maar niet uitlezen hoe vaak iets bekeken is.
drop policy if exists listing_views_insert on listing_views;
create policy listing_views_insert on listing_views
  for insert to anon, authenticated with check (true);

-- Vervangt de oude UPDATE-versie. Zelfde naam en zelfde aanroep, dus de
-- frontend hoeft niet te wijzigen.
create or replace function bump_listing_views(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into listing_views (listing_id) values (p_id);
$$;

grant execute on function bump_listing_views(uuid) to anon, authenticated;

-- De nachtelijke rollup: telt op en ruimt op wat is verwerkt.
create or replace function rollup_listing_views()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cut timestamptz := now();
  v_rows integer;
begin
  with counted as (
    select listing_id, count(*) as n
      from listing_views
     where seen_at <= v_cut
     group by listing_id
  )
  update listings l
     set views = coalesce(l.views, 0) + c.n
    from counted c
   where l.id = c.listing_id;

  delete from listing_views where seen_at <= v_cut;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Eén keer per nacht meeliften op de cron die de marktindex herbouwt:
--   select cron.schedule('rollup-listing-views', '15 2 * * *',
--                        $$select rollup_listing_views()$$);
--
-- Heeft de listings-tabel nog geen views-kolom, dan eerst:
--   alter table listings add column if not exists views integer not null default 0;


-- ----------------------------------------------------------------------------
-- 4 · Controleer dat Realtime niet meer leest dan mag
--
-- De frontend abonneert nu per conversatie in plaats van op de hele tabel
-- (zie supabase.js, subscribeToAllMessages). Postgres moet dat afdwingen,
-- niet de browser. Deze twee dingen moeten kloppen:
--
--   a) RLS staat aan op messages en conversations;
--   b) Realtime respecteert die policies — in Supabase staat dat onder
--      Database → Replication, en de publicatie moet de tabel bevatten
--      met RLS ingeschakeld.
--
-- Uitvoeren en nalopen: rowsecurity moet true zijn voor beide tabellen.
-- ----------------------------------------------------------------------------

select relname, relrowsecurity as rls_aan
  from pg_class
 where relname in ('messages','conversations','leads','listings','profiles');

-- En welke policies er precies liggen:
select tablename, policyname, cmd, roles
  from pg_policies
 where tablename in ('messages','conversations')
 order by tablename, policyname;


-- ----------------------------------------------------------------------------
-- 5 · Statistieken bijwerken, zodat de planner de nieuwe indexen gebruikt
-- ----------------------------------------------------------------------------

analyze listings;
analyze listing_media;
analyze messages;
analyze conversations;
