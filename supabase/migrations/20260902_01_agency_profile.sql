-- =============================================================
-- 20260902_01_agency_profile.sql
-- Het bedrijfsprofiel van een professionele aanbieder: logo of foto,
-- een eigen website, en het recht om dat zelf te beheren.
--
-- UITGEVOERD op 02-09-2026, op lege tabellen (0 agencies, 0 listings).
-- Er verplaatst zich dus geen enkele rij.
--
-- Wat er mis was en hier wordt rechtgezet:
--   * agencies had al logo_path, about, phone, whatsapp, email en areas,
--     maar geen website — en er was geen enkel scherm dat een van die
--     velden schreef.
--   * De regel "agencies update" liet alleen een beheerder door, of een
--     profiel met profiles.agency_id gelijk aan het kantoor. Die kolom kan
--     een gebruiker niet zelf zetten (kolomrechten op profiles), dus kon
--     in de praktijk NIEMAND behalve een beheerder een kantoor bijwerken.
--     Het profiel was onbeheerbaar.
--
-- Terugdraaien: drop de kolom website (en de check), en zet de oude
-- policy terug zonder de created_by-tak.
-- =============================================================

-- ---------- 1. de eigen website van het kantoor ----------
alter table public.agencies add column if not exists website text;

comment on column public.agencies.website is
  'De eigen website van het kantoor, zoals de aanbieder hem opgeeft. Staat op de advertentiepagina als externe link met rel="nofollow ugc noopener". Alleen http(s); de check houdt javascript:, data: en losse tekst tegen.';

alter table public.agencies drop constraint if exists agencies_website_http;
alter table public.agencies add constraint agencies_website_http
  check (website is null or website ~* '^https?://[^\s/$.?#][^\s]*$');

comment on column public.agencies.logo_path is
  'Pad in de publieke bucket agency-logos, vorm <agency_id>/<bestand>. Mag een logo of een foto van het bedrijf zijn; de weergave schaalt binnen het kader in plaats van bij te snijden, zodat een breed logo heel blijft.';

-- ---------- 2. wie zijn eigen kantoor mag bijwerken ----------
-- De oprichter van de rij komt erbij. De tak op profiles.agency_id blijft
-- staan: die is de weg voor een tweede medewerker, zodra er een team is.
drop policy if exists "agencies update" on public.agencies;
create policy "agencies update" on public.agencies
  for update to authenticated
  using (
    (select public.is_admin())
    or created_by = (select auth.uid())
    or exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.agency_id = agencies.id)
  )
  with check (
    (select public.is_admin())
    or created_by = (select auth.uid())
    or exists (select 1 from public.profiles p
                where p.id = (select auth.uid()) and p.agency_id = agencies.id)
  );

-- ---------- 3. de opslag voor logo's ----------
-- Publiek leesbaar zoals listing-photos: het logo staat op een openbare
-- advertentiepagina. 2 MB is ruim voor een logo en te krap om er een
-- fotoalbum in te verstoppen. SVG staat er bewust NIET bij — een SVG kan
-- script bevatten en wordt door de opslag met zijn eigen content-type
-- geserveerd.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('agency-logos','agency-logos', true, 2097152,
        array['image/jpeg','image/png','image/webp','image/avif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- De leesregels op die bucket staan in 20260902_02_agency_logo_storage.sql.
-- Zonder dat bestand kan er niets geüpload worden.
