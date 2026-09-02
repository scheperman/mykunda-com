-- =============================================================
-- 20260902_03_agency_logo_policy_fix.sql
--
-- Correctie op 20260902_02. Daar stond in alle drie de schrijfregels:
--
--     (storage.foldername(a.name))[1]
--
-- `a` is het alias van public.agencies, en agencies HEEFT een kolom
-- `name`. Postgres pakt de binnenste scope, dus de regel vroeg de
-- mapnaam van de BEDRIJFSNAAM op in plaats van van het bestandspad.
-- Dat levert nooit een agency-id op, dus elke upload eindigde op
-- "new row violates row-level security policy" (403).
--
-- Gemeten met een echt agent-testaccount op 02-09-2026: het kantoor
-- werd wel aangemaakt, het logo kwam er niet in. De regel voor
-- listing-photos doet het goed en schrijft `objects.name`; dat is hier
-- overgenomen.
--
-- Terugdraaien: drop de drie policies.
-- =============================================================

drop policy if exists "agency logos member write" on storage.objects;
create policy "agency logos member write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(objects.name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));

drop policy if exists "agency logos member update" on storage.objects;
create policy "agency logos member update" on storage.objects
  for update to authenticated
  using (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(objects.name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));

drop policy if exists "agency logos member delete" on storage.objects;
create policy "agency logos member delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'agency-logos' and exists (
    select 1 from public.agencies a
     where a.id::text = (storage.foldername(objects.name))[1]
       and (a.created_by = auth.uid()
            or exists (select 1 from public.profiles p
                        where p.id = auth.uid() and p.agency_id = a.id)
            or public.is_admin())));
