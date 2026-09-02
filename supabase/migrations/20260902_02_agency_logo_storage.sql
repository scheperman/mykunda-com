-- =============================================================
-- 20260902_02_agency_logo_storage.sql
-- De leesregels en schrijfregels op de bucket agency-logos, plus het
-- dichtzetten van de kolomrechten op agencies.
--
-- NOG NIET UITGEVOERD. Deze drie soorten wijziging — rechten op een
-- tabel, en beleid op storage.objects — moet een mens zelf uitvoeren.
-- Plakken in de SQL Editor van Supabase (project jejaerpqltqryqzjvbjp)
-- en draaien. Zonder deel A kan een kantoor geen logo uploaden.
--
-- Terugdraaien: drop de vier policies; en `grant update on public.agencies
-- to authenticated` zet het oude, ruimere schrijfrecht terug.
-- =============================================================

-- ---------- A. schrijven en lezen in de bucket agency-logos ----------
-- Iedereen mag het logo zien: het staat op een openbare advertentiepagina.
drop policy if exists "agency logos public read" on storage.objects;
create policy "agency logos public read" on storage.objects
  for select to public
  using (bucket_id = 'agency-logos');

-- Schrijven mag alleen in de map die de naam van je eigen kantoor draagt.
drop policy if exists "agency logos member write" on storage.objects;
create policy "agency logos member write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));

drop policy if exists "agency logos member update" on storage.objects;
create policy "agency logos member update" on storage.objects
  for update to authenticated
  using (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));

drop policy if exists "agency logos member delete" on storage.objects;
create policy "agency logos member delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));

-- ---------- B. kolomrechten op agencies ----------
-- Tot nu mocht authenticated ELKE kolom van agencies schrijven, ook id,
-- slug en created_by — de trigger agencies_guard_verification beschermt
-- alleen de licentie- en verificatievelden. Hierna kan een kantoor alleen
-- nog zeggen wat het over zichzelf zegt.
--
-- De licentie- en verificatievelden staan er wél bij, omdat een beheerder
-- ze via dezelfde client zet; de trigger draait ze voor iedere
-- niet-beheerder meteen terug naar de oude waarde.
--
-- Nieuwe rechten erven van PUBLIC, dus daar ook intrekken (les 30-08-2026).
revoke update on public.agencies from public, anon, authenticated;
revoke insert, delete on public.agencies from anon;

grant update (name, about, phone, whatsapp, email, website, logo_path, areas,
              licence_no, licence_body, licence_expires_on, verified_at, verified_by)
  on public.agencies to authenticated;
