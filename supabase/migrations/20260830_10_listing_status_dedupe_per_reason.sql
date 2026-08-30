-- ============================================================================
--  MyKunda — statusmail: ontdubbelen per reden                (30-08-2026)
--  Toegepast op jejaerpqltqryqzjvbjp via de Supabase-MCP als migratie
--  'listing_status_dedupe_per_reason'. Deze kopie is de bron in de repo.
--
--  De ontdubbeling van de statusmail hield één mail per (advertentie, status)
--  aan. Voor 'active' en 'archived' klopt dat: heen-en-weer van de backoffice
--  is geen nieuws voor de aanbieder.
--
--  Voor 'rejected' klopt het niet. Sinds de backoffice bij afkeuren een reden
--  VERPLICHT invult (admin.html -> reject), is een tweede afwijzing na
--  herindienen een ander bericht: een andere reden, een ander probleem. Die
--  mail werd stil overgeslagen en de aanbieder hoorde niets.
--
--  De sleutel krijgt daarom de reden erbij. Voor active en archived is die
--  leeg en verandert er niets; voor rejected mailt alleen een ANDERE reden
--  opnieuw, terwijl een herhaalde poging met dezelfde reden nog steeds wordt
--  tegengehouden — precies de bescherming waar de claim voor bedoeld is.
--
--  Hoort bij: supabase/functions/notify-listing-status/index.ts, dat de reden
--  sinds dezelfde datum in de claim-payload zet. Zonder die aanpassing staat
--  er nooit een reden in de sleutel en gedraagt de index zich als de oude.
-- ============================================================================

drop index if exists public.email_events_listing_status_once;

create unique index if not exists email_events_listing_status_once
  on public.email_events (
    ((payload ->> 'listing_id')),
    ((payload ->> 'status')),
    (coalesce(payload ->> 'reason', ''))
  )
  where event_type = 'listing_status';
