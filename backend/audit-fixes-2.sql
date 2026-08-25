-- ============================================================
--  MyKunda — wat er na de eerste ronde nog open stond
--  14 augustus 2026 · draaien in de SQL-editor van Supabase
--
--  backend/audit-fixes.sql is al gedraaid: secties 2, 3, 4, 6 en 7
--  zijn bevestigd door de adviseur. Dit bestand bevat alleen de rest:
--
--    1 · de gecorrigeerde cronjob-fix   (was fout, zie hieronder)
--    2 · profiles insert terug naar admin-only
--    3 · de policy op fx_rate_rejects
--    4 · de index op viewings.buyer_id
--
--  Idempotent: twee keer draaien verandert niets.
--  Niet meer nodig: sectie 1 (spatial_ref_sys) kan niet vanaf hier —
--  de tabel is eigendom van supabase_admin. En het vinkje "Leaked
--  password protection" staat onder Authentication → Policies.
-- ============================================================


-- ------------------------------------------------------------
--  1 · De botsende market-index cronjobs — GECORRIGEERDE VERSIE
--
--  De eerste versie las het bestaande cron-commando en herschreef het
--  met een reguliere expressie. Dat was fout. Het commando bestaat uit
--  vier losse "select …();"-regels en de expressie was verankerd aan
--  het begin van de tekst, dus alleen de eerste werd PERFORM. PL/pgSQL
--  weigert een kale SELECT zonder bestemming: de taak zou daarna élke
--  nacht op een syntaxfout zijn gevallen in plaats van ongeveer om de
--  dag — erger dan de fout die hij moest oplossen.
--
--  Het commando staat nu voluit, gecontroleerd tegen de echte job.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-index-daily') then
    perform cron.unschedule('market-index-daily');
    raise notice '1 · dubbele job market-index-daily uitgeschakeld';
  else
    raise notice '1 · market-index-daily bestond al niet meer';
  end if;

  perform cron.schedule(
    'market-index-nightly',
    '45 2 * * *',
    $job$
      do $lock$
      begin
        perform pg_advisory_xact_lock(4711001);
        perform public.market_dedup();
        perform public.market_build_month(current_date);
        perform public.market_recompute_derived();
        perform public.market_recompute_real();
      end
      $lock$;
    $job$
  );
  raise notice '1 · market-index-nightly herschreven met advisory lock';
end $$;

-- Controleren:
--   select jobid, jobname, schedule, command from cron.job order by jobname;
-- En morgenochtend, de plek waar een mislukte run zichtbaar wordt:
--   select jobname, status, return_message, start_time
--     from cron.job_run_details d join cron.job j using (jobid)
--    order by start_time desc limit 20;


-- ------------------------------------------------------------
--  2 · profiles: invoegen weer alleen voor admins
--
--  De herschreven policy stond invoegen ook toe aan de gebruiker zelf
--  ((select auth.uid()) = id). Waarschijnlijk onschuldig — de trigger
--  die bij aanmelden een profiel aanmaakt is SECURITY DEFINER en gaat
--  buiten RLS om — maar het was een wijziging in rechten, terwijl de
--  hele sectie juist bedoeld was om alles gelijk te houden. Terug naar
--  wat de oude "profiles admin all"-policy toestond.
-- ------------------------------------------------------------
drop policy if exists "profiles insert" on public.profiles;
create policy "profiles insert" on public.profiles for insert
  with check ((select public.is_admin()));


-- ------------------------------------------------------------
--  3 · fx_rate_rejects: de policy die de adviseur nog meldt
--
--  Overgeslagen in de eerste ronde. Dezelfde per-rij herevaluatie van
--  auth.uid() als de negen policies die wél zijn aangepast. De tabel is
--  leeg, dus er zat geen haast bij — maar dan is de lijst ook leeg.
--  Rechten ongewijzigd: alleen lezen, alleen voor admins.
-- ------------------------------------------------------------
drop policy if exists "fx rejects admin only" on public.fx_rate_rejects;
create policy "fx rejects admin only" on public.fx_rate_rejects for select
  using (exists (select 1 from public.profiles p
                  where p.id = (select auth.uid()) and p.role = 'admin'));


-- ------------------------------------------------------------
--  4 · De foreign key die de adviseur ná de eerste ronde vond
--  Zelfde soort fix als de vijf indexen uit sectie 3.
-- ------------------------------------------------------------
create index if not exists viewings_buyer_idx on public.viewings(buyer_id);


-- ------------------------------------------------------------
--  Daarna nog open, geen SQL:
--   · spatial_ref_sys — RLS aanzetten kan alleen de eigenaar
--     (supabase_admin). Ofwel eigenaarschap laten overzetten via
--     Supabase support, ofwel bewust accepteren: het is
--     coördinatensysteem-referentiedata zonder gebruikersgegevens.
--     Wat wél de moeite is als je het laat staan: de tabel is nu ook
--     schrijfbaar met de anon-sleutel. Dat is het echte risico, niet
--     het lezen.
--   · Leaked password protection — Authentication → Policies.
--   · De betaalkoppeling — de vier ModemPay-webhooks tegenover een
--     lege payments-tabel. Daarvoor zijn de twee tabelschema's nodig.
-- ------------------------------------------------------------
