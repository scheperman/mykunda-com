# Instructie voor Claude — vervolg op de SEO-analyse van mykunda.com

Datum: 24 augustus 2026
Basisdocument: `SEO-volledige-analyse.html` (volledige analyse, bevindingen 1–22)
Werkafspraken: `CLAUDE.md` — elke wijziging in de root, daarna spiegelen naar `deploy/`,
Edwin uploadt met overschrijven aan. Nooit rechtstreeks op de server werken.

---

## Al gedaan (niet opnieuw doen)

Quick wins 1–12 uit het rapport zijn op 24 augustus 2026 doorgevoerd en gespiegeld:

| Wat | Waar |
|---|---|
| FAQ-JSON-LD homepage herschreven naar de zichtbare tekst, 5 vragen | `index.html` |
| Twee onjuiste FAQ-antwoorden herschreven ("no restrictions", "we review") | `faq.html` |
| `property.html` krijgt `noindex` en wordt door het canonical-script op `index` gezet zodra er een geldige `?id=` is | `property.html` |
| `property.html` verwijderd uit de sitemap | `sitemap.xml` |
| H1 van 41 gebiedspagina's: "Kololi" → "Kololi property prices & area guide" (of "land prices" waar grond het hoofdproduct is) | 41 gebiedspagina's |
| Hardgecodeerde "View all 48 listings" → "View listings in Kololi" | 41 gebiedspagina's |
| `addressRegion` "Western Division" → "West Coast Region" | 41 gebiedspagina's |
| Prijs per m² en YoY toegevoegd aan het `Place`-schema, met `isPartOf` naar de prijsindex | 41 gebiedspagina's |
| Breadcrumb positie 2 wijst nu naar de gebiedshub in plaats van naar `search.html` | 41 gebiedspagina's |
| Nieuwe publieke prijsindex, statische tabel, `Dataset`-schema | `gambia-property-prices.html` |
| Nieuwe gebiedshub, 41 gebieden per regio + drie budgetbanden, `CollectionPage` + `ItemList` | `areas-in-the-gambia.html` |
| Footerlink "Market index" (noindex) → "Price index" (publiek) op 77 pagina's | alle publieke pagina's |
| Titles/H1 uit elkaar getrokken | `search.html`, `buy.html`, `agent.html` |
| Auteur van 12 gidsen: verzonnen `Person` "Awa Camara" verwijderd → `Organization`; byline "MyKunda"; datum als "Updated …" | 12 gidsen |
| Vangnetpatroon uitgebreid met `voorstel-`, `instructie-`, `bouwplan`; audit-bypass `?mkaudit=` toegevoegd | `.htaccess` |
| Footer aan de bron aangepast (anders draait build.mjs de 77 paginawijzigingen terug) | `app.js` |
| `JS_ROBOTS`-uitzondering, zodat `markPage()` de noindex van `property.html` niet terugzet | `build.mjs` |
| Onjuist commentaarblok over `market.html` gecorrigeerd | `robots.txt` |
| `noindex` toegevoegd | `voorstel-ownership-identificatie.html` |
| Twee nieuwe URL's toegevoegd | `sitemap.xml` |

**Te uploaden:** de volledige inhoud van `deploy/` (alle HTML, `robots.txt`, `sitemap.xml`,
`.htaccess`). Twee bestanden zijn nieuw: `gambia-property-prices.html` en
`areas-in-the-gambia.html`.

---

## Werkafspraak als je toegang krijgt tot de projectmap

Edwin kan je de projectmap op zijn laptop geven. Dat mag, maar het botst met de
kernregel in `CLAUDE.md`: het Claude Design-project is de enige plek waar
sitebestanden worden gewijzigd. Twee plekken die schrijven, betekent dat een correctie
stil verloren gaat bij de volgende levering. Daarom deze verdeling, zonder uitzondering:

**Wat je in de projectmap WEL doet**

- Alles lezen. Volledige context is juist de reden om de map te geven.
- `node build.mjs` draaien. Dat kan alleen lokaal — het Design-project heeft geen Node.
- Taak 1 en taak 2 uitvoeren: `build.mjs` en `app.js` aanpassen, de Supabase-query
  schrijven, de statische objectpagina's genereren, de sitemaps splitsen. Dit vereist
  Node en Supabase-credentials en kan dus nergens anders.
- `const V` in `sw.js` ophogen als er nieuwe inhoud is (`mk-v18` → `mk-v19`).
  build.mjs doet dat bewust niet.

**Wat je in de projectmap NIET doet**

- Losse tekst-, meta-, schema- of stylingwijzigingen in `.html`, `styles.css`,
  `robots.txt`, `sitemap.xml` of `.htaccess`. Die horen in het Design-project, anders
  overschrijft de volgende levering ze.
- `app.min.js` of `styles.min.css` met de hand bewerken. Dat zijn buildproducten:
  wijzig `app.js` / `styles.css` en draai `node build.mjs`.

**Teruggeven na lokaal werk**

Heb je lokaal `build.mjs`, `app.js` of `sw.js` gewijzigd, meld dan aan Edwin welke
bestanden dat zijn, zodat hij ze in het Design-project laat verwerken. Vanaf dat moment
is de projectversie weer de waarheid. Zonder die stap loopt de volgende levering uit het
Design-project over jouw werk heen.

**Twee dingen die build.mjs bezit — niet in de HTML repareren**

1. De **footer en header** komen uit `headerHTML()` / `footerHTML()` in `app.js` en
   worden door build.mjs statisch in elke pagina gezet. Een footerlink wijzig je in
   `app.js`, nooit in de 90 pagina's.
2. De **robots-metatag** wordt door `markPage()` in build.mjs herschreven op basis van
   `NOINDEX_PAGES` en `JS_ROBOTS`. Wil je een pagina op noindex, zet hem in die set —
   een tag in de HTML wordt bij de volgende build overschreven.

---

## Taak 1 — Statische objectpagina's genereren (hoogste prioriteit)

Dit is bevinding 1 uit het rapport en de grootste ontbrekende laag van de site: geen enkele
woning of kavel is indexeerbaar, omdat listings alleen na JavaScript uit Supabase komen.

Bouw dit in `build.mjs`:

1. Haal bij elke build alle **actieve** listings uit Supabase (dezelfde query die
   `app.js`/`app.min.js` gebruikt voor de zoekpagina).
2. Schrijf per listing één statisch bestand:
   `/property/<plaats>-<type>-<slug-of-id>.html`, bijvoorbeeld
   `/property/kololi-3-bed-villa-a1b2c3.html`. Slug uitsluitend lowercase, koppeltekens,
   geen dubbele koppeltekens, maximaal ~70 tekens.
3. Wat statisch in de HTML moet staan (niet via JS):
   - `<title>` — `<type> for sale in <plaats>, The Gambia — <prijs> | MyKunda`
   - `<meta name="description">` — kamers, kavelmaat, plaats, titelvorm, in één zin
   - `<h1>` — de listingtitel
   - prijs, kavelmaat, woonoppervlak, aantal kamers, plaats, Plus Code
   - self-referencing `<link rel="canonical">`
   - `RealEstateListing`-JSON-LD met `offers` (`price`, `priceCurrency`),
     `floorSize`, `numberOfRooms`, `geo`, `image`, `datePosted`,
     `provider` → `@id: https://mykunda.com/#organization`
   - de eerste foto met `width`/`height` en `fetchpriority="high"`
4. Interne links, in beide richtingen:
   - elke objectpagina linkt naar zijn gebiedspagina en naar de prijsindex;
   - elke gebiedspagina krijgt een blok "Available in <plaats>" met de objectpagina's van
     dat gebied (statisch gegenereerd, maximaal 12, daarna een link naar `search.html`).
5. Sitemaps: schrijf `sitemap-listings.xml` en maak van `sitemap.xml` een
   `<sitemapindex>` die `sitemap-pages.xml` en `sitemap-listings.xml` bundelt.
   Robots.txt verwijst dan naar de index.
6. Verwijderde of verkochte listings: laat `build.mjs` een regel voor `.htaccess`
   genereren met `Redirect 410` voor verkochte objecten, of een `301` naar de
   gebiedspagina. Nooit stil laten staan — dat levert soft-404's op.
7. De JS-zoekpagina blijft precies zoals hij is. De statische pagina's zijn de ingang
   vanuit Google, niet de gebruikerservaring.

Let op: `app.min.js` is de geminificeerde build van `app.js`. Wijzig altijd `app.js` en
regenereer, nooit alleen `app.min.js`.

## Taak 2 — Prijsindex koppelen aan de echte databron

`gambia-property-prices.html` is nu **handmatig gevuld** met exact de cijfers die statisch
op de 41 gebiedspagina's staan (`$/m²` uit `#qs0` en de YoY daarnaast). Dat is correct
maar niet onderhoudbaar.

- Laat `build.mjs` de tabel genereren uit dezelfde bron als `market-index.js`.
- Werk in één beweging ook `#qs0` op de gebiedspagina's en het `additionalProperty`-blok
  in hun `Place`-schema bij, zodat pagina, schema en index nooit uiteenlopen.
- Zet `dateModified` in het `Dataset`-schema en de zichtbare "Last updated" op de
  builddatum.
- Voeg een kolom "aantal observaties" toe zodra die data er is. Dat is precies het cijfer
  waarmee je betrouwbaarder bent dan de concurrentie.

## Taak 3 — Listingaantallen dynamisch maken

De knoptekst op de gebiedspagina's is nu neutraal ("View listings in Kololi"). Wil Edwin het
aantal tóch tonen, doe dat in `app.js` ná het laden, met de echte count uit Supabase, en
laat de knop zonder aantal als de count 0 of onbekend is. Nooit een getal in de HTML zetten.

## Taak 4 — "In short"-blokken op de twaalf gidsen

Elke gids heeft al een zichtbare byline en datum. Wat ontbreekt is het kernantwoord bovenaan
— het blok dat in AI Overviews en Perplexity wordt overgenomen. Per gids:

```html
<aside class="keytakeaways">
  <h2>In short</h2>
  <ul><li>…</li><li>…</li><li>…</li><li>…</li></ul>
</aside>
```

Regels: vier bullets, elk een volledige zin met het concrete getal of feit erin, geen
teasers, geen "lees verder". Alleen feiten die verderop in díe gids ook staan en daar
onderbouwd zijn. Voeg de styling toe aan `styles.css` en regenereer `styles.min.css`.

## Taak 5 — Auteur en methode zichtbaar maken

- `about.html`: sectie `#team` met namen, rol en verantwoordelijkheid. De gidsen linken
  daar nu naar (`author.url`), dus het anker moet bestaan.
- **Afgehandeld op 24 augustus 2026:** Awa Camara is geen medewerker. Het `Person`-object
  is uit alle 12 gidsen verwijderd en vervangen door
  `"author":{"@type":"Organization","@id":"https://mykunda.com/#organization"}`; de
  zichtbare byline is nu "MyKunda". Komt er een echte redacteur of vakinhoudelijke
  reviewer, zet die dan terug als `Person` **met** een eigen sectie op `about.html#team`
  — en alleen dan.
- Nieuwe publieke pagina `how-we-measure-prices.html`: bron van de observaties, hoe het
  gemiddelde tot stand komt, frequentie, wat het níet is. `sources.html` bestaat al maar
  staat op noindex — gebruik die inhoud als basis, maak een publieke variant. Opnemen in de
  sitemap en linken vanuit de prijsindex.

## Taak 6 — Landingspagina voor grond

`/land-for-sale-in-the-gambia.html`, volgens rij 2 van het contentplan in het rapport.
Neem de statische prijs-per-m²-cijfers van de kavelgebieden over uit de prijsindex, en link
naar `search.html?type=sale&cat=land`. Sitemap bijwerken, en het navigatie-item "Land" in
de header van álle pagina's laten wijzen naar deze pagina in plaats van naar de JS-zoekpagina
(de header staat statisch in elke pagina, dus dat is een globale vervanging).

## Taak 7 — Juridische controle vóór publicatie

De herschreven FAQ's op `index.html` en `faq.html` noemen bewust **geen** getallen over
buitenlands eigendom (maximale kavelgrootte, maximale leaseduur, ministeriële goedkeuring).
Bronnen op internet spreken elkaar hierover tegen. Laat een Gambiaanse advocaat het juiste
antwoord schriftelijk bevestigen; publiceer het dan mét bron, datum en wetsartikel in
`guide-freehold-leasehold-customary-land-explained.html` en
`guide-buying-property-in-the-gambia-as-a-foreigner.html`. Dat is de meest citeerbare pagina
die op dit onderwerp te maken is — maar alleen met de echte bron erbij.

## Taak 8 — Twee technische controles buiten de SEO-scope

1. **`sw.js` en HTML.** Controleer of de service worker HTML network-first behandelt.
   Is hij cache-first op `.html`, dan zien terugkerende bezoekers oude pagina's ook na een
   upload — en zien ze de wijzigingen van vandaag dus niet.
2. **CSP en de betaalflow.** `_headers` staat `https://*.modempay.com` toe in
   `form-action`, `frame-src` en `connect-src`; de live `.htaccess`-CSP niet. Op
   FTP-hosting is `_headers` inert, dus de `.htaccess`-versie geldt. Draait de betaalflow
   via modempay, dan blokkeert de browser hem live. Trek de twee CSP's gelijk, of haal
   `_headers`/`_redirects`/`vercel.json` weg als die hosting definitief niet gebruikt wordt.

---

## Wat Edwin zelf moet doen (geen Claude-taak)

1. **Search Console, vóór de volgende wijziging**: exporteer 16 maanden prestaties per
   pagina naar CSV. Zonder die nulmeting is het effect van vandaag later niet aantoonbaar.
2. **URL-inspectie** op `/kololi.html`, `/buy.html` en `/property.html` → "Gerenderde
   HTML" bekijken. Dat is het bewijs voor bevinding 1.
3. **Indexering aanvragen** voor `/gambia-property-prices.html` en
   `/areas-in-the-gambia.html` zodra ze live staan.
4. **Google Bedrijfsprofiel** aanmaken als service-area business voor Greater Banjul en de
   Kombo's. Zonder profiel geen Maps en geen lokaal pakket — in Gambia zelf de
   belangrijkste vindplek.
5. **Beslissing over de AI-crawlers** (bevinding 21): `ClaudeBot` en `Google-Extended`
   openzetten of dicht houden. Nu dicht, met `OAI-SearchBot`, `ChatGPT-User`,
   `PerplexityBot`, Googlebot en Bingbot open.
6. **Audit-bypass**: vervang in `.htaccess` de waarde `MKA-2026-Kunda-7X` door een eigen
   lange geheime waarde en bewaar die buiten de site.
