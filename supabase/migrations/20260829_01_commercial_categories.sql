-- MyKunda — commercieel vastgoed krijgt eigen categorieën
-- ---------------------------------------------------------------------
-- Tot nu toe was er één categorie 'commercial' die alles moest dekken:
-- winkel, kantoor, opslag, restaurant, bedrijfskavel. Die ene waarde
-- stond bovendien tussen de woningtypes in de aanmeldflow, waardoor een
-- winkelpand de vragenlijst van een villa kreeg — slaapkamers, zwembad,
-- personeelsverblijf — en nergens vloeroppervlak, frontbreedte of
-- huidig gebruik.
--
-- WAAROM DIT EEN APARTE MIGRATIE IS
--
-- Postgres mag een enumwaarde die in dezelfde transactie is toegevoegd
-- niet meteen gebruiken, en Supabase draait elke migratie in één
-- transactie. Zou dit bestand ook de update-regel bevatten die rijen op
-- 'retail' zet, dan faalt de hele migratie met
--   unsafe use of new value "retail" of enum type listing_category
-- Daarom eerst dit bestand draaien, en pas daarna 20260829_02.
--
-- De oude waarde 'commercial' blijft bestaan. Een waarde uit een
-- Postgres-enum verwijderen kan alleen door het hele type te herbouwen,
-- en dat is de moeite niet: hij wordt nergens meer aangeboden, en
-- bestaande rijen krijgen in migratie 02 segment = 'commercial'.

alter type listing_category add value if not exists 'office';        -- kantoor of kantoorunit
alter type listing_category add value if not exists 'retail';        -- winkel of winkelunit
alter type listing_category add value if not exists 'warehouse';     -- opslag, loods, werkplaats
alter type listing_category add value if not exists 'restaurant';    -- restaurant, bar, café
alter type listing_category add value if not exists 'mixed_use';     -- pand met winkel/kantoor én woonlaag
alter type listing_category add value if not exists 'business_plot'; -- bedrijfskavel of ommuurd terrein
