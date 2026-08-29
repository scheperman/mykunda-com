# Nulmeting Landpagina 2.0

Peildatum **29 augustus 2026**, de dag van de livegang (commit `db16277`).
Meetvenster: **30-07 t/m 26-08-2026**, 28 dagen, volledig vóór de wijziging.
Bron: Search Console, property `sc-domain:mykunda.com`, afgelezen op 29-08-2026.

Dit bestand legt vast wat er vóór de wijziging gold, zodat het effect later te
beoordelen is in plaats van te beweren.

## Wat er is gewijzigd

`land-for-sale-in-the-gambia.html` ging van een losse prijstabel naar een
categoriepagina: hero met twee koop-CTA's, een aanbodstrip die zichzelf toont
zodra er kavels in de database staan, een verkopersband, de ongewijzigde
prijstabel, een link naar de diaspora-checklist, vijf FAQ-vragen met
FAQPage-structured-data, een vierde kaart naar de waardebepaling en een
leadband. URL, `<title>` en canonical zijn expres niet aangeraakt.

Meegeleverd in dezelfde commit: twee generatorfixes (regiotellers in het
areamenu, herhaald "· band rate" op home/index/buy) en de dubbele
`dbListingToCard` op de voorpagina.

## De hele site, 30-07 t/m 26-08-2026

| Meting | Waarde |
| --- | --- |
| Klikken | 10 |
| Vertoningen | 944 |
| CTR | 1,1% |
| Gemiddelde positie | 28,7 |

Het kliktotaal van 10 komt exact overeen met de Search Console-mail van
28-08-2026. Dat is de kruiscontrole dat het meetvenster klopt.

## De Landpagina zelf

| Meting | Waarde |
| --- | --- |
| Klikken | **0** |
| Vertoningen | **1** |
| CTR | 0% |
| Gemiddelde positie | 9,0 |

Eén vertoning in vier weken. De pagina bestond wel, maar deed in de praktijk
niets — dat is het vertrekpunt, en meteen de reden dat vrijwel elke uitkomst
een verbetering is. De positie van 9,0 zegt bij één vertoning niets.

## De zoektermen rond land

Geen enkele klik, in geen enkele variant. Samen 54 vertoningen.

| Zoekterm | Vertoningen | Positie |
| --- | --- | --- |
| land for sale in gambia | 21 | 38,5 |
| buying land in gambia | 17 | 50,6 |
| gambia land | 7 | 43,3 |
| cheap land for sale in gambia | 2 | 27,0 |
| gambia land for sale | 2 | 36,5 |
| cheap land for sale in gambia by owner | 1 | 4,0 |
| land in gambia for sale | 1 | 36,0 |
| empty land for sale in gambia | 1 | 40,0 |
| land for sale in gambia west africa | 1 | 47,0 |
| gambia land purchase receipt 2023 | 1 | 85,0 |

Twee waarnemingen die het beeld bijstellen:

**De zin waar de URL op gebouwd is — "land for sale in *the* gambia" — komt in
de data niet voor.** Wat mensen intikken is "land for sale in gambia", zonder
lidwoord. Google behandelt die twee vrijwel gelijk, dus de URL hoeft niet te
wijzigen, maar voor de meting is dít de regel om te volgen.

**Positie 38,5 op de belangrijkste term is pagina vier.** Daar wordt niet
geklikt; nul klikken bij 21 vertoningen is dus geen CTR-probleem maar een
positieprobleem. De vraag voor de komende maanden is of de positie beweegt,
niet of de CTR stijgt.

## Ter zijde: een dubbele URL voor de titelgids

In dezelfde meting haalt `guide.html?slug=how-to-verify-land-title-in-the-gambia`
2 klikken en 18 vertoningen op positie 4,6 — de op één na best presterende URL
van de site. De gids staat inmiddels ook op
`guide-how-to-verify-land-title-in-the-gambia.html`. Twee URL's voor dezelfde
inhoud verdelen het signaal. Apart uitzoeken; hoort niet bij deze wijziging.

## Hoe we later meten

De maandelijkse taak **"Landpagina 2.0 — effectmeting"** draait op de 27e van
elke maand en doet:

1. `node _werk/check-live.mjs` — staat de pagina er nog goed op (22 controles).
2. Gmail doorzoeken op de nieuwste Search Console-mail en het kliktotaal naast
   de 10 van dit venster leggen.
3. `select count(*) from listings where category='land' and kind='sale'` — is de
   aanbodstrip inmiddels zichtbaar voor bezoekers?
4. Als er Search Console-exports in `_werk/` staan: die verwerken.

De cijfers hierboven zijn met de hand uit Search Console gelezen; een export is
dus niet nodig om te kunnen vergelijken. Voor een volgende meting: zelfde
property, periode Aangepast, venster van 28 dagen, en dan de tabbladen
Zoekopdrachten en Pagina's aflezen.

## Wat een eerlijk oordeel is

Drie maanden is de eerste redelijke termijn voor een uitspraak; één maand zegt
bij 944 vertoningen niets. De meetlat is de positie op "land for sale in
gambia" (nu 38,5) en de vertoningen van de Landpagina (nu 1). FAQ-rich-results
toont Google sinds 2023 vrijwel alleen nog voor overheids- en gezondheidssites,
dus daar valt weinig van te verwachten — de winst moet uit de inhoud, de
interne links en het complete kavelpad komen. En de aanbodstrip kan pas iets
doen zodra er kavels in de database staan; blijft dat aantal nul, dan zegt het
uitblijven van effect niets over het ontwerp.

## Meetlogboek

| Datum | Site: klikken / vertoningen / positie | Landpagina: klikken / vertoningen | "land for sale in gambia": positie | Kavels | check-live |
| --- | --- | --- | --- | --- | --- |
| 29-08-2026 (nulmeting, venster 30-07 t/m 26-08) | 10 / 944 / 28,7 | 0 / 1 | 38,5 | 0 | 22/22 groen |

De maandelijkse taak vult deze tabel aan.
