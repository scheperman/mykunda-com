-- ============================================================================
--  MyKunda — ook een account zonder énige contactweg opruimen   (02-09-2026)
--  Toegepast op jejaerpqltqryqzjvbjp; deze kopie is de bron in de repo.
--
--  Aanleiding: de Facebook-knop. Facebook geeft niet altijd een e-mailadres
--  terug — een account dat op een telefoonnummer loopt heeft er geen, en de
--  gebruiker mag het vinkje in het toestemmingsscherm van Facebook uitzetten.
--  Supabase maakt dan tóch een gebruiker aan (auth.users.email mag leeg zijn,
--  en de CHECK op profiles.email laat NULL door). auth.html weigert zo'n
--  aanmelding sinds vandaag en logt meteen uit, maar de rij blijft staan.
--
--  Migratie 05 vindt hem niet: die zoekt naar aanmeldingen die zijn blijven
--  steken en eist daarvoor last_sign_in_at IS NULL. Bij een aanbieder is dat
--  veld juist wél gevuld — het inloggen bij Facebook is gelukt, het is de
--  uitkomst die onbruikbaar is. Zonder deze tweede tak groeit dus opnieuw een
--  stapel rijen die niemand ooit ziet, en dat is precies de bevinding die
--  migratie 05 moest afsluiten.
--
--  De toets is niet "onbevestigd" maar "onbereikbaar": geen e-mailadres én
--  geen telefoonnummer. Zo'n rij kan per definitie niet meer gebruikt worden —
--  er is niets om een inlogcode heen te sturen — en niemand kan erover
--  benaderd worden. Alle voorzorgen van migratie 05 blijven staan: de
--  ondergrens van zeven dagen, user_has_any_data() over de hele
--  vreemde-sleutelcatalogus, en het bonnetje in signup_shells_purged vóór het
--  verwijderen.
--
--  NIEUW EN EXPLICIET: is_anonymous IS NOT TRUE. Een anonieme sessie heeft ook
--  geen adres en geen nummer en zou anders in tak 2 vallen. MyKunda gebruikt ze
--  niet (gemeten: 0 van 3 gebruikers), maar dat is een instelling die iemand
--  ooit kan aanzetten, en dan mag deze functie niet stilletjes gaan opruimen
--  wat dan gewone bezoekers zijn.
-- ============================================================================

create or replace function public.stale_signups(p_days integer default 30)
returns table(user_id uuid, email text, signed_up_at timestamptz)
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select u.id, u.email, u.created_at
    from auth.users u
   where u.deleted_at   is null
     and u.is_anonymous is not true
     and u.created_at < now() - make_interval(days => greatest(p_days, 7))
     and (
       -- 1. Aanmelding blijven steken: generateLink(type signup) maakte de
       --    gebruiker aan, de code is nooit ingetypt.
       ( u.email_confirmed_at is null
         and u.phone_confirmed_at is null
         and u.last_sign_in_at   is null )
       or
       -- 2. Onbereikbaar: de aanbieder gaf geen enkele contactweg terug.
       ( u.email is null and u.phone is null )
     )
     and not public.user_has_any_data(u.id)
   order by u.created_at;
$function$;

comment on function public.stale_signups(integer) is
  'Accounts die weg mogen, in twee vormen. (1) Aanmeldingen die zijn blijven steken: generateLink(type signup) maakt de auth-gebruiker meteen aan, dus wie het codescherm verlaat laat een lege schil achter - nooit bevestigd, nooit ingelogd. (2) Accounts zonder enige contactweg: een aanbieder (Facebook) die geen e-mailadres teruggaf. Die zijn wel ingelogd, dus vorm 1 vindt ze niet, en ze kunnen nooit meer gebruikt of benaderd worden. Beide vormen alleen als de gebruiker nergens in de database voorkomt; anonieme sessies blijven altijd buiten schot. De ondergrens van zeven dagen staat in de functie zelf zodat een verkeerd meegegeven getal nooit een verse aanmelding raakt.';

revoke execute on function public.stale_signups(integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
--  Nagemeten op 02-09-2026 met een echte schil (provider facebook, e-mail en
--  telefoon leeg, ingelogd, 40 dagen oud):
--    oud, geen data      → 1 kandidaat
--    twee dagen oud      → 0   (ondergrens van zeven dagen)
--    oud + één saved_search → 0 (user_has_any_data)
--    is_anonymous = true → 0
--    purge_stale_signups(30) → 1; auth.users en profiles weer op 3, en het
--    bonnetje bevat de facebook-metadata zonder wachtwoordhash.
--  Testrijen en bonnetjes daarna verwijderd zodat het spoor schoon begint.
-- ---------------------------------------------------------------------------
