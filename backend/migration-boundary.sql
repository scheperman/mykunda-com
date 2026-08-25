-- Plot boundary drawn by the seller in the listing wizard (step 2),
-- and the measured straight-line distance from the pin to the Atlantic shoreline.
-- Run once on an existing database; schema.sql already includes both for new installs.
alter table public.listings add column if not exists boundary jsonb;
alter table public.listings add column if not exists beach_m int;
comment on column public.listings.boundary is 'Seller-drawn plot outline: {type, points:[{lat,lng}], area_m2, centroid}.';
comment on column public.listings.beach_m is 'Straight-line distance in metres from the listing pin to the Atlantic shoreline.';
