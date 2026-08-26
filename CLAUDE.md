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
3. de **losse bestanden uit de root van `deploy/`** via FTP uploaden, met
   overschrijven aan — de mediamappen alleen als daar iets veranderd is, zie
   "Wat er per upload mee moet" hieronder;
4. Cloudflare leegmaken (zie hieronder);
5. `git add -A` en committen, met in het bericht wat er live is gezet.

Stap 2 en 3 kunnen in een keer met **`upload.bat`**: die bouwt, laat zien wat er
zou gaan, vraagt om bevestiging en synchroniseert daarna met WinSCP. Stap 4 en 5
blijven handwerk.

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

Alleen `sw.js` uploaden kan niet: verandert de stempel, dan verandert hij in `sw.js`
én in alle pagina's tegelijk. Die horen dus samen naar de server.

## De versiestempel komt uit de inhoud, niet uit de klok

`STAMP` in `build.mjs` is een sha256 over de inhoud van alles wat met `?v=` wordt
aangeroepen — `app.min.js`, `styles.min.css`, `supabase.js` en de rest van de lijst
`VERSIONED`. Verander je niets aan de bron, dan komt er dezelfde stempel uit, blijven
alle pagina's byte voor byte gelijk en heeft de upload niets te doen.

Tot 26-08-2026 stond hier `String(Date.now())`. Elke bouw kreeg een nieuwe stempel,
dus gingen alle 95 pagina's opnieuw naar de server — ook als je niets had gewijzigd.
Dat kostte niet alleen een minuut per upload. Erger was dat de voorbeeldstap in
`upload.bat` altijd álles opsomde en dus nergens meer voor kón waarschuwen.

Wat dit betekent bij het werken:

| je wijzigt | wat er wordt verstuurd |
|---|---|
| één pagina | dat ene bestand |
| niets | niets |
| `app.js` of `styles.css` | alle pagina's, want hun `?v=` verandert mee |

Die laatste regel is geen tekortkoming maar het doel van een stempel.

**Voeg je een nieuw bestand toe dat met `?v=` wordt aangeroepen, zet het dan in
`VERSIONED`.** Doe je dat niet, dan verandert de stempel niet als dat bestand wijzigt
en houden bezoekers een oude kopie bij nieuwe HTML — de stille fout die bovenin
`build.mjs` beschreven staat. De build waarschuwt er zelf voor met een regel
`LET OP: <naam> wordt met ?v= aangeroepen maar telt niet mee in de stempel`.

`app.min.js`, `styles.min.css` en `sw.js` worden alleen geschreven als hun inhoud
echt anders is. Een `writeFile` met dezelfde inhoud geeft een bestand namelijk toch
een nieuwe wijzigingsdatum, en WinSCP vergelijkt op tijd — dan was het effect van de
hele exercitie weg. Nagemeten op 26-08-2026: twee bouwen achter elkaar zonder
bronwijziging veranderen geen enkel tijdstempel in `deploy/` (288 bestanden).

## Wat er per upload mee moet

`deploy/` is 27,8 MB, maar een gewone upload is 4,7 MB. Het verschil zijn de
mediamappen, en die veranderen bijna nooit.

| wat | omvang | wanneer uploaden |
| --- | --- | --- |
| losse bestanden in de root van `deploy/` (90 HTML + 18 stuks CSS, JS, `.htaccess`, sitemaps) | 108 bestanden, 4,7 MB | **elke keer** |
| `images/` (incl. `images/og/`) | 165 bestanden, 22,4 MB | alleen bij nieuwe of vervangen foto's |
| `vendor/` | 10 bestanden, 0,5 MB | alleen bij een nieuwe Leaflet of andere bibliotheek |
| `logo/` en `fonts/` | 5 bestanden, 0,2 MB | alleen als logo of lettertype verandert |

De root moet élke keer mee omdat de build in iedere pagina en in `sw.js` een verse
`?v=`-stempel zet. Een pagina overslaan geeft een stempel die niet matcht met de
service worker; die pagina's zijn dan dood gewicht in de precache.

**Let op `.htaccess`.** Dat is een verborgen bestand en veel FTP-programma's tonen
het niet standaard. Het draagt de CSP en de cacheregels, dus zonder dat bestand
komen die wijzigingen nooit live. Zet in je FTP-programma "verborgen bestanden
tonen" aan en controleer na een CSP-wijziging of de kop echt veranderd is.

### `upload.bat`: bouwen en uploaden in een keer

`upload.bat` in de root doet stap 2 en 3 van de leverroute achter elkaar: hij
draait `build.mjs`, laat daarna met WinSCP eerst **zien** wat er naar de server
zou gaan, verstuurt, en leegt tot slot de Cloudflare-cache via de API. Vier
stappen, één handeling. Er staat een snelkoppeling **MyKunda uploaden** op het
bureaublad.

Sinds 26-08-2026 loopt hij van begin tot eind door zonder toetsaanslag:

- **Niets gewijzigd, niets gedaan.** Zegt WinSCP in stap 2 "Niets te
  synchroniseren", dan stopt het script daar. Geen upload, en vooral: géén purge.
  Een purge zonder aanleiding maakt de site tijdelijk trager, want Cloudflare moet
  dan alles opnieuw bij de server halen. Wordt die regel niet herkend — een andere
  taalversie van WinSCP — dan gaat het script gewoon door. Dat is de veilige kant
  van die keuze.
- **De bevestiging staat op ja** en gaat na vijf seconden vanzelf door. Die vijf
  seconden zijn er om `n` te kunnen drukken als de lijst je niet bevalt. Kijk
  ernaar: sinds de stempel uit de inhoud komt, staat er alleen nog in wat je
  werkelijk hebt gewijzigd, dus een onverwacht lange lijst betekent iets.
- **Geen Enter aan het eind.** Het venster sluit zichzelf na acht seconden. Bij een
  fout blijft de oude `pause` staan, anders lees je de foutmelding nooit.

De synchronisatie vergelijkt op tijd en grootte en verwijdert niets op de
server. Omdat `build.mjs` de tijdstempels van `images/`, `vendor/`, `logo/` en
`fonts/` met rust laat — nagemeten: die bleven op 17:27 staan terwijl
`index.html` een nieuwe tijd kreeg — ziet WinSCP die 22 MB als ongewijzigd en
blijft er in de praktijk 4,7 MB uit de root over. Je hoeft dus niet meer zelf te
kiezen welke mappen mee moeten; sleep desnoods alles.

Drie dingen bovenin het bestand instellen: `SESSIE` (de naam waaronder de
verbinding in WinSCP is opgeslagen), `EXTERN` (de servermap) en `CF_ZONE` (de
Zone ID bij Cloudflare). Er staat geen wachtwoord in en geen token — die staan
allebei buiten de repo — dus het bestand mag gewoon meegecommit worden.

### De sessie heet `mykunda-sftp`, en waarom niet `mykunda`

Op 26-08-2026 stond de upload stil op `Kan site map of werkruimte niet openen`.
De opgeslagen verbinding zelf mankeerde niets. Het probleem was een **werkruimte**
met de naam `MyKunda`, die er onbedoeld bij was gekomen.

Zo'n werkruimte maakt WinSCP zelf aan: sluit je het venster met een sessie open,
dan vraagt hij of hij de werkruimte moet bewaren, en bij "ja" staat er voortaan
een werkruimte in de aanmeldingslijst — met dezelfde naam als je project. WinSCP
kijkt niet naar hoofdletters, dus `open "mykunda"` kwam daarna uit bij die
werkruimte in plaats van bij de verbinding. En een werkruimte kun je niet openen
als sessie.

Daarom heet de verbinding nu `mykunda-sftp`. Die naam botst niet met iets dat
naar het project vernoemd is. **Hernoem hem niet terug**, en antwoord bij het
afsluiten van WinSCP "nee" op de vraag om de werkruimte te bewaren.

Herkennen kan aan één regel in de uitvoer. Bij een geslaagde run zegt WinSCP eerst:

> Tijdens scripting mag je niet vertrouwen op opgeslagen sites…

Die zin staat er alleen als hij de opgeslagen verbinding heeft gevonden. Ontbreekt
hij, en zoekt WinSCP de sessienaam meteen op als servernaam (`Host "..." bestaat
niet`), dan is de verbinding niet gevonden — dan ligt het aan de naam, niet aan de
servermap of het wachtwoord. Kijken doe je in de Aanmeldingsdialoog van WinSCP:
sessies hebben een beeldscherm-icoontje, werkruimtes en mappen een ander.

### De servermap: níét `/httpdocs`

De SFTP-login komt uit op `/var/www/vhosts/gamgrowth.com/`, want mykunda.com
draait als tweede domein binnen die vhost. De map `httpdocs` daar is de webroot
van **gamgrowth.com**; MyKunda staat in de map `mykunda.com` ernaast. Uploaden
naar `/httpdocs` zet dus de ene site over de andere heen.

Verbindingsgegevens: `ftp.mykunda.com` (45.82.188.213 — de server zelf; het
kale `mykunda.com` wijst naar Cloudflare en heeft geen SFTP), poort 22, SFTP,
systeemgebruiker `ycjoswsp` uit Plesk.

`upload.bat` controleert dit ook zelf: vóór het synchroniseren doet hij een
`stat` op `index.html` in de opgegeven map. Staat die er niet, dan is het de
verkeerde map en stopt hij voordat er iets verstuurd is.

**Verbind de eerste keer met de hand in WinSCP.** Niet alleen voor het
wachtwoord: bij een eerste SFTP-verbinding vraagt WinSCP of je de vingerafdruk
van de server vertrouwt, en het script draait met `option batch abort` — dat
beantwoordt zo'n vraag automatisch met nee en stopt. Eén keer met de hand
verbinden en opslaan is genoeg.

`upload.bat` staat niet in `SITE_ASSETS` en is geen `.html`, dus de build laat
hem links liggen en hij komt nooit op de server. Gecontroleerd.

## Na de upload: Cloudflare leegmaken

Cloudflare cachet HTML, en `mykunda.com/` is daar een andere cachesleutel dan
`mykunda.com/index.html` — de homepage blijft daardoor het langst oud. Zonder purge
lijkt een geslaagde upload mislukt.

Sinds 26-08-2026 doet `upload.bat` dit zelf, als stap 4/4, via de Cloudflare-API.
Handmatig kan nog steeds: Cloudflare → Caching → Configuration → **Purge Everything**.
Daarna nakijken in een privévenster.

### Het token voor stap 4

De Zone ID (`9bcef0f88fccc1407adafd421a4ec299`) staat gewoon bovenin `upload.bat` —
dat is een identificatie, geen geheim. Het **token** staat er bewust niet, en ook
nergens anders in de repo, maar in je gebruikersmap:

```
%USERPROFILE%\.mykunda-cloudflare.cmd
```

Eén regel, aanhalingstekens erbij:

```
set "CF_TOKEN=hier-jouw-token"
```

Aanmaken op **dash.cloudflare.com → Manage account → Account API tokens →
Create Token**. Het dashboard is in 2026 herbouwd; "Custom token" heet daar nu
**Start from scratch — Build a custom permission policy**. Dan:

1. **Token name**: iets herkenbaars, bijvoorbeeld `mykunda-purge`.
2. In het beleidsvak staat een keuzelijst op **Entire Account**. Zet die op
   **Specified Domains** en kies `mykunda.com`. Dit moet als eerste — Cache
   Purge is een domeinrecht, dus zolang de scope op Entire Account staat is het
   níét te vinden en lijkt het alsof het recht niet bestaat.
3. Zoek op `purge`. Onder **Cache & Performance → Cache** ("Grants access to
   purge cache") vink je **Purge** aan. Verder niets.
4. **Token expiration** op **No expiration**, anders stopt de purge-stap er op
   een dag mee zonder dat je weet waarom.

Meer rechten heeft het niet nodig, en meer geven maakt de schade groter als het
bestand ooit uitlekt. Cloudflare toont het token één keer — daarna niet meer.

Ontbreekt het bestand of is het token verlopen, dan gaat er niets stuk: het script
meldt dat de cache níét is geleegd en verwijst je naar het dashboard. Een mislukte
purge breekt de upload dus nooit af, want die is op dat moment al klaar.

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

## Edge functions

De actuele bron van alle 21 edge functions staat in
`supabase/functions/<naam>/index.ts`, opgehaald met de Supabase CLI en
bijgehouden in git. De CLI staat in `C:\Users\User\bin\supabase.exe` (niet op
PATH, roep hem met het volledige pad aan).

Ophalen en uitrollen:

```
C:\Users\User\bin\supabase.exe functions download <naam> --project-ref jejaerpqltqryqzjvbjp
C:\Users\User\bin\supabase.exe functions deploy   <naam> --project-ref jejaerpqltqryqzjvbjp --no-verify-jwt
```

**`--no-verify-jwt` is niet optioneel.** Twintig van de eenentwintig functies
draaien met `verify_jwt: false` en controleren het token zélf in de code. Rol je
er één uit zonder die vlag, dan zet de CLI `verify_jwt` op true en wijst de
gateway de OPTIONS-preflight van de browser af. Het gevolg is een CORS-fout in
de checkout, zonder duidelijke melding — de betaalflow breekt dan stil.

De enige uitzondering is `swift-responder`: die hoort juist wél op
`verify_jwt: true` en moet dus **zonder** die vlag worden uitgerold.

De bankgegevens voor bankoverschrijvingen staan hardgecodeerd in **twee**
functies: `create-payment` (naar het scherm van de klant) en
`send-payment-instructions` (de mail met het rekeningnummer). Wijzigt de
rekening, pas ze op beide plekken aan, plus de provider-waarde die bij een
bankoverschrijving in `payments` wordt weggeschreven.

De map `edge-functions/` is een verouderde momentopname; zie de LEESMIJ daar.

## Kaarten en MapTiler

Sinds 25 augustus 2026 draait het MapTiler-account op **Flex**. Alles wat met
kaarten te maken heeft staat sindsdien op één plek: het blok `MapTiler` bovenin
`app.js`, met `window.MK_MAP` als enige bron van sleutel, stijlen en zoomgrenzen.

**Zet nooit een tegel-URL of een stijlnaam in een pagina.** Gebruik:

| functie | waarvoor |
| --- | --- |
| `mkMap(el, opts)` | een kaart met de instellingen die overal gelijk horen te zijn |
| `mkTileLayer('satellite'\|'streets')` | één laag, met de juiste tegelgrootte, zoomgrenzen en attributie |
| `mkBaseToggle(map)` | de satelliet/kaart-knop, plus beide lagen |
| `mkScale(map)` | schaalbalk, metrisch |
| `mkAreaMap(id, center, zoom)` | de kleine kaart van de wijkpagina's — alle 41 roepen alleen dit aan |
| `mkStaticMapUrl(bbox, w, h, opts)` | één kaartafbeelding, bijvoorbeeld de perceelfoto |
| `mkGeocode` / `mkReverseGeocode` / `mkGeoSuggest` | zoeken op plaats en adres, vastgezet op Gambia |

Een pagina die zelf `L.map(...)` of `L.tileLayer(mapTilerUrl(...))` aanroept,
loopt uit de pas zodra hier iets verandert. Dat is precies wat er tot 25-08-2026
gebeurde: vijf verschillende zoomgrenzen, drie losse terugvalimplementaties en
attributie zonder de verplichte links.

### Wat Flex verandert

- **@2x kost hetzelfde als 1x.** MapTiler rekent per tegel af, niet per pixel.
  Daarom halen we scherpe tegels op waar het scherm ze ook echt kan tonen — zie
  de drempels hieronder. Uitzondering: databesparing aan of een 2G-verbinding.
- **De v4-generatie stijlen.** `hybrid-v4` en `streets-v4`. De oude v2-stijlen
  blijven werken maar krijgen geen ontwerpupdates meer.
- **Het MapTiler-logo hoeft niet meer op de kaart.** De tekstattributie met
  links naar MapTiler én OpenStreetMap blijft wél verplicht, op élke kaart —
  ook op de perceelfoto. Die zit in `MK_ATTR` en in de Static Maps-URL.
- **Static Maps** werkt alleen op een betaald plan. Dat is wat de perceelfoto in
  de verkoopflow nu gebruikt.

### Wanneer @2x, en wanneer niet

@2x kost bij MapTiler geen extra verbruik maar wel twee tot vier keer zoveel
bytes, en die rekening is het hoogst waar de winst het laagst is. Gemeten boven
Kololi, satelliet in WebP, per tegel:

| URL-zoom | 1x | @2x |
| --- | --- | --- |
| 12 | 43 kB | 172 kB |
| 13 | 96 kB | 362 kB |
| 15 | 90 kB | 296 kB |
| 17 | 37 kB | 80 kB |
| 19 | 19 kB | 44 kB |

Drie drempels regelen dat, alle drie in `MK_MAP`:

- `hidpiMinDpr: 1.5` — onder deze schermdichtheid heeft @2x geen zin. Windows op
  125% geeft DPR 1,25: een tegel van 1024 px wordt dan teruggeschaald naar 640,
  dus je betaalt drie tot vier keer zoveel bytes voor een fractie van het
  verschil. Telefoons zitten op 2 of 3 en krijgen hem wel.
- `hidpiFromZoom: 14` — onder Leaflet-zoom 14 kijk je naar kustlijnen en
  plaatsvormen, niet naar daken. Daar is de tegel juist het zwaarst.
- `mkHidpi: false` als laagoptie — voor kleine kaartvakken. De wijkpagina's
  gebruiken dit: een vak van ruim 300 px heeft de extra pixels niet nodig, en
  over eenenveertig pagina's is dat de grootste post.

Gemeten winst: `mkTileLayer` maakt twee URL-sjablonen en kiest per tegel via een
eigen `getTileUrl`. Let op bij wijzigingen aan de terugval: die verwijdert die
overschrijving weer, anders zou Leaflet voor Esri en OpenStreetMap nog steeds de
MapTiler-URL bouwen.

Wat @2x wél doet, gemeten met een laplaciaanmaat op dezelfde uitsnede: op
zoom 15 zit er 2,6 keer zoveel detail in dan in een opgerekte 1x-tegel; op
zoom 17 nog maar 1,95 keer, want daar loopt het bronbeeld tegen zijn grens aan.
Wie helemaal inzoomt en dan oordeelt, ziet het verschil dus het minst.

### Zoomgrenzen: gemeten, niet gegokt

Boven Kololi is het satellietbeeld scherp tot en met Leaflet-zoom 19; daarboven
rekt MapTiler zelf op en wordt het zichtbaar zachter. Vandaar `satNativeMax: 19`.
Boven die grens schaalt Leaflet client-side verder: even scherp als wat MapTiler
zou terugsturen, maar het kost geen enkele tegel.

Meet het opnieuw voordat je die waarde verandert. Eén tegel ophalen met
`Referer: https://mykunda.com/` en ernaar kijken is genoeg — een opgerekte tegel
is meteen te zien, en het bestandsformaat zakt hard in.

### Wat het kost

De site gebruikt Leaflet, en dat betekent dat MapTiler **per verzoek** afrekent,
niet per sessie. Het Flex-abonnement bevat 500.000 verzoeken per maand.

| wat | telt als |
| --- | --- |
| rastertegel van 512 px (ook @2x) | 4 verzoeken |
| rastertegel van 256 px (ook @2x) | 1 verzoek |
| Static Maps-afbeelding | 15 verzoeken |
| zoekopdracht (ook omgekeerd) | 1 verzoek |
| `tiles.json`, `style.json`, fonts | gratis |

Twee dingen volgen daaruit en staan zo in de code:

1. **`tileSize: 512` hoort altijd samen met `zoomOffset: -1`.** Zonder die
   tweede haalt Leaflet vier keer zoveel tegels op voor hetzelfde beeld — en
   elke tegel telt voor vier. Dat is de duurste typefout die je hier kunt maken.
2. **De sleuteltoets loopt over `tiles.json`, niet over een tegel.** Die toets
   is gratis en geeft 403 zodra de sleutel op dit domein niet geldig is. De oude
   toets haalde een echte tegel op: vier verzoeken per paginabezoek, voor niets.

Zet in het MapTiler-dashboard een **uitgavenlimiet**; boven de inbegrepen
hoeveelheid wordt automatisch bijgeschreven ($0,15 per 1.000 verzoeken).

Groeit het verkeer, dan kantelt het naar sessie-facturering: met de MapTiler SDK
telt één paginabezoek als één sessie (25.000 inbegrepen, tot 10.000 verzoeken per
sessie), ongeveer zes keer goedkoper per kaartweergave. Dat vraagt wel MapLibre
in plaats van Leaflet — zo'n 230 KB extra per kaartpagina, WebGL vereist, en de
teken-tool en prijsmarkers moeten mee. Afwegen zodra het verbruik richting de
500.000 loopt, niet eerder.

### Een eigen MyKunda-kaartstijl

Flex geeft er twintig, en er is **geen API om er een aan te maken** — uploaden
door de webinterface is de enige weg.

De twee stijlen staan kant-en-klaar in `maptiler/`, samen met de generator die
ze uit de officiële v4-stijlen opbouwt en een leesmij met het uploadformulier
veld voor veld. Korte versie:

1. cloud.maptiler.com/maps → blauwe pijlknop → **Upload map**, het JSON-bestand
   erbij. Label `production` (alleen een etiket); **Rendering format WebP**,
   voor beide stijlen.
2. **Save & Publish**. De stijl krijgt een eigen ID (een UUID).
3. Dat ID in `app.js` bij `MK_MAP.satellite` of `MK_MAP.streets` zetten. Verder
   niets: alle kaarten, de perceelfoto en de Static Maps volgen vanzelf.
4. `node build.mjs`, uploaden, Cloudflare leegmaken.

**Stijl-ID en tegelformaat staan los van elkaar in `MK_MAP`**, en dat is
opzettelijk. Een eigen stijl heet `01a03b…`; aan die naam valt niet meer af te
lezen of het om luchtfoto's gaat, dus vergelijkt `mapTilerUrl` met wat er in
`MK_MAP` staat in plaats van met een woord in het ID.

**Ook de luchtfoto gaat als WebP over de lijn**, tegen de intuïtie in — het
bronbeeld is JPEG, dus dit is een hercompressie. Gemeten boven Kololi op
25-08-2026, zoom 17 op @2x: 83 kB tegen 135 kB, PSNR 39 dB, naast elkaar gelegd
geen zichtbaar verschil. Op 4G in Gambia weegt eenderde minder bytes zwaarder
dan de theorie. Browsers zonder WebP-ondersteuning worden herkend met een
canvas-toets en krijgen JPEG voor de luchtfoto en PNG voor de kaartlaag.

Het Rendering format in het dashboard is een **standaard, geen slot**: alle drie
de formaten blijven opvraagbaar, ongeacht wat je daar koos. Houd ze toch gelijk,
anders lees je later een verschil dat er niet is.

De perceelfoto haalt bewust wél JPEG op (`format:'jpg'` in `list.html`). Die
afbeelding wordt op canvas hertekend en als JPEG opgeslagen bij de advertentie;
via WebP zou er een generatie hercompressie bij komen die je niet terugkrijgt.

**Buildings is geen stijl maar een tileset**: gebouwvlakken met gevelkleur,
hoogte, ingangen en pandnamen, zoom 12–15 met overzoom. Hij zit als extra bron
in beide MyKunda-stijlen. Op de kaartlaag als vlak met rand, op de
satellietlaag alleen als omtrek en pas vanaf zoom 18 — daaronder wordt het een
wit hekwerk over de luchtfoto.

### Kaarten en stapelvolgorde

Leaflet gebruikt intern z-index 400 tot 1000 voor zijn panes, knoppen en popups,
en de site zet daar eigen knoppen bovenop: `.map-controls`, `.layer-toggle`,
`.map-banner` op 1000 en `.map-touch-guard` op 1100. De koptekst staat op 60.
Zonder eigen stapelcontext concurreren die nummers rechtstreeks met elkaar — en
dan wint de kaart, waardoor hij over een geopend menu heen blijft liggen.

Twee regels vangen dat af, en beide gebruiken `isolation:isolate` omdat dat een
stapelcontext maakt **zonder aan `position` te komen** (sticky en fixed blijven
dus werken):

- `body .leaflet-container` in `styles.css` — dekt alles binnen het kaartvak.
  Het gewicht van `body` ervoor is nodig omdat `leaflet.css` op de wijkpagina's
  ná `styles.css` wordt ingeladen en `search.html` zelf ook een
  `.leaflet-container`-regel heeft.
- `.map-col` in `search.html` — daar staan de knoppen náást het kaartvak, niet
  erin, dus die vallen buiten de eerste regel.

Zet je ergens een nieuwe knop op een kaart: als hij buiten `.leaflet-container`
valt, hoort zijn omhulsel ook `isolation:isolate` te krijgen. Test het door de
kaart net onder de koptekst te scrollen en het Areas-menu te openen.

### Terugval als MapTiler niets levert

Een afgewezen sleutel faalt niet als een kapotte afbeelding: de API stuurt een
prima te tekenen PNG met een grijs "Invalid key"-watermerk terug. Leaflet ziet
een geladen tegel en meldt niets. Daarom toetst `app.js` bij het eerste gebruik
op `tiles.json`; komt daar geen 200 uit, dan stappen álle MapTiler-lagen op de
pagina over op sleutelloze bronnen — Esri-luchtfoto plus een namenlaag voor
satelliet, OpenStreetMap voor de kaartlaag. Een netwerkfout telt níét als een
afgewezen sleutel; daarvoor blijft `tileerror` het vangnet.

Die drie hosts staan daarom in `img-src` van de CSP. **`.htaccess`, `_headers` en
`vercel.json` moeten dezelfde CSP bevatten** — ze liepen uiteen tot 25-08-2026,
waardoor de OpenStreetMap-terugval op de live site geblokkeerd zou zijn geweest.

De perceelfoto in de verkoopflow heeft géén terugval: levert MapTiler niets, dan
komt er geen foto. Een wazige of lege kaart als hoofdfoto van een advertentie is
erger dan geen kaart, en de omtrek staat toch al als data bij de advertentie.

## Pushen na elke sessie

Deze repo heeft een remote: `github.com/scheperman/mykunda-com`, privé.
Dat is de enige kopie buiten deze pc.

**Sluit elke werksessie af met `git push`.** Niet omdat het netjes staat, maar
omdat een remote die maanden achterloopt je precies zoveel maanden minder
beschermt dan je denkt. Committen zonder pushen voelt als opslaan en is het
niet.

Commits dragen `17229960+scheperman@users.noreply.github.com`. Dat is bewust:
GitHub weigert een push die een privé-e-mailadres zou publiceren, en het
persoonlijke gmail-adres hoort niet in de geschiedenis van een bedrijfsrepo.
Verander `user.email` in deze repo dus niet terug.
