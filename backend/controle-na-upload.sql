-- ============================================================================
-- MyKunda — controle na het uitvoeren van performance-indexes.sql
-- Uitvoeren in Supabase → SQL Editor. Puur lezend: dit script wijzigt niets.
--
-- Elk blok zegt in gewone taal of het goed staat. Kijk naar de kolom "status".
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1 · Staan alle indexen er?  (verwacht: 17 regels, allemaal "aanwezig")
-- ----------------------------------------------------------------------------
with verwacht(naam) as (values
  ('listings_status_created_idx'), ('listings_status_price_idx'),
  ('listings_kind_category_idx'),  ('listings_area_lower_idx'),
  ('listings_owner_idx'),          ('listing_media_listing_idx'),
  ('messages_conversation_idx'),   ('messages_unread_idx'),
  ('conversations_a_idx'),         ('conversations_b_idx'),
  ('favorites_user_idx'),          ('saved_searches_user_idx'),
  ('leads_created_idx'),           ('leads_listing_idx'),
  ('listings_search_trgm_idx'),    ('listing_views_pending_idx')
)
select v.naam,
       case when i.indexname is null then '>>> ONTBREEKT' else 'aanwezig' end as status
  from verwacht v
  left join pg_indexes i on i.indexname = v.naam
 order by status, v.naam;


-- ----------------------------------------------------------------------------
-- 2 · Is de trigram-extensie geïnstalleerd?  (verwacht: 1 regel)
-- ----------------------------------------------------------------------------
select extname, 'aanwezig' as status from pg_extension where extname = 'pg_trgm';


-- ----------------------------------------------------------------------------
-- 3 · Gebruikt de zoekquery de nieuwe index ook echt?
--
-- Kijk in de uitvoer naar de eerste regels. Goed is: "Bitmap Index Scan on
-- listings_search_trgm_idx". Staat er "Seq Scan on listings", dan pakt de
-- planner hem niet — draai dan eerst  analyze listings;  en probeer opnieuw.
--
-- Let op: bij een vrijwel lege tabel kiest Postgres altijd een Seq Scan, simpelweg
-- omdat dat sneller is. Dat is geen fout. Deze controle is pas zinvol vanaf
-- enkele duizenden rijen.
-- ----------------------------------------------------------------------------
explain analyze
select id, title from listings
 where (coalesce(title,'') || ' ' || coalesce(area,'') || ' ' ||
        coalesce(street,'') || ' ' || coalesce(description,'')) ilike '%kololi%';


-- ----------------------------------------------------------------------------
-- 4 · Is de bekeken-teller omgezet naar append-only?
--
-- Verwacht:
--   listing_views bestaat        -> ja
--   bump_listing_views doet nu   -> insert   (niet: update)
--   rollup_listing_views bestaat -> ja
--   listings.views bestaat       -> ja
-- ----------------------------------------------------------------------------
select
  (select count(*) > 0 from information_schema.tables
    where table_name = 'listing_views')                       as listing_views_bestaat,
  (select case when pg_get_functiondef(p.oid) ilike '%insert into listing_views%'
               then 'insert (goed)' else '>>> nog de oude UPDATE-versie' end
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'bump_listing_views' and n.nspname = 'public'
    limit 1)                                                  as bump_doet_nu,
  (select count(*) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'rollup_listing_views' and n.nspname = 'public') as rollup_bestaat,
  (select count(*) > 0 from information_schema.columns
    where table_name = 'listings' and column_name = 'views')   as views_kolom_bestaat;


-- ----------------------------------------------------------------------------
-- 5 · DE BELANGRIJKSTE: staat row-level security aan?
--
-- Zonder RLS op messages is de frontend de enige verdediging, en dat is te
-- weinig. Alle regels hieronder moeten "AAN" zeggen.
-- ----------------------------------------------------------------------------
select c.relname as tabel,
       case when c.relrowsecurity then 'AAN' else '>>> UIT — DIT MOET AAN' end as rls,
       (select count(*) from pg_policies p where p.tablename = c.relname) as policies
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
   and c.relname in ('messages','conversations','listings','profiles','leads',
                     'favorites','saved_searches','listing_media','listing_views')
 order by c.relrowsecurity, c.relname;


-- ----------------------------------------------------------------------------
-- 6 · Welke tabellen staan in de Realtime-publicatie?
--
-- messages hoort hier te staan (de berichtenpagina heeft het nodig) — maar dan
-- moet RLS op messages in blok 5 op AAN staan. Staat messages hier wél en is RLS
-- daar UIT, dan is dat het te repareren gat.
-- ----------------------------------------------------------------------------
select tablename as in_realtime_publicatie
  from pg_publication_tables
 where pubname = 'supabase_realtime'
 order by tablename;


-- ----------------------------------------------------------------------------
-- 7 · Wat de nieuwe indexen aan het doen zijn
--
-- idx_scan = hoe vaak de planner de index gebruikt heeft. Direct na het
-- aanmaken staat alles op 0; dat is normaal. Kom hier na een week terug: een
-- index die dan nog op 0 staat, doet niets en mag weg.
-- ----------------------------------------------------------------------------
select relname as tabel, indexrelname as index, idx_scan as keer_gebruikt,
       pg_size_pretty(pg_relation_size(indexrelid)) as grootte
  from pg_stat_user_indexes
 where schemaname = 'public'
 order by idx_scan desc, relname;
