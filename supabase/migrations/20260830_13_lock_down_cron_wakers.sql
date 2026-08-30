-- ============================================================================
--  MyKunda — de cron-wekkers dichtzetten                      (30-08-2026)
--  Toegepast op jejaerpqltqryqzjvbjp via de Supabase-MCP als migraties
--  'lock_down_cron_wakers' en 'lock_down_cron_wakers_public'. Deze kopie is
--  de bron in de repo.
--
--  Gevonden met de Supabase security advisor na het bouwen van fase 5.
--  De functies die alleen door pg_cron gewekt horen te worden stonden open
--  voor anon en authenticated. Ze zijn SECURITY DEFINER, dus via
--  /rest/v1/rpc/<naam> kon iedere bezoeker onze eigen taken laten draaien.
--  De mails zelf zijn ontdubbeld, dus er ging niets dubbel de deur uit, maar
--  een vreemde hoort onze cron niet te kunnen aftrappen — en zeker geen
--  Resend-quota te kunnen opmaken.
--
--  LET OP: alleen intrekken bij anon en authenticated werkt niet. Postgres
--  geeft een nieuwe functie standaard EXECUTE aan PUBLIC, en beide rollen
--  erven het daarvan. Dus eerst PUBLIC, dan de rollen zelf. De eigenaar
--  (postgres) en service_role houden hun recht, dus pg_cron blijft de taken
--  van 02:10, 07:30, 08:00 en 08:30 gewoon wekken — daarna nagemeten door ze
--  met de hand aan te roepen.
--
--  Bewust NIET dichtgezet: bump_listing_views() en price_history_public().
--  Die roept de site zelf aan, vanuit de browser van een bezoeker.
-- ============================================================================

revoke execute on function public.run_mail_health_check()    from public, anon, authenticated;
revoke execute on function public.run_saved_search_alerts()  from public, anon, authenticated;
revoke execute on function public.run_plan_expiry_notices()  from public, anon, authenticated;
revoke execute on function public.rollup_listing_views()     from public, anon, authenticated;
