# Voorstel: vijf regels in market-sources — getoetst, niet uitgerold

Status: **niet gedeployd.** Elke wijziging hieronder is getoetst tegen de echte
pagina's van propertyshop en holprop en tegen de 17 bestaande regels van
gamrealty en accessgambia. Uitrollen is jouw beslissing.

## Eerst: de repo loopt achter op productie

`edge-functions/market-sources/index.ts` in de projectmap is **ouder dan wat er
draait**. De lokale kopie mist het blok van 27-08-2026 ("de deur dicht") dat de
functie afschermt met `x-mykunda-key` of een admin-JWT; de draaiende versie 18
heeft dat wel. Wie nu vanuit de repo deployt, zet die afscherming ongemerkt terug
op open — de functie draait met `verify_jwt = false` en schrijft met de
service-role sleutel.

**Haal eerst de draaiende versie op** (Supabase-console → Edge Functions →
market-sources) en zet die in de repo. Pas daarna de wijzigingen hieronder.
Ik heb de lokale kopie met opzet níét overschreven: 27 kB overtypen uit een
gesprek is precies de manier om er stil een teken in te verliezen.

---

## Wat er mis is

De blokselectors van propertyshop en holprop zijn stuk — dat is één probleem. Maar
zodra de blokken wél binnenkomen, blijkt de classificatie op de hele bloktekst te
draaien, en die tekst bestaat voor het grootste deel uit briefpapier en
verkooppraat. Vijf gevolgen, allemaal waargenomen op de echte pagina's:

| # | wat er gebeurt | waargenomen |
|---|---|---|
| 1 | `detectCategory` matcht `shops?` op de kantoornaam in de voettekst | alle 9 propertyshop-kavels → `commercial` |
| 2 | `detectCategory` matcht `homes?` op "build your dream home" in de omschrijving | 9 van de 12 holprop-kavels → `house` |
| 3 | gevolg van 2: `detectSqmKind` zet de kavelmaat als **vloeroppervlak** weg | 1.875 m² "vloer" voor een stuk grond in Sukuta |
| 4 | `detectKind` matcht huurwoorden in de omschrijving | "Land for Sale in Yonah" → huur, $214.584 per jaar |
| 5 | `matchArea` leest de omschrijving; de langste alias wint | "Tanji Land for sale" → geboekt onder **Tujereng** |

Losse zesde: in de `catch` van de bronlus is `run` nog `null`, dus de vijf
afgekeurde blokken worden weggegooid — zowel uit het antwoord als uit
`source_fetch_runs.sample`. De foutmelding verwijst naar `{dry:true}` om te
diagnosticeren, en dat geeft altijd `"rejects": []` terug. De aangewezen manier om
een selector te repareren is zelf stuk.

---

## De vijf wijzigingen

### 1 · `detectCategory` — de kop wint van de omschrijving, en het briefpapier telt niet mee

```ts
function detectCategory(text: string, title?: string, bronnaam?: string): string {
  // De kop wint als hij expliciet grond noemt en niets gebouwds: "Sukuta Land
  // for sale" is een kavel, ook al staat er in de omschrijving eronder "build
  // your dream home". Andersom niet — een kop die niets zegt laat de
  // omschrijving gewoon beslissen.  (02-09-2026)
  if (title && LAND_RE.test(title) && !GEBOUWD_RE.test(title)) return 'land'

  // De naam van het kantoor staat in elke kaartvoet en zegt niets over dít
  // pand: "Gambia Property Shop" maakte elke kavel commercieel.
  let t = bronnaam
    ? text.replace(new RegExp(bronnaam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
    : text
  t = t.toLowerCase()
  … (de rest ongewijzigd)
}

const LAND_RE = /\b(plots?|land|acres?|hectares?|farmland)\b/i
const GEBOUWD_RE = /\b(villas?|apartments?|flats?|penthouses?|houses?|homes?|bungalows?|compounds?|guest\s?houses?|duplex|storey|lodges?|townhouses?|offices?|shops?|hotels?|bed\s?rooms?)\b/i
```

Aanroep in `parseBlock` wordt `detectCategory(haystack, title, bronnaam)`, waarbij
`bronnaam` als extra argument door `runHtmlSource` wordt doorgegeven (`src.name`).

### 2 · `detectKind` — dezelfde regel voor koop/huur

```ts
// "Tujereng Land for sale" is een verkoop, ook al staat er in de omschrijving
// iets over verhuur.
const kind = cfg.kind && cfg.kind !== 'auto' ? cfg.kind
  : (title && /\bfor sale\b/i.test(title) && !/\bfor rent\b|\bto let\b/i.test(title))
    ? 'sale'
    : detectKind(haystack)
```

### 3 · `detectSqmKind` — een kavel heeft geen vloer

```ts
function detectSqmKind(text: string, category: string): 'plot' | 'built' | null {
  if (category === 'land') return 'plot'   // ← nieuw, als eerste regel
  …
}
```

De `category === 'land'` terugval stond onderaan, ná de built-takken, en kwam
daardoor nooit aan de beurt. Dit is de andere kant van de noemerfout die op
26-08-2026 is dichtgezet.

### 4 · `matchArea` — gebied uit de kop en de link, niet uit de omschrijving

```ts
// Een omschrijving noemt buurdorpen, en de langste alias won. Levert de kop
// niets op, dan blijft het gebied leeg: de waarneming telt landelijk mee maar
// mag geen gebiedstarief zetten op een gok.
const kop = `${title} ${url || ''}`
const hit = matchArea(kop, aliases)
```

Let op: dit is bewust *strenger* dan nu. Geen terugval op de bloktekst.

### 5 · De afgekeurde blokken bewaren

```ts
if (!seen.length) {
  const e = new Error('page loaded but nothing parsed - selector needs tuning (' +
    rejected.length + ' blocks rejected). Test with {run:"' + src.key + '",dry:true}')
  ;(e as any).rejected = rejected
  throw e
}
```

en in de bronlus:

```ts
} catch (e) {
  err = String((e as Error)?.message || e)
  rejectedBijFout = (e as any)?.rejected ?? []
}
```

`rejectedBijFout` gaat mee in `source_fetch_runs.sample` en in het dry-antwoord.

---

## Wat de toets oplevert

**Geen regressie op de gezonde bronnen.** Alle 17 bestaande regels van gamrealty
en accessgambia zijn opnieuw geclassificeerd met de nieuwe regels:

- regel 1 (kop-zegt-grond) vuurt op 1 van de 17, en die stond al op `land`;
- regel 4 (gebied uit kop+link) levert **17 van de 17** hetzelfde gebied als nu
  opgeslagen staat;
- regel 3 verandert niets aan de uitkomst voor gebouwde panden: die vallen al
  terug op `sqm <= 400 ? 'built' : 'plot'` in `resolveSqm`.

**Wat er dan binnenkomt, met de herstelde selectors erbij:**

| bron | blokken | opgenomen | met kavelmaat | met gebied |
|---|---|---|---|---|
| propertyshop | 9 | 7 | 4 | 5 |
| holprop | 12 | 12 | 12 | 7 |

Alle 19 komen binnen als `land` / `sale` / `plot` — geen commercieel pand, geen
vloeroppervlak, geen huurregel van $2,1 mln meer.

De vijf holprop-regels zonder gebied heten allemaal "Gambia Land for sale". Twee
daarvan zouden op de oude regel in Serrekunda en Jambanjelly zijn beland, tegen
**$330 en $374 per m²** — tien tot zeventien keer het bandtarief daar. Met regel 4
blijven ze gebiedsloos: ze tellen landelijk mee en kunnen geen gebiedstarief
omgooien. Dat is precies wat je wilt.

---

## De selectors (pas aanzetten ná bovenstaande)

`market_sources.parse`, propertyshop:

```json
{
  "item": "<div class=\"item-listing-wrap[\\s\\S]*?<!-- item-listing-wrap -->",
  "fields": {
    "url":   "href=\"(https://gambiapropertyshop\\.com/property/[^\"]+)\"",
    "title": "<h2 class=\"item-title\">\\s*<a[^>]*>([\\s\\S]*?)</a>",
    "price": "(D|GMD|\\$|USD|€|EUR|£|GBP)\\s?([0-9][0-9.,]{2,})",
    "sqm":   "([0-9][0-9.,]*)\\s?(?:m2|m²|sqm)",
    "beds":  "([0-9]+)\\s?bed"
  },
  "list": [ …ongewijzigd… ], "pages": 4
}
```

De site draait nu op het Houzez-thema; `<article>` bestaat er niet meer. Het
sluitcommentaar `<!-- item-listing-wrap -->` begrenst elke kaart netjes — zonder
die grens loopt de laatste kaart door tot in het zoekwidget met de stedenlijst, en
dan pikt hij "Kerr Serign" en "monthly" op.

`market_sources.parse`, holprop:

```json
{
  "item": "<div[^>]*itemtype=\"https://schema\\.org/Residence\"[\\s\\S]*?(?=<div[^>]*itemtype=\"https://schema\\.org/Residence\"|$)",
  "fields": {
    "url":   "itemprop=\"url\" content=\"(https?://[^\"]+)\"",
    "title": "itemprop=\"name\" content=\"([^\"]+)\"",
    "price": "(D|GMD|\\$|USD|€|EUR|£|GBP)\\s?([0-9][0-9.,]{2,})",
    "sqm":   "([0-9][0-9.,]*)\\s?(?:m2|m²|sqm)"
  },
  "list": [ …ongewijzigd… ], "pages": 3
}
```

Holprop draagt schema.org-microdata; dat is een steviger anker dan een class-naam.

**Volgorde:** repo gelijktrekken → de vijf regels → deployen → `{"run":"propertyshop","dry":true}`
en `{"run":"holprop","dry":true}` bekijken (die geven nu ook echt hun afgekeurde
blokken terug) → pas dan de selectors in `market_sources.parse` zetten → nog een
dry run → daarna vanzelf mee in de nachtelijke oogst.

## Wat ik niet heb kunnen toetsen

- De **huizenpagina's** van propertyshop (`property-for-sale-in-gambia`) en
  gamrealty zijn vanuit deze omgeving niet op te halen (leeg antwoord; de
  edge function bereikt ze wel). Regel 1 is daar getoetst op een nagebouwde
  huiskaart — zelfde briefpapier, kop "3 bedroom house for sale" — en die blijft
  correct `house`. Een dry run na het deployen laat de echte uitkomst zien.
- De koersen in mijn toets zijn de koersen uit `area-prices.json` (D72,70/USD,
  D85,74/EUR); de functie haalt ze uit `fx_rates`. De bedragen hierboven zijn dus
  indicatief, de classificatie niet.
