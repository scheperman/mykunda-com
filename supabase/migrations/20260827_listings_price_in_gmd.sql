-- MyKunda — listings.price staat in dalasi, niet in euro's
-- ---------------------------------------------------------------------
-- Alleen commentaar: er is geen data om te converteren. De tabel stond op
-- nul rijen toen deze wijziging werd gemaakt, wat het goedkoopste moment
-- was dat er ooit voor kwam.
--
-- Wat er niet klopte: list.html deelde de ingetypte vraagprijs door de
-- eurokoers voordat hij hem opsloeg, en vermenigvuldigde hem bij het
-- terugladen weer. Twee gevolgen.
--
--   1. De vraagprijs bewoog mee met de dalasi. Een verkoper typte
--      D2.000.000 en zag er een week later D2.040.000 staan, zonder dat
--      hij iets had aangepast.
--   2. create-payment geeft listings.price door aan verifiedBandVoor(),
--      die toetst op D2.000.000 en D10.000.000. Met de euro-tegenwaarde
--      erin viel élke verkoopadvertentie in de goedkoopste band: een
--      villa van D12.000.000 kwam binnen als ~140.000 en zou D4.500
--      betalen in plaats van D16.000.
--
-- Sinds 27-08-2026 gaat de dalasi ongewijzigd de database in en uit.
-- Andere munten zijn weergave, en worden pas in de browser berekend uit
-- de koers die de fx-rates function levert.
--
-- Draait deze migratie ooit op een database waar wél rijen in staan met
-- euro-bedragen, converteer die dan EERST met de koers van het moment van
-- opslaan — niet met de koers van vandaag. De datum van created_at en
-- fx_rates.as_at geven die koers terug.

comment on column public.listings.price is
  'Vraagprijs in GMD (dalasi), de eenheid waarin hij is afgesproken. Bij verhuur is dit het bedrag per price_period. Andere munten zijn weergave: de browser deelt door CURRENCIES[x].gmdPer. NOOIT in een andere munt wegschrijven — create-payment kiest de Verified-band op dalasigrenzen.';

comment on column public.listings.sold_price is
  'Gerealiseerde verkoopprijs in GMD, zelfde eenheid als price.';
