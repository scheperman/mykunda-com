# Instructie voor Claude Design — taken 4 t/m 7 van de SEO-vervolgopdracht

Datum: 24 augustus 2026
Bron: `Instructie-Claude-SEO-vervolg.md`, taken 4, 5, 6 en 7
Geschreven door: de Claude die in de lokale kopie `C:\MyKunda` aan `build.mjs` werkt

Deze instructie is zelfstandig leesbaar. Je hoeft `Instructie-Claude-SEO-vervolg.md`
er niet bij te hebben, maar hij spreekt hem op twee punten tegen — dat staat hieronder
expliciet uitgelegd bij taak 5 en taak 6. **Volg deze instructie, niet de oude.**

---

## 0. Wat er ondertussen in `build.mjs` is gebeurd — lees dit eerst

Taak 1 (statische objectpagina's) is uitgevoerd. `build.mjs` genereert nu bij elke
build een pagina per actieve listing. Daardoor is er een **derde categorie bestanden
die eigendom is van `build.mjs`** bijgekomen. Raak deze drie dingen niet aan:

| Wat | Waar | Waarom niet aankomen |
|---|---|---|
| Het blok tussen `# mk-listings-start` en `# mk-listings-end` | `.htaccess` | Bevat de 410/301-regels voor verkochte en verwijderde objectpagina's. Wordt elke build volledig herschreven. Een handmatige correctie is bij de eerstvolgende build weg. |
| Het blok tussen `<!--mk-listings-->` en `<!--/mk-listings-->` | de 41 gebiedspagina's | Het blok "Available in *plaats*" met links naar de objectpagina's. Idem: elke build opnieuw geschreven. |
| De hele map `/listing/` | root en `deploy/` | Volledig gegenereerd. Nooit met de hand een bestand toevoegen of wijzigen. |

Dit komt bovenop de twee die al golden: header/footer uit `headerHTML()`/`footerHTML()`
en de robots-metatag uit `markPage()`.

**Twee dingen die je in de root níet mag veranderen:**

1. `sitemap.xml` in de root blijft een gewone `<urlset>` met de vaste pagina's. Maak
   er **geen** `<sitemapindex>` van. `build.mjs` schrijft de index alleen in `deploy/`,
   samen met `sitemap-pages.xml` en `sitemap-listings.xml`. Zou je de root-versie
   omzetten, dan is de lijst met vaste pagina's na één build verdwenen.
2. `robots.txt` hoeft niet gewijzigd: die verwijst al naar `https://mykunda.com/sitemap.xml`,
   en dat is in `deploy/` precies de index.

Nieuwe pagina's die je hieronder maakt, voeg je **wel** toe aan `sitemap.xml` in de root.

---

## Taak 4 — "In short"-blok op de twaalf gidsen

### Wat er moet gebeuren

Boven aan elke gids, direct **onder de `<h1>` en de byline en boven de eerste `<h2>`**,
komt één blok met het kernantwoord. Dat is het blok dat AI Overviews en Perplexity
overnemen; zonder dat blok wordt de gids wel gelezen maar niet geciteerd.

### De opmaak, letterlijk

```html
<aside class="keytakeaways">
  <h2>In short</h2>
  <ul>
    <li>…</li>
    <li>…</li>
    <li>…</li>
    <li>…</li>
  </ul>
</aside>
```

### De styling

Toevoegen aan `styles.css` (niet aan `styles.min.css` — dat is een buildproduct):

```css
/* In short — kernantwoord boven aan een gids */
.keytakeaways{border:1px solid var(--line);border-left:4px solid var(--green-700);
  border-radius:var(--r-sm);background:var(--sand,#FAF8F4);padding:18px 20px;margin:22px 0 30px}
.keytakeaways h2{font-family:var(--sans);font-size:13px;font-weight:800;text-transform:uppercase;
  letter-spacing:.07em;color:var(--green-800);margin:0 0 10px}
.keytakeaways ul{margin:0;padding-left:20px}
.keytakeaways li{margin:0 0 8px;line-height:1.55}
.keytakeaways li:last-child{margin-bottom:0}
@media(max-width:640px){.keytakeaways{padding:15px 16px}}
```

Controleer of `--sand` in `styles.css` bestaat. Zo niet: haal de fallback weg en gebruik
een kleur die er wél is. Verzin geen nieuwe custom properties.

### De teksten

Hieronder staat per gids de vier bullets. Ze zijn gecontroleerd tegen de tekst van díe
gids; achter elke bullet staat tussen vierkante haken de woordgroep waaruit het getal
komt. **Die haken en hun inhoud gaan er bij het plaatsen af** — ze staan er alleen zodat
je kunt narekenen dat het klopt. Wijk niet af van de cijfers.

#### guide-bank-mortgages-in-the-gambia.html
- The Central Bank of The Gambia's Monetary Policy Rate stands at 14%, cut from 16% in February 2026, with the standing lending facility at 15%. [bron: "Monetary Policy Rate is 14% — cut from 16% in February 2026 and held there since, with the standing lending facility at 15%"]
- Where a Gambian housing loan is available at all, it carries 15–22% variable interest, a maximum term of 10–15 years, a loan-to-value ceiling of 60–70% and a down payment of 30–40%. [bron: "Interest rate 15 – 22% per year (variable, and moves with the policy rate)"]
- A loan of €100,000 at 18% over 15 years costs roughly three times the original amount in total repayments, against 1.3 to 1.5 times at typical European rates. [bron: "a loan of €100,000 at 18% over 15 years costs roughly three times the original amount in total repayments"]
- Foreign buyers are effectively excluded from local mortgages and mostly finance instead by remortgaging at home, where interest is 3–5%. [bron: "the benefit of low European interest rates (3 – 5%)"]

#### guide-best-areas-to-buy-on-the-gambian-coast.html
- Bare land in Kololi runs at about $140/m² against roughly $14/m² in Kartong, a tenfold spread over about an hour's drive. [bron: "land in Kololi costs roughly ten times land in Kartong, over a drive of about an hour"]
- A 600 m² compound plot costs around $84,000 in Kololi, about $29,000 in Brufut and roughly $11,000 in Sanyang. [bron: "Kololi ~$140/m² ~$84,000 … Brufut ~$48/m² ~$29,000 … Sanyang ~$18/m² ~$11,000"]
- Short-let demand on the strip rests on tourism, with 233,113 visitors arriving in 2025 and nearly all of them staying between Bakau and Brufut. [bron: "233,113 visitors arrived in 2025"]
- Diaspora money is the other driver: the Central Bank recorded US$775.6 million of remittances in 2024, with growth of around 5.3–5.7% projected for 2026. [bron: "US$775.6 million of remittances in 2024"]

#### guide-building-a-house-in-the-gambia.html
- Building is controlled by the Physical Planning and Development Control Act 1990 (Act No. 1 of 1991), and a permit is required for the fence and boys' quarters as well as the main house. [bron: "Physical Planning and Development Control Act 1990 (Act No. 1 of 1991)"]
- Construction runs at roughly D26,000 to D48,000 per m², so a 150 m² three-bedroom house costs around €45,000 at a standard finish and €75,000 or more at a higher one. [bron: "roughly 300 to 500+ per square metre in hard currency — call it D26,000 to D48,000 per m²"]
- A 50 kg bag of 42.5R Portland cement was D525–D575 (€6–€7) in the January 2026 survey, and cement is the most volatile line on any Gambian site. [bron: "Cement, 50 kg bag (42.5R Portland) D525 – D575"]
- Payments should be tied to inspected stages with the largest tranches at the end, plus a retention of five to ten per cent held for a defects period after handover. [bron: "hold a retention of five to ten per cent for a defects period after handover"]

#### guide-buying-property-in-the-gambia-as-a-foreigner.html
- Non-citizens can own property, but on the coast the State Lands Act 1990 vests land in the State and grants it on leases with an initial term of 99 years, so most "ownership" there is a long State lease. [bron: "leases with an initial term of 99 years"]
- Outside those areas the Lands (Regions) Act caps the interest a non-indigene may acquire and requires approval for tenancies longer than three years, and a deed cutting across those rules can be voidable. [bron: "requires approval for tenancies longer than three years"]
- The state takes transfer tax of commonly around 5% of declared value, stamp duty of roughly 1–2%, rental income tax of 8% residential or 15% commercial, and capital gains of the higher of 15% of the net gain or 5% of the selling price. [bron: "Commonly around 5% of the declared value"]
- Local borrowing is priced out of reach with the policy rate at 14% and the standing lending facility at 15%, which is why almost everyone buys cash or on a developer instalment plan. [bron: "The Central Bank's policy rate stands at 14%, with the standing lending facility at 15%"]

#### guide-cost-of-buying-property-in-the-gambia.html
- Budget 8–12% on top of the asking price for transfer tax, stamp duty, legal work, survey, registration and FX. [bron: "budget 8 – 12% on top of the asking price"]
- On a worked €80,000 villa the realistic total is €91,000–€93,000, including €4,000 transfer tax at 5% and €1,200 stamp duty at about 1.5%. [bron: "Realistic total €91,000 – €93,000"]
- Once you own it, rental income is taxed at 8% residential or 15% commercial on gross rent, capital gains at the higher of 15% of the net gain or 5% of the selling price, and company-held property at 27% corporation tax. [bron: "Rental income tax — residential 8% of gross rent"]
- MyKunda sellers pay a flat fee rather than a percentage commission, so the listing cost is identical whether a property sells for $50,000 or $500,000. [bron: "the same whether a property sells for $50,000 or $500,000"]

#### guide-developer-financing-in-the-gambia.html
- The typical structure is 5–10% to reserve, 20–30% on contract signing and the balance over 3–5 years, so on an €80,000 property that is €8,000, then €16,000, then €56,000. [bron: "Reservation / booking 5 – 10% of the total price"]
- Many developers charge 0% interest during construction, and those that do charge take only 3–8%, against bank rates of 15–22%. [bron: "many developers charge 0% interest during the construction period"]
- Named developers offering structured plans include TAF Africa Global, with instalment plans of up to 5 years and typically 20–30% down, alongside Blue Ocean and Global Properties. [bron: "Offers instalment plans of up to 5 years on villas and apartments, typically with 20 – 30% down payment"]
- Private seller and small-builder plans are less structured, usually a deposit of 40–60% with the balance over 12–36 months, and need a lawyer-drawn agreement and escrow. [bron: "a large deposit of 40 – 60% with the balance paid over 12 – 36 months"]

#### guide-freehold-leasehold-customary-land-explained.html
- The State Lands Act 1990 vested Banjul and Kombo Saint Mary in the State and provides for leases with an initial term of 99 years, so much of what is sold as ownership on the Kombo coast is legally a long State lease. [bron: "leases with an initial term of 99 years"]
- When buying into an existing lease the remaining term is part of what you pay for, and an assignment needs Ministry of Lands consent — a 99-year lease granted in 1998 is a different asset from one granted last year. [bron: "A 99-year lease granted in 1998 is a different asset from one granted last year"]
- Around a quarter of the adult population feels tenure-insecure, and a recurring source of conflict is customary land that has also been granted to a third party as a State leasehold. [bron: "around a quarter of the adult population feels tenure-insecure"]
- The Gambia Land Policy 2026–2035 proposes Certificates of Customary Ownership and full registration and digitalisation, but nothing has changed yet — a policy is not a register. [bron: "The Gambia's Land Policy 2026 – 2035"]

#### guide-how-to-verify-land-title-in-the-gambia.html
- Verification rests on four independent checks: a Land Registry search, a check with Physical Planning against the approved layout, your own licensed surveyor on the boundaries, and local enquiries with the alkalo and neighbours. [bron: "The four checks that actually verify ownership"]
- The legal and search work takes between two and six weeks, longer for customary land or an incomplete chain of ownership. [bron: "somewhere between two and six weeks"]
- Indicative bare-land prices run from about $140/m² in Kololi to about $14/m² in Kartong, and a 600 m² plot — the typical walled family compound — is roughly 8% of a football pitch. [bron: "600 m² ~8% of a football pitch"]
- Research finds roughly a quarter of Gambian adults feel insecure about their tenure, and until the Land Policy 2026–2035 produces a digital register, verification stays manual. [bron: "roughly a quarter of Gambian adults, urban and rural alike, feel insecure about their tenure"]

#### guide-inheritance-and-wills-for-gambian-property.html
- Three systems can govern a Gambian estate — statutory law through the High Court, Sharia through the Cadi Courts, and customary law through district tribunals. [bron: "the Sharia as regards matters of marriage, divorce and inheritance among members of the communities to which it applies"]
- Section 137 of the Constitution establishes the Cadi Courts with a panel of the Cadi and two other Sharia scholars; the court itself was constituted in 1905 under British rule. [bron: "the court was constituted in 1905 under British rule"]
- Sharia shares are fixed, not discretionary: in one reported Gambian case the wife took one-eighth and a son and daughter shared the residue, the male taking double the share of the female. [bron: "the wife took one-eighth and a son and daughter shared the residue, with the male taking double the share of the female"]
- Nothing can be sold, transferred or mortgaged until a grant of probate or letters of administration issues through the Probate Registry, which is why estates freeze. [bron: "a grant of probate (with a will) or letters of administration (without one) through the Probate Registry"]

#### guide-renting-out-property-in-the-gambia.html
- Average hotel occupancy reaches around 90% in the winter months and barely 25% for the rest of the year, so a holiday let earns most of its annual income in roughly five months. [bron: "average hotel occupancy reaches around 90% in the winter months and barely 25% for the rest of the year"]
- Rental income tax is charged on gross rent, not profit, at 8% residential and 15% commercial, and non-residents are taxed exactly as residents are. [bron: "Rental income tax — residential 8% of gross rent"]
- On a worked €80,000 two-bedroom near the strip, a short let nets about €3,000–€3,600 (3.8–4.5%) after tax and management, while a long-term let at €450 a month nets about €3,700 (4.6%). [bron: "≈ €3,000 – €3,600 (3.8 – 4.5%)"]
- The Gambia Revenue Authority began rolling out the first phase of a Rental Compliance System in October 2025, so letting income that once went unnoticed increasingly does not. [bron: "Rental Compliance System in October 2025"]

#### guide-residency-and-retiring-in-the-gambia.html
- Owning property gives no right to stay: British citizens receive a 28-day stamp on arrival, extendable twice by 28 days to about 84 days in total, after which a residence permit and Alien ID card are required. [bron: "a 28-day stamp on arrival, extendable twice by 28 days — up to about 84 days in total"]
- Since the January 2024 revision a non-ECOWAS Permit B costs D5,000 (roughly €58) and the Alien ID card D2,500 (roughly €29), with ECOWAS Permit A at D3,000 and Permit B at D2,500. [bron: "a D5,000 permit is roughly €58 and a D2,500 alien card roughly €29"]
- The expatriate quota tax is the one large figure, around D50,000 a year for non-ECOWAS nationals — up from D40,000 — and roughly D10,000 for ECOWAS nationals, and it bites on employment rather than retirement. [bron: "around D50,000 a year for non-ECOWAS nationals and roughly D10,000 for ECOWAS nationals"]
- A residence permit runs for a calendar year at the same fee whenever it is taken out, and it covers dependants — spouse and children under 18. [bron: "spouse and children under 18"]

#### guide-sending-money-to-the-gambia.html
- On the UK–Gambia corridor one provider charged a zero fee but applied a rate of D84.00 against a market reference of D91.58 — an exchange-rate margin of 8.28% that was the entire cost. [bron: "an exchange-rate margin of 8.28%, which was the entire total cost"]
- Total corridor costs commonly run 8.3–9.9%, against a global average of 6.36% and a Sub-Saharan Africa average of around 8.5%. [bron: "the global average cost of sending a remittance is 6.36%"]
- On a purchase-sized transfer the difference is money, not rounding: sending €80,000 costs €6,640 at 8.3% but €1,200 at a keenly priced 1.5% bank rate. [bron: "€80,000 €6,640 €7,920 €1,200"]
- Check every quote against the Central Bank's daily valuation rates, which in August 2026 were roughly D72.6 to the dollar, D85.5 to the euro and D96.8 to the pound. [bron: "1 US dollar D72.6 … 1 euro D85.5 … 1 pound sterling D96.8"]

### Wat er bij taak 4 níet moet gebeuren

- **Geen `Article`-schema aanpassen.** De JSON-LD van de gidsen blijft zoals hij is.
  Voeg geen `speakable`, geen `FAQPage`, geen `HowTo` toe. Het blok is zichtbare tekst,
  meer niet.
- **Geen bestaande koppen of alinea's herschrijven** om ze bij de bullets te laten
  aansluiten. De bullets zijn uit de gids gehaald, niet andersom.
- **Geen vijfde bullet, geen drie.** Vier, elk één zin.
- **Geen "Read more"-link in het blok.** Dat maakt er een teaser van en dan wordt hij
  niet overgenomen.
- **`styles.min.css` niet met de hand bewerken.** Edwin draait `node build.mjs`, dat
  regenereert hem.

### Controle achteraf

- 12 gidsen × één `<aside class="keytakeaways">`, geen enkele twee keer.
- Het blok staat vóór de eerste `<h2 id="s1">`.
- Elk cijfer in een bullet is met Ctrl-F terug te vinden in dezelfde gids.
- `styles.css` bevat het blok één keer.

---

## Taak 5 — auteur en methode zichtbaar maken

### ⚠ Eerst dit: de oude instructie klopt hier niet meer

`Instructie-Claude-SEO-vervolg.md` zegt: *"de gidsen linken daar nu naar (`author.url`),
dus het anker moet bestaan"*, en: *"Eerst nagaan of Awa Camara een echte, aanwijsbare
persoon is."*

Ik heb alle twaalf gidsen gecontroleerd op 24 augustus 2026. De stand is:

- **Geen enkele gids noemt Awa Camara.** Nergens in de twaalf bestanden.
- **Geen enkele gids bevat een `Person`-object.** Alle twaalf hebben
  `"author": {"@type": "Organization", "@id": "https://mykunda.com/#organization", "name": "MyKunda"}`.
- **Geen enkele gids heeft een `author.url`.** Er is dus geen link naar `about.html#team`
  die stuk is.

Het risico van een verzonnen auteur bestaat niet meer. **Voeg dus vooral geen `Person`
terug toe** — niet als "verbetering", niet omdat E-E-A-T om een auteur vraagt. Een
organisatie als auteur is hier het eerlijke antwoord.

### Wat er wél moet gebeuren

**5a. `about.html` — anker en verantwoordelijkheid.**

De sectie bestaat al:

```html
  <h2>The team</h2>
```

Vervangen door:

```html
  <h2 id="team">The team</h2>
```

De drie kaarten eronder staan er al:

```html
    <div class="member"><div class="avatar">ES</div><div class="nm">Edwin Scheperman</div><div class="role">Founder</div></div>
    <div class="member"><div class="avatar">LC</div><div class="nm">Legal counsel</div><div class="role">Title verification · Gambia</div></div>
    <div class="member"><div class="avatar">AT</div><div class="nm">Local agents</div><div class="role">Kololi · Brufut · South coast</div></div>
```

Voeg daaronder één alinea toe die zegt wie waarvoor tekent:

```html
  <p>Market data, price index and written guides are produced and checked by MyKunda,
  with Edwin Scheperman responsible for what is published. Title checks are carried out
  by a Gambian legal practitioner; viewings and photography by agents on the coast.
  Where a figure comes from an outside source, that source is named on the page itself.</p>
```

Vul geen namen in voor "Legal counsel" en "Local agents" tenzij Edwin ze aanlevert.
Een verzonnen naam is erger dan een functieomschrijving.

**5b. Nieuwe publieke pagina `how-we-measure-prices.html`.**

`sources.html` bestaat al maar staat op noindex en is een backofficepagina (hij staat in
`NOINDEX_PAGES` in `build.mjs`). Gebruik de inhoud ervan als basis voor een publieke
variant. Wat erin hoort:

- waar de observaties vandaan komen (vraagprijzen, welke bronnen, welke gebieden);
- hoe het gemiddelde per m² tot stand komt en wat er wordt weggelaten (uitschieters,
  dubbele advertenties);
- hoe vaak het wordt bijgewerkt;
- **wat het níet is**: geen taxatie, geen transactieprijzen, geen officieel register.
  Dit is de alinea die de pagina geloofwaardig maakt. Schrijf hem niet weg.

Verder:
- `<title>`, `<meta name="description">`, canonical, complete Open Graph-set — zoals elke
  publieke pagina.
- Opnemen in `sitemap.xml` in de root.
- Linken vanuit `gambia-property-prices.html`, dicht bij de tabel, met ankertekst
  "How we measure these prices".
- **Niet** in `NOINDEX_PAGES` in `build.mjs` zetten — die pagina moet juist indexeerbaar
  zijn. `build.mjs` regelt de robots-tag vanzelf.
- `sources.html` blijft bestaan en blijft noindex. Niet verwijderen, niet openzetten.

### Controle achteraf

- `https://mykunda.com/about.html#team` springt naar de teamsectie.
- `how-we-measure-prices.html` staat in `sitemap.xml`, heeft een canonical naar zichzelf
  en is vanuit de prijsindex bereikbaar.
- Nergens in de site staat een persoonsnaam die niet van een echt persoon is.

---

## Taak 6 — landingspagina voor grond

### Wat er moet gebeuren

Nieuwe pagina `land-for-sale-in-the-gambia.html`, met:

- `<h1>Land for sale in The Gambia</h1>` en een `<title>` die daar niet identiek aan is
  (bijvoorbeeld `Land for sale in The Gambia — plot prices per m² by area 2026`);
- een **statische** tabel met de prijs per m² van de kavelgebieden, overgenomen uit
  `gambia-property-prices.html`. Zelfde cijfers, zelfde peilmaand. Niet opnieuw
  berekenen, niet afronden;
- per gebied een link naar de gebiedspagina (`kartong.html`, `sanyang.html`, …);
- een link naar `search.html?type=sale&cat=land` als call to action;
- een link naar `gambia-property-prices.html` en naar
  `guide-freehold-leasehold-customary-land-explained.html`;
- canonical, description, complete Open Graph-set;
- opnemen in `sitemap.xml` in de root.

### ⚠ De header: NIET in de HTML aanpassen

De oude instructie zegt: *"het navigatie-item 'Land' in de header van álle pagina's
laten wijzen naar deze pagina … de header staat statisch in elke pagina, dus dat is een
globale vervanging."*

**Dat is onjuist en een globale vervanging zou schade doen.** De header staat wel
statisch in elke pagina, maar hij wordt daar bij elke build ingezet door `build.mjs`,
uit deze regel in `app.js`:

```js
const links = [['Buy','buy.html'],['Rent','rent.html'],['List','sell.html'],['Land','search.html?type=sale&cat=land'],['Verify','verify.html'],['Areas','#'],['Guides','guides.html']];
```

Vervang je het in de HTML, dan is het bij de volgende `node build.mjs` weer weg — en in
de tussentijd wijkt de header op 60 pagina's af van de bron. Hetzelfde geldt voor de
footerlink "Land & plots", die uit `footerHTML()` in `app.js` komt.

**`app.js` is lokaal werk, geen Claude Design-werk.** Meld dus alleen dat de pagina
klaar is; de headerwijziging wordt in de lokale kopie gedaan zodra de pagina bestaat.
Raak `app.js`, `app.min.js` en de header in de HTML niet aan.

### Wat er bij taak 6 verder níet moet gebeuren

- **Geen gebiedspagina's aanpassen** om naar de nieuwe pagina te linken. Die pagina's
  hebben nu een gegenereerd blok van `build.mjs` erin staan; laat ze met rust.
- **Geen prijzen verzinnen** voor gebieden die niet in de prijsindex staan. Laat ze weg.
- **Geen `Dataset`-schema** op deze pagina. Dat hoort bij `gambia-property-prices.html`;
  twee pagina's die dezelfde dataset claimen is een verkeerd signaal. Een gewone
  `WebPage` met `BreadcrumbList` is genoeg.

### Controle achteraf

- Elk getal op de nieuwe pagina komt letterlijk terug in `gambia-property-prices.html`.
- `sitemap.xml` bevat de nieuwe URL.
- Het navigatie-item "Land" wijst nog steeds naar `search.html?type=sale&cat=land` —
  dat verandert pas na de aanpassing in `app.js`.

---

## Taak 7 — juridische controle vóór publicatie

**Dit is geen Claude Design-taak en ook geen Claude-taak. Doe hier niets aan.**

De herschreven FAQ's op `index.html` en `faq.html` noemen bewust geen getallen over
buitenlands eigendom (maximale kavelgrootte, maximale leaseduur, ministeriële
goedkeuring). Bronnen op internet spreken elkaar tegen.

Ik heb gecontroleerd of er een betrouwbaar juridisch corpus voor Gambia te raadplegen is:
in de Legal Data Hunter-database staan voor Gambia (`GM`) **110 documenten in totaal**,
tegen honderdduizenden voor vergelijkbare jurisdicties. Dat is te dun om iets op te
baseren. De conclusie van de oude instructie blijft dus staan: dit heeft een schriftelijke
bevestiging van een Gambiaanse advocaat nodig, met wetsartikel en datum.

**Concreet voor jou:**

- Voeg **geen** getallen over buitenlands grondbezit toe aan
  `guide-freehold-leasehold-customary-land-explained.html` of
  `guide-buying-property-in-the-gambia-as-a-foreigner.html`.
- De bestaande formuleringen in die twee gidsen — 99 jaar staatslease onder de State
  Lands Act 1990, en goedkeuring voor pacht langer dan drie jaar onder de Lands (Regions)
  Act — blijven staan zoals ze zijn. Die staan er al en zijn onderbouwd.
- Verscherp de FAQ's op `index.html` en `faq.html` niet.

---

## Waarom dit alles nodig is

De site scoort nu op gebieden en gidsen, maar niet op de twee vragen waar het geld zit:
"kan ik als buitenlander grond kopen in Gambia" en "wat kost een kavel per m²". Taak 4
maakt de gidsen citeerbaar in AI-antwoorden, taak 5 maakt zichtbaar wie er achter de
cijfers staat — zonder dat is een prijsindex niet meer dan een tabel — en taak 6 geeft
grond een eigen ingang in plaats van een JavaScript-zoekpagina die Google niet leest.
Taak 7 is de rem: de meest citeerbare pagina die op dit onderwerp te maken is, is ook de
pagina waar een fout getal het meeste schade doet.

## Levering

Meld bij oplevering precies welke bestanden zijn gewijzigd of toegevoegd, zodat Edwin
weet wat hij moet uploaden. Denk aan `styles.css`, de twaalf gidsen, `about.html`,
`sitemap.xml` en de twee nieuwe pagina's. Edwin draait daarna `node build.mjs`, en pas
daarna is `deploy/` uploadklaar.
