# Nulmeting Landpagina 2.0

Peildatum **29 augustus 2026**, de dag van de livegang (commit `db16277`).
Dit bestand legt vast wat er vóór de wijziging gold, zodat het effect later
te beoordelen is in plaats van te beweren.

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

## Wat we zeker weten op de peildatum

| Gegeven | Waarde | Bron |
| --- | --- | --- |
| Klikken via Google Zoeken, hele site, 28 dagen tot 26-08-2026 | **10** | Search Console-mail van 28-08-2026 aan edwinscheperman@gmail.com |
| Kavels in de database (`listings`, category=land, kind=sale) | **0** | Supabase, 29-08-2026 |
| Gebieden in de prijstabel op de pagina | **19** van 46 | `area-prices.json`, meting 25-08-2026 |
| Interne links naar `diaspora-land-buying-checklist.html` | **0** vóór, **2** na | projectbrede zoekopdracht |
| Positie voor "land for sale in the gambia" | **onbekend** | zie hieronder |

## Wat nog ontbreekt, en waarom

De cijfers per zoekterm — vertoningen, klikken, CTR en gemiddelde positie voor
**"land for sale in the gambia"** en voor de URL van de Landpagina — staan
alleen in Search Console. Daar is een ingelogde sessie voor nodig; die kan en
mag Claude niet zelf aanmaken. De maandmail geeft alleen een sitebreed
kliktotaal.

**Wat Edwin één keer moet doen (5 minuten), het liefst vóór 26-09-2026 zodat de
periode vóór de wijziging nog volledig in beeld is:**

1. Search Console → property `mykunda.com` → **Prestaties → Zoekresultaten**.
2. Periode: **28 dagen tot en met 28-08-2026** (dus vóór de livegang).
3. Twee exports maken en in deze map zetten:
   - filter **Zoekopdracht bevat** `land` → tabblad Zoekopdrachten → Exporteren;
   - filter **Pagina is exact** `https://mykunda.com/land-for-sale-in-the-gambia.html`
     → Exporteren.
4. Zeg het tegen Claude; die verwerkt de cijfers in dit bestand.

Zonder stap 3 blijft de vergelijking beperkt tot het sitebrede kliktotaal uit
de maandmail. Dat is geen ramp, maar het kan de Landpagina niet los meten.

## Hoe we later meten

De maandelijkse taak **"Landpagina 2.0 — effectmeting"** doet dit vanzelf op de
27e van elke maand:

1. `node _werk/check-live.mjs` — staat de pagina er nog goed op (22 controles).
2. Gmail doorzoeken op de nieuwste Search Console-mail en het kliktotaal naast
   de 10 van 26-08-2026 leggen.
3. `select count(*) from listings where category='land' and kind='sale'` — is de
   aanbodstrip inmiddels zichtbaar voor bezoekers?
4. Als de exports uit stap 3 hierboven bestaan: vertoningen en positie ernaast.

## Wat een eerlijk oordeel is

Drie maanden is de eerste redelijke termijn voor een uitspraak over
vindbaarheid; één maand zegt bij deze volumes nog niets. FAQ-rich-results toont
Google sinds 2023 vrijwel alleen nog voor overheids- en gezondheidssites, dus
van de structured data alleen valt weinig te verwachten — de winst moet uit de
inhoud, de interne links en het complete kavelpad komen. En de aanbodstrip kan
pas iets doen zodra er kavels in de database staan; blijft dat aantal nul, dan
zegt het uitblijven van effect niets over het ontwerp.

## Meetlogboek

| Datum | Klikken (28 dagen, hele site) | Kavels in database | check-live.mjs | Zoektermdata |
| --- | --- | --- | --- | --- |
| 29-08-2026 (nulmeting) | 10 (tot 26-08) | 0 | 22/22 groen | ontbreekt |

De maandelijkse taak vult deze tabel aan.
