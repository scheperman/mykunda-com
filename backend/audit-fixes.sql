-- ============================================================
--  MyKunda — fixes from the Supabase audit of 14 August 2026
--  Run once in the Supabase SQL editor (as the postgres role).
--  Every section is idempotent: running it twice changes nothing.
--
--  STATUS 14 August 2026, verified against the live database:
--    sections 2, 3, 4, 6, 7  applied and confirmed by the advisor
--    section 1               failed — spatial_ref_sys is owned by
--                            supabase_admin, not postgres (see below)
--    section 5               REWRITTEN after review: the first version
--                            would have broken the nightly job every
--                            night. Details in section 5 itself.
--  What is still open now lives in backend/audit-fixes-2.sql.
--
--  Sections raise NOTICEs so you can see what happened.
-- ============================================================


-- ------------------------------------------------------------
--  1 · Row Level Security on public.spatial_ref_sys
--  PostGIS reference data — no personal data, but with RLS off
--  the table is readable AND writable by anyone holding the anon
--  key. Turn RLS on and allow reads only.
--  Needs table ownership. On this project it does NOT work: the table
--  belongs to supabase_admin (the PostGIS extension), not to postgres,
--  so the DO block reports the failure and moves on. Two ways out, both
--  a decision rather than a script:
--    a) ask Supabase support to transfer ownership, or
--    b) accept the risk knowingly — it is coordinate-system reference
--       data, no user data, and the write path is the only real concern.
-- ------------------------------------------------------------
do $$
begin
  execute 'alter table public.spatial_ref_sys enable row level security';
  execute 'drop policy if exists "spatial_ref_sys read" on public.spatial_ref_sys';
  execute 'create policy "spatial_ref_sys read" on public.spatial_ref_sys for select using (true)';
  raise notice '1 · spatial_ref_sys: RLS on, public read policy created';
exception
  when insufficient_privilege then
    raise notice '1 · spatial_ref_sys: skipped — run this section as the table owner (postgres)';
end $$;


-- ------------------------------------------------------------
--  2 · Maintenance functions off the public REST surface
--  Six functions were callable over RPC by anon and authenticated:
--  anyone with the anon key could force expensive recalculations or
--  pollute the market index.
--
--  Postgres grants EXECUTE to PUBLIC by default, so revoking from
--  anon alone does nothing — the PUBLIC grant has to go first.
--
--  rebuild_market_index keeps its `authenticated` grant, because the
--  Recalculate button in market.html calls it and the function already
--  checks profiles.role = 'admin' when a JWT is present. Its hole was
--  the anonymous path: with auth.uid() null that check was skipped.
--  Dropping the PUBLIC/anon grant closes it without touching the body.
-- ------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as sig, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('market_build_month','market_dedup','market_recompute_derived',
                         'market_recompute_real','rebuild_market_index','rls_auto_enable')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname = 'rebuild_market_index' then
      execute format('grant execute on function %s to authenticated, service_role', f.sig);
      raise notice '2 · % — anon revoked, admin console still works', f.sig;
    else
      execute format('revoke execute on function %s from authenticated', f.sig);
      execute format('grant execute on function %s to service_role', f.sig);
      raise notice '2 · % — internal only (cron / service role)', f.sig;
    end if;
  end loop;
end $$;


-- ------------------------------------------------------------
--  3 · Foreign keys without a covering index
--  Harmless at 35 listings, a table scan per join at 3,500.
-- ------------------------------------------------------------
create index if not exists favorites_listing_idx    on public.favorites(listing_id);
create index if not exists leads_assigned_idx       on public.leads(assigned_to);
create index if not exists leads_listing_idx        on public.leads(listing_id);
create index if not exists listings_agent_idx       on public.listings(agent_id);
create index if not exists market_obs_created_by_idx on public.market_observations(created_by);
-- Found by the advisor after the first run, same class of fix:
create index if not exists viewings_buyer_idx        on public.viewings(buyer_id);


-- ------------------------------------------------------------
--  4 · Pin search_path on the three functions that lack it
--  Closes search-path hijacking on wmedian, market_fingerprint and
--  external_fingerprint.
-- ------------------------------------------------------------
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('wmedian','market_fingerprint','external_fingerprint')
  loop
    execute format('alter function %s set search_path = public, pg_temp', f.sig);
    raise notice '4 · search_path pinned on %', f.sig;
  end loop;
end $$;


-- ------------------------------------------------------------
--  5 · The colliding market-index cron jobs
--  market-index-daily and market-index-nightly both ran at 02:45 and
--  both called market_build_month(current_date). The two runs raced on
--  market_snapshots' primary key, so the update failed outright on
--  13 and 14 August — invisibly, since nothing surfaces a failed job.
--
--  Fix: drop the duplicate, and run the surviving job inside a
--  transaction-level advisory lock so any future overlap (a manual
--  rebuild during the nightly run, say) queues instead of erroring.
--
--  REWRITTEN 14 August. The first version read the existing cron
--  command and rewrote it with a regex. That was wrong: the command is
--  four separate "select …();" lines and the regex is anchored to the
--  start of the string, so only the first became PERFORM. PL/pgSQL
--  rejects a bare SELECT without a destination, so the job would have
--  failed every single night instead of roughly every other night —
--  worse than the bug it was fixing. The command is now written out in
--  full, verified against the live job definition.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'market-index-daily') then
    perform cron.unschedule('market-index-daily');
    raise notice '5 · unscheduled the duplicate job market-index-daily';
  else
    raise notice '5 · market-index-daily already gone';
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
  raise notice '5 · market-index-nightly rewritten with an advisory lock';
end $$;

-- What the schedule looks like afterwards:
--   select jobid, jobname, schedule, command from cron.job order by jobname;
-- And the last runs (this is where a failed rollup shows up):
--   select jobname, status, return_message, start_time
--     from cron.job_run_details d join cron.job j using (jobid)
--    order by start_time desc limit 20;


-- ------------------------------------------------------------
--  6 · RLS policies: one policy per action, auth calls hoisted
--
--  Two advisor findings in one rewrite:
--   · auth.uid() / is_admin() called per row instead of once per query
--     — wrapping them in (select …) makes Postgres evaluate them once
--   · several permissive policies for the same action on the same table
--     — merged into a single policy per action
--
--  The permission logic is deliberately unchanged: same access, fewer
--  evaluations. Compare with backend/schema.sql if you want to check.
-- ------------------------------------------------------------

-- ---- profiles ----
drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles admin all"  on public.profiles;
drop policy if exists "profiles select"     on public.profiles;
drop policy if exists "profiles insert"     on public.profiles;
drop policy if exists "profiles update"     on public.profiles;
drop policy if exists "profiles delete"     on public.profiles;
create policy "profiles select" on public.profiles for select
  using ((select auth.uid()) = id or (select public.is_admin()));
-- Admin only, exactly as the old "profiles admin all" policy had it. The
-- first version also allowed (select auth.uid()) = id, which reads as
-- harmless — the signup trigger is SECURITY DEFINER and bypasses RLS
-- anyway — but it was a change in rights, not the same behaviour.
create policy "profiles insert" on public.profiles for insert
  with check ((select public.is_admin()));
create policy "profiles update" on public.profiles for update
  using ((select auth.uid()) = id or (select public.is_admin()));
create policy "profiles delete" on public.profiles for delete
  using ((select public.is_admin()));

-- ---- listings ----
drop policy if exists "listings public read"  on public.listings;
drop policy if exists "listings owner read"   on public.listings;
drop policy if exists "listings owner write"  on public.listings;
drop policy if exists "listings owner update" on public.listings;
drop policy if exists "listings admin all"    on public.listings;
drop policy if exists "listings select"       on public.listings;
drop policy if exists "listings insert"       on public.listings;
drop policy if exists "listings update"       on public.listings;
drop policy if exists "listings delete"       on public.listings;
create policy "listings select" on public.listings for select
  using (
    status in ('active','under_offer')
    or (select auth.uid()) = owner_id
    or (select auth.uid()) = agent_id
    or (select public.is_admin())
  );
create policy "listings insert" on public.listings for insert
  with check ((select auth.uid()) = owner_id or (select public.is_admin()));
create policy "listings update" on public.listings for update
  using ((select auth.uid()) = owner_id or (select public.is_admin()));
create policy "listings delete" on public.listings for delete
  using ((select public.is_admin()));

-- ---- listing_media ----
drop policy if exists "media public photos" on public.listing_media;
drop policy if exists "media owner all"     on public.listing_media;
drop policy if exists "media select"        on public.listing_media;
drop policy if exists "media insert"        on public.listing_media;
drop policy if exists "media update"        on public.listing_media;
drop policy if exists "media delete"        on public.listing_media;
create policy "media select" on public.listing_media for select
  using (
    (is_document = false
     and exists (select 1 from public.listings l
                  where l.id = listing_id and l.status in ('active','under_offer')))
    or (select public.is_admin())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.owner_id = (select auth.uid()))
  );
create policy "media insert" on public.listing_media for insert
  with check (
    (select public.is_admin())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.owner_id = (select auth.uid()))
  );
create policy "media update" on public.listing_media for update
  using (
    (select public.is_admin())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.owner_id = (select auth.uid()))
  );
create policy "media delete" on public.listing_media for delete
  using (
    (select public.is_admin())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.owner_id = (select auth.uid()))
  );

-- ---- leads ----
drop policy if exists "leads insert anyone" on public.leads;
drop policy if exists "leads admin read"    on public.leads;
drop policy if exists "leads admin update"  on public.leads;
drop policy if exists "leads staff read"    on public.leads;
drop policy if exists "leads staff update"  on public.leads;
create policy "leads insert anyone" on public.leads for insert with check (true);
create policy "leads staff read"    on public.leads for select
  using ((select public.is_admin()) or (select auth.uid()) = assigned_to);
create policy "leads staff update"  on public.leads for update
  using ((select public.is_admin()) or (select auth.uid()) = assigned_to);

-- ---- viewings ----
drop policy if exists "viewings insert anyone" on public.viewings;
drop policy if exists "viewings party read"    on public.viewings;
drop policy if exists "viewings party update"  on public.viewings;
create policy "viewings insert anyone" on public.viewings for insert with check (true);
create policy "viewings party read" on public.viewings for select
  using (
    (select public.is_admin())
    or (select auth.uid()) = buyer_id
    or exists (select 1 from public.listings l
                where l.id = listing_id
                  and (l.owner_id = (select auth.uid()) or l.agent_id = (select auth.uid())))
  );
create policy "viewings party update" on public.viewings for update
  using (
    (select public.is_admin())
    or (select auth.uid()) = buyer_id
    or exists (select 1 from public.listings l
                where l.id = listing_id
                  and (l.owner_id = (select auth.uid()) or l.agent_id = (select auth.uid())))
  );

-- ---- favorites & saved searches ----
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all
  using ((select auth.uid()) = user_id);
drop policy if exists "saved own" on public.saved_searches;
create policy "saved own" on public.saved_searches for all
  using ((select auth.uid()) = user_id);

-- ---- fx_rate_rejects ----
-- Missed the first time; the advisor still flags it. Empty table, so no
-- hurry, but it carries the same per-row auth.uid() re-evaluation.
drop policy if exists "fx rejects admin only" on public.fx_rate_rejects;
create policy "fx rejects admin only" on public.fx_rate_rejects for select
  using (exists (select 1 from public.profiles p
                  where p.id = (select auth.uid()) and p.role = 'admin'));


-- ------------------------------------------------------------
--  7 · The abandoned empty drafts
--  22 of 24 drafts hold nothing but a category name with a leading
--  space and a price of 0 — rows the old listing wizard created the
--  moment a seller picked a property type. list.html no longer writes
--  a row until there is a location and an asking price, so this is a
--  one-off clean-up.
--
--  Archived rather than deleted: nothing is lost, and the review
--  screens and reporting stop counting them.
--
--  RUN THE SELECT FIRST and look at what it returns.
-- ------------------------------------------------------------
-- select id, title, price, created_at from public.listings
--  where status = 'draft'
--    and coalesce(price, 0) = 0
--    and (title is null or btrim(title) = '' or title <> btrim(title))
--    and created_at < now() - interval '7 days'
--  order by created_at;

update public.listings
   set status = 'archived', updated_at = now()
 where status = 'draft'
   and coalesce(price, 0) = 0
   and (title is null or btrim(title) = '' or title <> btrim(title))
   and created_at < now() - interval '7 days';


-- ------------------------------------------------------------
--  8 · Not SQL — two settings in the Supabase dashboard
--   · Authentication → Policies: switch on "Leaked password
--     protection" (checks new passwords against HaveIBeenPwned).
--   · Database → Extensions: PostGIS sits in the public schema. Moving
--     it to its own schema is the textbook recommendation, but it
--     rewrites every geography column reference — worth doing during a
--     planned maintenance window, not casually.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
--  Still open after this script (needs the payment code, which does
--  not live in this project):
--   · 4 ModemPay charge.succeeded webhooks with applied = false and
--     payment_id = null, against an empty payments table. The matching
--     logic in create-payment / modem-webhook has to be read before
--     anything is changed here.
-- ------------------------------------------------------------
