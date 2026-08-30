-- Gevonden tijdens de testronde van 30-08-2026.
--
-- Het verwijderbeleid op listing-photos en listing-docs eist een EXISTS op
-- public.listings met dezelfde map-naam. Wordt de advertentierij eerst
-- verwijderd, dan faalt die EXISTS voor iedereen -- ook voor een admin, want
-- is_admin() staat BINNEN diezelfde EXISTS. De foto's zijn daarna door niemand
-- meer weg te krijgen via de Storage API, en storage.objects weigert een
-- directe SQL-delete. Elke verwijderde advertentie liet dus haar foto's
-- permanent achter.
--
-- Twee dingen hieronder: een ontsnappingsluik voor de admin dat niet van de
-- advertentierij afhangt, en een cascade zodat de mediarijen meegaan.

create policy "listing media admin delete"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('listing-photos','listing-docs')
  and (select public.is_admin())
);

alter table public.listing_media
  drop constraint if exists listing_media_listing_id_fkey;

alter table public.listing_media
  add constraint listing_media_listing_id_fkey
  foreign key (listing_id) references public.listings(id) on delete cascade;
