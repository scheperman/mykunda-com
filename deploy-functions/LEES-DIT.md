# Deploy — edge functions (20-08-2026)

Uitvoeren vanuit je supabase-projectmap, na deze bestanden op hun plek te zetten:

    supabase functions deploy notify-viewing --no-verify-jwt
    supabase functions deploy notify-lead    --no-verify-jwt

## Altijd samen deployen
`notify-viewing/index.ts` importeert `_shared/email-template.ts`. Alleen de
index deployen laat de functie bij het opstarten crashen op de ontbrekende
export `viewingConfirmedEmail` — en dan vallen **alle drie** de
bezichtigingsmails weg, niet alleen de nieuwe. `email-template.ts`
re-exporteert onderaan `email-listing.ts`, dus die hoort er ook bij.

## LEAD_EMAIL staat hard op admin@mykunda.com — niet terugzetten op env
`info@mykunda.com` bounceerde op 14-08-2026 op de Cloud86-blocklist. Met een
fallback naar dat adres verdwijnt elke interne melding stil: geen foutmelding,
alleen geen mail. Ook geen `Deno.env.get("LEAD_EMAIL")` ervoor — staat de
secret niet of verkeerd, dan valt hij in dezelfde fout terug.

Terug naar env mag pas als Cloud86 aantoonbaar los is én de secret is
gecontroleerd. De reden staat als commentaar in beide index.ts-bestanden,
zodat een volgende ronde hem niet opnieuw omzet.

## notify-lead
Alleen de LEAD_EMAIL-regel is gewijzigd: live liep die al op admin@, in het
project nog niet. Nu gelijkgetrokken — opnieuw deployen is netjes maar
verandert live gedrag niet.
