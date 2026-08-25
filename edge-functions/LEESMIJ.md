# Verouderde momentopname — niet als bron gebruiken

De bestanden in deze map zijn handmatige kopieën van edge functions en lopen
achter op wat er draait. Gemeten op 25-08-2026, met de Supabase CLI tegen
project `jejaerpqltqryqzjvbjp`:

- van de elf kopieën hier kwam er **één** overeen met de uitgerolde versie;
- tien weken af, soms fors — `notify-payment` is uitgerold 16.350 bytes tegen
  4.865 hier, `notify-viewing` 9.923 tegen 5.805, `resend-webhook` 9.631
  tegen 5.794;
- tien uitgerolde functies ontbraken hier helemaal, waaronder `create-payment`,
  `send-payment-instructions`, `payment-status`, `bank-confirm` en
  `waychit-webhook`.

**De actuele bron staat in `supabase/functions/<naam>/index.ts`.** Die is met
`supabase functions download` opgehaald en staat in git.

Deze map blijft voorlopig bestaan omdat er commentaarregels in `app.js` en
`supabase.js` naar verwijzen, en omdat `robots.txt` het pad blokkeert. Gebruik
hem als geschiedenis, niet als waarheid.
