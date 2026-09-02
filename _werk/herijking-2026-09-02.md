# Herijking gebiedsprijzen — 2 september 2026

**Er is niets weggeschreven.** Dit is het verschiloverzicht plus een aanbeveling;
area-prices.json, valuation.js en de pagina's zijn onaangeroerd.

---

## 1. Verschiloverzicht: er beweegt niets

De augustus- en septembermomentopname zijn op één gebied na identiek: alle 27
grondgebieden houden dezelfde mediaan, hetzelfde aantal waarnemingen en dezelfde
bewijsklasse. Sanyang beweegt +1,2% (D13,0 → D13,2 per m² in USD-termen), ver
onder de drempel van 10%; landelijk staat de grondmediaan op beide maanden op
$26,1/m². Geen enkel gebied wisselt van klasse.

**Reden: er is geen nieuw bewijs.** Elke actieve waarneming in `external_listings`
is in augustus voor het eerst gezien — 151 uit de Facebook-export van 25-08, 12 van
GamRealty, 5 van AccessGambia. Sinds 26 augustus is er geen enkele nieuwe
waarneming meer binnengekomen. De herijking van deze maand meet dus dezelfde
markt als die van vorige week. **Aanbeveling: area-prices.json ongewijzigd laten.**

De proefdraai bevestigt dat: `node build-area-prices.mjs` zou 0 bestanden
schrijven — de site staat gelijk met het bestand.

---

## 2. Gezondheid van de oogst — hier zit het echte probleem

Drie van de vijf schrapers leveren al een week niets, en de vierde is uitgezet.
Dit is geen leeg aanbod maar storing: de pagina's laden wel.

| bron | staat | wat er gebeurt |
|---|---|---|
| **propertyshop** | **stuk sinds 27-08** — 8 mislukte runs | site is herbouwd op het Houzez-thema; er is geen `<article>` meer, dus de itemselector vindt niets |
| **holprop** | **stuk sinds 26-08** — 4 mislukte runs | `<div class="…property\|listing\|item…">` sluit op de eerste `</div>`, ruim vóór de prijs |
| **schumann** | **stuk sinds 26-08** — 5 mislukte runs | niet met een selector te repareren, zie hieronder |
| accessgambia | draait, maar mager | 6 runs → 5 waarnemingen, 30 blokken afgekeurd |
| gamrealty | gezond | 22 runs, 178 gezien, 12 nieuw |
| gbos | **hersteld** | 19 DNS-fouten op het oude `gbos.gov.gm`, sinds 26-08 loopt de terugval; maandelijkse cadans, dus geen actie |
| gambiarealestate | uitgezet 28-08 | gaf 15 runs lang `ok` bij een HTTP 404 — een gemaskeerde storing |
| realigro | bewust uitgezet 26-08 | HTTP 403 |
| mykunda, mykunda_sold, registry, observation, agent_csv | **nooit één run** | zie punt 5 |

### Wat ik heb getest (en waarom ik het niet heb weggeschreven)

Ik heb de drie pagina's opgehaald en de parser van de edge function nagebouwd om
kandidaat-selectors te toetsen voordat ik iets aan `market_sources.parse` verander.

**propertyshop** — werkende selector gevonden:

```
item : <div class="item-listing-wrap[\s\S]*?<!-- item-listing-wrap -->
url  : href="(https://gambiapropertyshop\.com/property/[^"]+)"
title: <h2 class="item-title">\s*<a[^>]*>([\s\S]*?)</a>
```

Resultaat: 9 blokken, 7 bruikbare regels, prijs en gebied correct
(Sanyang, Kartong, …). **Maar:** alle zeven komen binnen als `category:
"commercial"`. De oorzaak zit in de functie, niet in de selector — `detectCategory`
matcht `shops?` op de naam van het kantoor zelf, "Gambia Property **Shop**", die in
elke kaartvoet staat. Zo aanzetten betekent zeven kavels als bedrijfspand in de
tabel.

**holprop** — werkende selector gevonden (schema.org-microdata):

```
item : <div[^>]*itemtype="https://schema\.org/Residence"[\s\S]*?(?=<div[^>]*itemtype="https://schema\.org/Residence"|$)
url  : itemprop="url" content="(https?://[^"]+)"
title: itemprop="name" content="([^"]+)"
```

Resultaat: 12 blokken, 12 regels mét prijs én maat. **Maar** hier is het erger: de
holprop-blokken bevatten de volledige omschrijving, en daardoor kiest
`detectCategory` `house` (op "dream home") in plaats van `land`. Gevolg:
`detectSqmKind` zet de kavelmaat als **vloeroppervlak** weg — 1.875 m² "vloer" voor
een stuk grond in Sukuta. Dat is precies de noemerfout die op 26-08 is dichtgezet,
langs de andere kant weer binnen. Eén regel kwam bovendien als huur binnen op
$2,1 mln per jaar.

**schumann** — niet te repareren met een selector. De verkooppagina toont geen
enkel bedrag (prijs op aanvraag); alleen de verhuurpagina heeft er drie. Wie deze
bron wil, moet detailpagina's ophalen — dat is nieuw werk, geen tuning. Alternatief:
`in_index` uitzetten en hem eerlijk als dekkingsbron laten staan.

**Daarom heb ik `market_sources.parse` níét aangepast.** De selectors alleen
zetten de stille nul om in stille rommel, en die is moeilijker terug te draaien dan
een lege tabel.

---

## 3. Twee mankementen die het toezicht zelf raken

1. **De dry-run-diagnose werkt niet.** De foutmelding zegt: "Test with
   `{run:"…",dry:true}`". Doe je dat, dan krijg je `"rejects": []`. In de
   catch-tak van de functie is `run` nog `null` — de vijf afgekeurde blokken die
   je zou moeten zien, worden weggegooid, zowel in het antwoord als in
   `source_fetch_runs.sample`. De aangewezen manier om een selector te
   diagnosticeren is dus zelf stuk.

2. **`build-area-prices.mjs` meldt elke draai een valse storing.** Het blok voor
   `property.html` zoekt nog naar `stats: [['Avg. price/m²', …]]`, en die
   constructie bestaat sinds de herbouw van 01-09 niet meer. Elke run eindigt nu
   met "overgeslagen: 1 — LET OP: overgeslagen bestanden zijn NIET aangepast. Los
   de melding op en draai opnieuw." De prijzen op property.html kloppen wél:
   `HOOD_DATA` wordt gegenereerd door `build-property-areas.mjs` uit
   `property-areas.json`, en Bakau/Bakoteh staan daar op D6.460 en D2.330, gelijk
   aan het bestand. Het patch-blok is dood en zou weg moeten — een vals alarm dat
   elke draai afsluit, leert je het echte alarm negeren.

Beide zitten in code, niet in data. Ik heb ze niet aangeraakt.

---

## 4. Nog twee dingen die ik onderweg tegenkwam

- **`check-propertyareas.mjs` geeft 39 fouten.** Niet op prijzen — die kloppen —
  maar op de scores: `property.html` toont per gebied twee scorebalken waar
  `area-scores.json` er vier heeft ("Everyday shopping" en "Healthcare"
  ontbreken). `property-areas.json` is ouder dan `area-scores.json`. Opnieuw
  draaien van `build-property-areas.mjs` zou dit rechtzetten; dat raakt de site,
  dus wacht op jou.
- **40 van de 132 actieve kavels hebben geen gebied**, waarvan 11 met bruikbare
  prijs-per-m². Het zijn spelfouten die niet in `market_area_alias` staan: *jaban*
  (Jabang), *busimbala* (Busumbala), *wulinkama/willinkama*, *kitty*, *sifoe*,
  *Foni*, *Dalaba*. Aliassen toevoegen is data en kan zonder code, maar het
  verschuift wel de gebiedstellingen — dus ook dat als voorstel, niet als daad.
- **Eén verdachte regel:** "This land is for sale at jaban… 25 by 30" staat op
  $411.410 voor 750 m² = **$548/m²**, twee keer de duurste strandstrook. Dat is de
  hoogste waarde in het hele bestand en vrijwel zeker een schaal- of valutafout in
  de Facebook-import. Nu ongebruikt (geen gebied), maar zodra *jaban* een alias
  krijgt, zet hij Jabang in één klap op zijn kop.

---

## 5. Facebook Marketplace

Facebook is met 151 van de 168 actieve waarnemingen veruit de dichtste bron, en de
export van 25-08-2026 is de laatste. **Heb je een nieuwe export?** Zonder nieuwe
export blijft de meting deze maand staan waar hij staat.

Let op: `area-prices.json` zegt dat het bestand op 918 bruikbare Facebook-regels
rust (`sources.fb_usable`), terwijl er 151 in `external_listings` staan. De
volledige export leeft dus buiten de database, en Supabase kan de cijfers in het
bestand niet narekenen. Dat is nu geen fout, maar het betekent wel dat de
controle op het belangrijkste bewijs ontbreekt.

---

## 6. Zelftest — ongewijzigde nulmeting

`node valuation-selftest.mjs` (valuation.js niet aangeraakt):

- A · kavels: **16/20 in band**, mediane afwijking **0%**, gemiddelde absolute
  afwijking 20% — binnen de norm.
- C · huur: scheefheid 0,30 procentpunt (grens 0,40) — ok; slechtste gebied 1,84x
  buiten band (grens 2,00) — ok.
- D · één bron: alle 52 gebieden gelijk in tool en areapagina.

---

## 7. Wat ik voorstel

1. **Niets herijken deze maand.** Geen nieuw bewijs, geen beweging.
2. **Eerst de drie code-mankementen**, dan pas de selectors aanzetten:
   `detectCategory` mag niet op de kantoornaam matchen; `detectSqmKind` mag een
   kavel niet als vloer wegzetten; de catch-tak moet de afgekeurde blokken
   bewaren.
3. **Daarna** de twee geteste selectors in `market_sources.parse`, met een
   dry-run als controle vóórdat ze schrijven.
4. **schumann**: `in_index` uit, of detailpagina's ophalen — jouw keuze.
5. **Facebook-export** aanleveren als je er een hebt; dan draai ik de herijking
   opnieuw met echt nieuw bewijs.
6. Losse punten: `build-property-areas.mjs` opnieuw draaien voor de scores, het
   dode `property.html`-blok uit `build-area-prices.mjs`, aliassen aanvullen.

Zeg welke punten je wilt en ik lever eerst het plan, dan pas de wijziging.
Uploaden doe jij, met `upload.bat`.

## Wat er niet is gelukt

- De selectors repareren: technisch gelukt en getoetst, maar niet weggeschreven —
  het zou mis-geclassificeerde regels de tabel in duwen.
- schumann herstellen: kan niet met parse-configuratie alleen.
- De cijfers in `area-prices.json` narekenen tegen Supabase: kan niet, de volledige
  Facebook-export zit niet in de database.
