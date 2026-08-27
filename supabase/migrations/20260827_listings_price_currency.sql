-- MyKunda — de eenheid hoort bij het bedrag, niet in de overlevering
-- ---------------------------------------------------------------------
-- Op 27-08-2026 bleek listings.price in euro's te staan terwijl
-- create-payment hem tegen dalasigrenzen toetste. Elke verkoopadvertentie
-- viel daardoor in de goedkoopste Verified-band: een villa van
-- D12.000.000 kwam binnen als ~140.000 en zou D4.500 betalen in plaats
-- van D16.000.
--
-- Dat is gerepareerd door dalasi de opslageenheid te maken. Maar niets
-- hield dat vast behalve een kolomcommentaar en een afspraak, en precies
-- zo is het de eerste keer misgegaan.
--
-- WAAROM DIT GEEN DECORATIE IS
--
-- Een vangrail op de hoogte van het bedrag lost dit niet op.
-- MIN_VRAAGPRIJS_GMD in create-payment staat op D50.000 en vangt een
-- grove eenheidsfout onderin de markt — maar de villa hierboven stond in
-- euro's op 140.007, ruim boven die grens. Die was er stilletjes
-- doorheen gegaan. Een bedrag alleen kan niet zeggen in welke munt het
-- staat; die informatie moet ernaast.
--
-- De check laat voorlopig alleen 'GMD' toe. Dat is het punt: wie ooit
-- een bedrag in een andere munt wil opslaan, krijgt een harde fout in
-- plaats van een getal dat toevallig binnen een band valt, en moet de
-- constraint bewust verbreden. Dat is precies het moment waarop iemand
-- ook alle drempelvergelijkingen moet nalopen.
--
-- Geldt ook voor sold_price: dezelfde eenheid, hetzelfde veld beschrijft
-- ze allebei.

alter table public.listings
  add column if not exists price_currency text not null default 'GMD';

alter table public.listings
  drop constraint if exists listings_price_currency_check;

alter table public.listings
  add constraint listings_price_currency_check
  check (price_currency = 'GMD');

comment on column public.listings.price_currency is
  'De munt waarin price en sold_price staan. Voorlopig uitsluitend GMD, afgedwongen met een check-constraint. Verbreed die constraint niet zonder tegelijk elke plek na te lopen die price met een drempel vergelijkt — create-payment kiest er de Verified-band mee.';
