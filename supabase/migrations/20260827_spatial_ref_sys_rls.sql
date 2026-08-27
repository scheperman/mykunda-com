-- MyKunda — spatial_ref_sys achter RLS, 27-08-2026
--
-- STATUS: NIET TOEGEPAST. Geprobeerd op 27-08-2026, de server antwoordde:
--   ERROR: 42501: must be owner of table spatial_ref_sys
-- De tabel is eigendom van de postgis-extensie (supabase_admin), niet van de
-- postgres-rol. Met eigenaarsrechten gaan schuiven om een INFO-risico op een
-- publieke referentietabel weg te poetsen is de moeite en het risico niet waard.
-- Laat staan, of vraag het aan Supabase-support als de linter je stoort.
--
-- De linter markeert public.spatial_ref_sys als critical: RLS staat uit, dus de
-- tabel ligt open voor de anon key. Het is een PostGIS-referentietabel met
-- publieke data, dus het lek is klein, maar hij hoort niet open te staan.
--
-- Let op: RLS aanzetten ZONDER policy blokkeert alle leesacties, en PostGIS-
-- functies als ST_Transform lezen deze tabel. Daarom meteen een lees-policy
-- erbij: de linter is tevreden en er kan niets breken.
--
-- Deze tabel is eigendom van de postgis-extensie. Geeft dit "must be owner of
-- table spatial_ref_sys", laat het dan zoals het is en meld het — het is een
-- INFO-risico, geen reden om met eigenaarsrechten te gaan schuiven.

alter table public.spatial_ref_sys enable row level security;

drop policy if exists "spatial_ref_sys is public reference data" on public.spatial_ref_sys;
create policy "spatial_ref_sys is public reference data"
  on public.spatial_ref_sys
  for select
  to anon, authenticated
  using (true);

-- Terugdraaien:
--   drop policy if exists "spatial_ref_sys is public reference data" on public.spatial_ref_sys;
--   alter table public.spatial_ref_sys disable row level security;
