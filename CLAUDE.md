# Werkafspraken MyKunda

## Eén bron van waarheid

Deze map — `C:\Users\User\MyKunda\project` — is de bron van mykunda.com.
Wijzigingen worden hier gemaakt en nergens anders.

Tot 25 augustus 2026 lag de bron in het Claude Design-project van het account
`edwinscheperman@gmail.com` en was deze map een spiegel daarvan. Dat is niet meer
zo: de ontwikkeling is verhuisd naar `admin@mykunda.com` en deze git-repo heeft de
rol van bron overgenomen.

**Draai `spiegel-bijwerken.mjs` niet meer.** Dat script staat in de map hierboven en
leegt deze map voordat het een Design-export uitpakt. Er komen geen exports meer;
draaien betekent nu alleen werk kwijtraken.

Op de live server wordt **nooit** rechtstreeks een bestand aangepast — niet met de
bestandsbeheerder van de host, niet in een online editor, niet handmatig via FTP.

## Waarom

Uploaden is eenrichtingsverkeer: een upload overschrijft het serverbestand ongeacht
de datum, en er komt nooit iets terug naar het project. Een correctie die alleen op
de server staat, gaat bij de eerstvolgende upload stil verloren.

Is er tóch iets rechtstreeks op de server gewijzigd: eerst dat bestand hier
verwerken, pas daarna opnieuw uploaden.

## De vaste leverroute

1. de wijziging in de **root** van deze map maken;
2. `node build.mjs` draaien;
3. de hele inhoud van `deploy/` via FTP uploaden, met overschrijven aan;
4. Cloudflare leegmaken (zie hieronder);
5. `git add -A` en committen, met in het bericht wat er live is gezet.

Stap 2 is niet optioneel. De build doet drie dingen die je met de hand niet doet:
`app.min.js` en `styles.min.css` opnieuw minificeren, één verse `?v=`-stempel in elke
pagina én in `sw.js` zetten, en het `<!--mk-mark-->`-blok met de robots-metatag
injecteren.

Een bestand dat rechtstreeks uit de root naar de server gaat, mist die drie dingen.
Dat is stil kapot: de pagina werkt, maar heeft geen robots-tag en een stempel die niet
matcht met de service worker, waardoor de precache voor die pagina dood gewicht is.
Dit gebeurde op 25-08-2026 met de gids over agentregulering.

**`build.mjs` leest alleen de root** (`readdir('.')`, geen recursie) en ruimt daarna
alles in `deploy/` op wat niet in de bouwlijst staat. Een bestand dat niet in de root
staat, bestaat voor de build niet en komt dus nooit live.

### Wat hiermee is vervallen

De oude route liep via een map `sync-naar-lokaal/`: wijzigingen werden daarin verzameld
en overgezet naar een aparte lokale kopie waar gebouwd werd. Die omweg bestond omdat
het project en de buildmap twee verschillende plekken waren. Dat is nu één map, dus die
stap vervalt volledig. `sync-naar-lokaal/` in de geschiedenis is een oude momentopname;
niet als bron gebruiken.

Hetzelfde geldt voor `archief/`, `upload-*/` en `MyKunda-oud/` in de map hierboven.

## Twee dingen zijn eigendom van `build.mjs`

Niet in de HTML repareren:

1. header en footer komen uit `headerHTML()` / `footerHTML()` in `app.js`;
2. de robots-metatag wordt herschreven door `markPage()`, op basis van `NOINDEX_PAGES`
   en `JS_ROBOTS`.

Bewerk `app.min.js` en `styles.min.css` nooit met de hand — dat zijn buildproducten.

## Menu, gidsenlijst en areamenu zitten in `app.js`

Het navigatiemenu wordt door de build statisch in elke pagina gebakken, uit
`headerHTML()` in `app.js`. Een nieuwe gids toevoegen is daarom **twee** wijzigingen:
de pagina zelf én een regel in de `GUIDES`-array in `app.js` (slug, cat, mins, date,
title, img, excerpt). Hetzelfde geldt voor `AREA_REGIONS` bij een nieuwe areapagina.

Vergeet je `app.js`, dan bouwt de build alle pagina's opnieuw met de oude versie en
verdwijnt het menu-item van de hele site — terwijl de pagina zelf gewoon live staat.
Dit ging op 25-08-2026 mis.

Controle na de build:
`Select-String deploy\index.html -Pattern "<slug>" -SimpleMatch` moet twee treffers
geven (desktopmenu en mobiel menu).

## `const V` in `sw.js`

Het ophogen van `const V` gooit de caches van terugkerende bezoekers weg. Zonder
verhoging zien zij nieuwe pagina's niet, of pas één bezoek later per pagina — de
service worker serveert eerst uit de cache en verst daarna op de achtergrond. Het
symptoom is verraderlijk: nieuwe pagina's kloppen, eerder bezochte pagina's tonen het
oude menu.

Verhoog hem bij elke inhoudelijke wijziging. `STAMP` nooit met de hand aanraken.

Alleen `sw.js` uploaden kan niet: de build zet bij elke run een nieuwe `?v=` in álle
pagina's én in `sw.js`. Na een build gaan dus altijd alle losse bestanden uit de root
van `deploy/` mee. De vijf mediamappen alleen als er afbeeldingen of fonts bij zijn
gekomen.

## Na de upload: Cloudflare leegmaken

Cloudflare cachet HTML, en `mykunda.com/` is daar een andere cachesleutel dan
`mykunda.com/index.html` — de homepage blijft daardoor het langst oud. Na elke upload:
Cloudflare → Caching → Configuration → **Purge Everything**, daarna nakijken in een
privévenster. Zonder purge lijkt een geslaagde upload mislukt.

## Controleren

Na de build, in deze map:

```
$a=(Select-String deploy\sw.js -Pattern "STAMP = '(\d+)'").Matches.Groups[1].Value
$b=(Select-String deploy\index.html -Pattern "app\.min\.js\?v=(\d+)").Matches[0].Groups[1].Value
if($a -eq $b){"stempel OK $a"}else{"WIJKT AF sw=$a index=$b"}
```

En per nieuwe of gewijzigde pagina:
`Select-String deploy\<pagina>.html -Pattern "mk-mark" -SimpleMatch` moet een treffer
geven. Geen treffer = de build heeft die pagina niet gezien, dus staat hij niet in de
root.

De buildoutput moet vier regels tonen zonder `LET OP:`. De tellers (shell / stamped /
mirrored) horen te stijgen met het aantal toegevoegde pagina's — blijven ze gelijk na
het toevoegen van een pagina, dan staat die pagina niet in de root.

Live nakijken in een privévenster: de paginabron moet dezelfde `?v=` hebben als
`mykunda.com/sw.js`, plus een `robots`-meta.

## Sitemap

`sitemap.xml` is een **sitemapindex**, geen platte URL-lijst. Hij bevat één verwijzing,
naar `sitemap-pages.xml` — dat bestand houdt de pagina-URL's (75 per 25-08-2026). Beide
staan in `SITE_ASSETS` in `build.mjs` en moeten daar allebei blijven staan; ontbreekt
`sitemap-pages.xml` in die lijst, dan wijst de index live naar een bestand dat niet
wordt meegeleverd.

**Maak hier geen plat bestand van.** De splitsing is bewust gehandhaafd (besluit
24-08-2026): ze werkt, ze staat live, en ze is de juiste structuur zodra er ooit een
tweede sitemap bij komt, bijvoorbeeld voor advertentiepagina's.

Moet de sitemap ooit tóch samengevoegd worden, dan is de volgorde: eerst het platte
`sitemap.xml` live zetten, pas daarna `sitemap-pages.xml` van de server halen. Andersom
staat de site tijdelijk zonder sitemap.

## Gevolgen voor Claude

- Werk in de root van deze map. Er is geen tweede kopie meer die bijgewerkt moet worden.
- Lever elke wijziging via build en upload. Noem expliciet welke bestanden live moeten.
- Interne documenten (handleidingen, bouwplannen, prompts, e-mailvoorbeelden) horen
  **niet** in `deploy/`.
- Commit na elke afgeronde wijziging, zodat de geschiedenis leesbaar blijft.
- Gebruik `archief/`, `upload-*/` en `MyKunda-oud/` nooit als bron.

## Ontwerpwerk

Visueel werk — nieuwe pagina's, componenten, huisstijl — kan in Claude Design onder
`admin@mykunda.com`. Wat daar ontstaat, komt via deze map de site in, niet andersom.
Deze repo blijft de bron.

## Achtergrond

De volledige export van 25-08-2026 uit het oude account staat in
`..\design-export\MyKunda.com`, inclusief `uploads/` met de originele foto's,
`archief/` en de `upload-*`-mappen. Die zijn hier bewust niet mee gespiegeld.
