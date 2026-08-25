# Werkafspraken MyKunda

## Eén bron van waarheid
Dit project is de enige plek waar bestanden van mykunda.com worden gewijzigd.
Op de live server wordt **nooit** rechtstreeks een bestand aangepast — niet met de
bestandsbeheerder van de host, niet in een online editor, niet handmatig via FTP.

Elke wijziging loopt via deze route:

1. de aanpassing wordt hier in het project gemaakt (root = de actuele versie);
2. het bestand wordt gespiegeld naar `deploy/`, zodat het project intern klopt;
3. Edwin zet de gewijzigde bestanden in zijn **lokale root** `C:\Users\User\MyKunda\project`;
4. hij draait daar `node build.mjs`;
5. hij uploadt de hele inhoud van de **lokale** `deploy/` via FTP, met overschrijven aan.

Stap 3 en 4 zijn niet optioneel. Zie "De vaste leverroute" hieronder.

## Waarom
Uploaden is eenrichtingsverkeer: een upload overschrijft het serverbestand ongeacht
de datum, en er komt nooit iets terug naar het project. Een correctie die alleen op
de server staat, gaat bij de eerstvolgende upload stil verloren.

## Werkt er een Claude in een lokale kopie van deze map?
Dan geldt de regel hierboven onverkort: **het Claude Design-project blijft de bron.**
Een lokale kopie mag alleen gebruikt worden voor werk dat hier niet kan.

**Lokaal wél:** alles lezen · `node build.mjs` draaien · `build.mjs`, `app.js` en `sw.js`
aanpassen wanneer Node of Supabase nodig is (statische objectpagina's, de prijsindex uit
de databron, `const V` ophogen).

**Lokaal niet:** tekst, meta-tags, schema, styling of losse pagina's in `.html`,
`styles.css`, `robots.txt`, `sitemap.xml`, `.htaccess`. Die horen in het project — een
lokale correctie komt nooit terug en wordt bij de volgende levering overschreven.
Ook niet: `app.min.js` of `styles.min.css` met de hand bewerken; dat zijn buildproducten.

**Na lokaal werk:** meld precies welke bestanden gewijzigd zijn, zodat ze in het project
worden verwerkt. Vanaf dat moment is de projectversie weer de waarheid.

**Twee dingen zijn eigendom van `build.mjs` — niet in de HTML repareren:**
1. header en footer komen uit `headerHTML()` / `footerHTML()` in `app.js`;
2. de robots-metatag wordt herschreven door `markPage()`, op basis van `NOINDEX_PAGES`
   en `JS_ROBOTS`.

De mappen `archief/` en `upload-*/` zijn oude momentopnamen. Nooit als bron gebruiken.
De volledige opdracht staat in `Instructie-Claude-SEO-vervolg.md`.

## De vaste leverroute — nooit overslaan

De `deploy/` **in dit project** is niet uploadklaar en is dat ook nooit. Alleen de
`deploy/` die `node build.mjs` op Edwins pc schrijft, is uploadklaar. De build doet drie
dingen die hier niet kunnen: `app.min.js` en `styles.min.css` opnieuw minificeren, één
verse `?v=`-stempel in elke pagina én in `sw.js` zetten, en het `<!--mk-mark-->`-blok met
de robots-metatag injecteren.

Een bestand dat rechtstreeks uit dit project naar de server gaat, mist die drie dingen.
Dat is stil kapot: de pagina werkt, maar heeft geen robots-tag en een stempel die niet
matcht met de service worker, waardoor de precache voor die pagina dood gewicht is.
Dit is precies wat er op 25-08-2026 gebeurde met de gids over agentregulering.

**`build.mjs` leest alleen de root van de lokale map** (`readdir('.')`, geen recursie) en
ruimt daarna alles in `deploy/` op wat niet in de bouwlijst staat. Een bestand dat niet in
Edwins lokale root staat, bestaat voor de build niet en komt dus nooit live.

### Het echte gevaar: de lokale kopie loopt achter
De lokale kopie kan versies bevatten van vóór een wijziging hier. Wordt daar gebouwd en
geüpload, dan overschrijft dat live de nieuwe versies met oudere — links, sitemapregels en
teksten verdwijnen zonder foutmelding. Uploaden is eenrichtingsverkeer; niemand ziet het.

### Wat Claude daarom bij ELKE wijziging aan een sitebestand doet
1. de wijziging in de projectroot maken en naar `deploy/` spiegelen;
2. **alle** bestanden die deze wijziging raakt in een map `sync-naar-lokaal/` zetten —
   inclusief bestanden die eerder al gewijzigd zijn maar mogelijk nog niet lokaal staan
   (denk aan `sitemap-pages.xml`, `guides.html` en andere pagina's met interne links);
3. die map met `present_fs_item_for_download` aanbieden;
4. de instructie letterlijk meegeven: uitpakken in `C:\Users\User\MyKunda\project`
   (de root, niet in `deploy/`), overschrijven aan → `node build.mjs` → hele lokale
   `deploy/` uploaden met overschrijven aan;
5. de controlecommando's meegeven uit "Controleren" hieronder;
6. `sync-naar-lokaal/` opruimen zodra de upload bevestigd is — een oude sync-map die later
   wordt uitgepakt, zet verouderde bestanden terug.

Nooit zeggen "upload `deploy/`" zonder stap 2 tot 4. Nooit een los bestand uit dit project
aanbieden om naar de server te zetten.

### Menu, gidsenlijst en areamenu zitten in `app.js`
Het navigatiemenu wordt door de build statisch in elke pagina gebakken, uit `headerHTML()`
in `app.js`. Een nieuwe gids toevoegen is daarom **twee** wijzigingen: de pagina zelf én
een regel in de `GUIDES`-array in `app.js` (slug, cat, mins, date, title, img, excerpt).
Hetzelfde geldt voor `AREA_REGIONS` bij een nieuwe areapagina.

`app.js` moet dan mee in `sync-naar-lokaal/`. Gebeurt dat niet, dan bouwt de build alle
pagina's opnieuw met de oude `app.js` en verdwijnt het menu-item van de hele site — terwijl
de pagina zelf gewoon live staat. Dit ging op 25-08-2026 mis.

Controle na de build: `Select-String deploy\index.html -Pattern "<slug>" -SimpleMatch` moet
twee treffers geven (desktopmenu en mobiel menu).

### Na de upload: Cloudflare leegmaken
Cloudflare cachet HTML, en `mykunda.com/` is daar een andere cachesleutel dan
`mykunda.com/index.html` — de homepage blijft daardoor het langst oud. Na elke upload:
Cloudflare → Caching → Configuration → **Purge Everything**, daarna nakijken in een
privévenster. Zonder purge lijkt een geslaagde upload mislukt.

### Controleren
Na de build, in `C:\Users\User\MyKunda\project`:

```
$a=(Select-String deploy\sw.js -Pattern "STAMP = '(\d+)'").Matches.Groups[1].Value
$b=(Select-String deploy\index.html -Pattern "app\.min\.js\?v=(\d+)").Matches[0].Groups[1].Value
if($a -eq $b){"stempel OK $a"}else{"WIJKT AF sw=$a index=$b"}
```

En per nieuwe of gewijzigde pagina: `Select-String deploy\<pagina>.html -Pattern "mk-mark"
-SimpleMatch` moet een treffer geven. Geen treffer = de build heeft die pagina niet gezien,
dus staat hij niet in de lokale root.

De buildoutput moet vier regels tonen zonder `LET OP:`. De tellers (shell / stamped /
mirrored) horen te stijgen met het aantal toegevoegde pagina's — blijven ze gelijk na het
toevoegen van een pagina, dan is de sync niet aangekomen.

Live nakijken in een privévenster: de paginabron moet dezelfde `?v=` hebben als
`mykunda.com/sw.js`, plus een `robots`-meta.

### `const V` in `sw.js`
Het ophogen van `const V` gooit de caches van terugkerende bezoekers weg. Zonder verhoging
zien zij nieuwe pagina's niet, of pas één bezoek later per pagina — de service worker
serveert eerst uit de cache en verst daarna op de achtergrond. Het symptoom is verraderlijk:
nieuwe pagina's kloppen, eerder bezochte pagina's tonen het oude menu.

Verhoog hem bij elke inhoudelijke wijziging, en altijd hoger dan alles wat ooit live stond —
de lokale kopie kan lager staan dan het project (op 25-08-2026 lokaal v51 tegen v58 hier).
`STAMP` nooit met de hand aanraken.

Alleen `sw.js` uploaden kan niet: de build zet bij elke run een nieuwe `?v=` in álle
pagina's én in `sw.js`. Na een build gaan dus altijd alle losse bestanden uit de root van
`deploy/` mee. De vijf mediamappen alleen als er afbeeldingen of fonts bij zijn gekomen.

## Gevolgen voor Claude
- Houd `deploy/` gelijk aan de root-bestanden na elke wijziging aan een sitebestand.
- Lever elke wijziging via `sync-naar-lokaal/` + build + upload. Geen uitzonderingen.
- Interne documenten (handleidingen, bouwplannen, prompts, e-mailvoorbeelden) horen
  **niet** in `deploy/`.
- Noem bij elke levering expliciet welke bestanden geüpload moeten worden.
- Is er tóch iets rechtstreeks op de server gewijzigd: eerst dat bestand in het
  project verwerken, pas daarna opnieuw uploaden.

## Sitemap

`sitemap.xml` is een **sitemapindex**, geen platte URL-lijst. Hij bevat één verwijzing,
naar `sitemap-pages.xml` — dat bestand houdt de pagina-URL's (75 per 25-08-2026). Beide bestanden staan
in `SITE_ASSETS` in `build.mjs` en moeten daar allebei blijven staan; ontbreekt
`sitemap-pages.xml` in die lijst, dan wijst de index live naar een bestand dat niet
wordt meegeleverd.

**Maak hier geen plat bestand van.** De splitsing is bewust gehandhaafd (besluit
24-08-2026): ze werkt, ze staat live, en ze is de juiste structuur zodra er ooit een
tweede sitemap bij komt, bijvoorbeeld voor advertentiepagina's. Terugbouwen naar één
bestand levert niets op en kost een productiewijziging.

Moet de sitemap ooit tóch samengevoegd worden, dan is de volgorde: eerst het platte
`sitemap.xml` live zetten, pas daarna `sitemap-pages.xml` van de server halen. Andersom
staat de site tijdelijk zonder sitemap.
