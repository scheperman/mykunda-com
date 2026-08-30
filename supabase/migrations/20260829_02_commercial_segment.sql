-- MyKunda — het commerciële kanaal in de database
-- ---------------------------------------------------------------------
-- DRAAI EERST 20260829_01_commercial_categories.sql. Dit bestand
-- gebruikt de enumwaarden die daar worden toegevoegd, en Postgres staat
-- dat niet toe binnen dezelfde transactie.
--
-- WAAROM EEN KOLOM EN GEEN AFLEIDING
--
-- Commercieel is geen derde `kind`: een winkel wordt verkocht óf
-- verhuurd, dus kind (sale|rent) blijft nodig. Het is een tweede as.
-- Die as had ook uit de categorie afgeleid kunnen worden, maar dan
-- draagt elke woningquery een `category not in (...)`-lijst mee die bij
-- elk nieuw commercieel type opnieuw bijgewerkt moet worden. Eén kolom
-- met een index is goedkoper en vergeet je niet.
--
-- De front-end is er niet van afhankelijk: dbListingToCard in
-- supabase.js leidt het segment alsnog af uit de categorie wanneer de
-- kolom ontbreekt. Deze migratie kan dus vóór of ná een upload draaien
-- zonder dat Buy of Rent leeg raakt.

alter table public.listings
  add column if not exists segment text not null default 'residential';

alter table public.listings
  drop constraint if exists listings_segment_check;

alter table public.listings
  add constraint listings_segment_check
  check (segment in ('residential','commercial'));

comment on column public.listings.segment is
  'Woningmarkt of bedrijfsmarkt. Bepaalt in welk kanaal een listing verschijnt: Buy en Rent tonen alleen residential, commercial.html alleen commercial. Wordt gezet door het commerciële spoor in list.html; alles zonder expliciete waarde is residential.';

-- ---------------------------------------------------------------------
-- Velden die alleen het commerciële spoor vult.
--
-- Bewust géén nieuwe kolommen voor vloeroppervlak, frontbreedte,
-- servicekosten, huurtermijn en beschikbaarheid: daar bestaan al
-- kolommen voor (sqm, plot_width_m, service_charge, min_term_months,
-- available_from) die het commerciële spoor hergebruikt. Een tweede
-- kolom voor hetzelfde begrip is hoe twee waarheden ontstaan.
--
-- add column if not exists, omdat de live tabel voorloopt op de SQL in
-- deze repo: een deel van de kolommen hierboven is destijds
-- rechtstreeks in Supabase aangemaakt zonder migratiebestand.
-- ---------------------------------------------------------------------

alter table public.listings add column if not exists units          int;
alter table public.listings add column if not exists parking_spaces int;
alter table public.listings add column if not exists current_use    text;
alter table public.listings add column if not exists fit_out        text;

comment on column public.listings.units is
  'Aantal verhuurbare of verkoopbare units in het pand. 1 voor een enkele winkel of kantoorunit.';
comment on column public.listings.parking_spaces is
  'Aantal eigen parkeerplaatsen op het terrein. Voor een winkel aan de straat vaak 0.';
comment on column public.listings.current_use is
  'Waar het pand nu voor gebruikt wordt — vacant, shop, office, restaurant, warehouse, other. Zegt iets anders dan de categorie: een pand kan als kantoor te huur staan en nu nog winkel zijn.';
comment on column public.listings.fit_out is
  'Opleverniveau: shell (casco), fitted (afgewerkt, zonder inrichting) of turnkey (gebruiksklaar).';

-- deze kolommen bestonden al voor woningen en worden nu ook commercieel gebruikt
alter table public.listings add column if not exists service_charge   numeric(14,2);
alter table public.listings add column if not exists min_term_months  int;
alter table public.listings add column if not exists available_from   date;
alter table public.listings add column if not exists plot_width_m     numeric(6,2);

create index if not exists listings_segment_idx on public.listings(segment);
create index if not exists listings_segment_kind_idx on public.listings(segment, kind, status);

-- ---------------------------------------------------------------------
-- Bestaande rijen meenemen.
--
-- Tel eerst hoeveel het er zijn, zodat je weet wat je verplaatst:
--   select count(*) from public.listings where category = 'commercial';
--
-- De categorie blijft staan zoals hij is — 'commercial' zegt niet of het
-- een winkel of een kantoor was, en dat verzinnen we er niet bij. Het
-- segment is wél zeker.
-- ---------------------------------------------------------------------

update public.listings
   set segment = 'commercial'
 where category = 'commercial'
   and segment <> 'commercial';
