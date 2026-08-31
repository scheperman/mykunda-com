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
5. `git add -A`, committen met in het bericht wat er live is gezet, en pushen.

**Stap 2 tot en met 5 doet `upload.bat` in één handeling**: bouwen, tonen wat er
zou gaan, synchroniseren met WinSCP, de Cloudflare-cache legen via de API, en tot
slot `git add -A` + commit + push. Stap 1 — de wijziging zelf — blijft mensenwerk,
en het commitbericht ook: dat mag als argument mee (`upload.bat "wat er live
gaat"`) en wordt anders gevraagd.

Tot 26-08-2026 stonden stap 4 en 5 hier als handwerk. Dat klopt niet meer.

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

## De inhoudszoek: `search-content.json` (31-08-2026)

Tot 31 augustus 2026 doorzocht **geen enkele zoekbalk op de site de inhoud**. Het was
er twee keer bijna, en allebei net niet:

* het vergrootglas in de header stuurt door naar `search.html?q=`, en dáár wordt
  alleen op `area + street + title` van **advertenties** gefilterd;
* het zoekveld in het Guides-menu vergeleek uitsluitend de **gidstitel** (`hits()`
  kijkt naar `a[0]`).

Gemeten op de gebouwde pagina: `stamp duty`, `consent`, `erosion` en `faq` gaven alle
vier "No match", terwijl dat precies de onderwerpen zijn waar de gidsen sinds de
feitencontrole over gaan. Alleen woorden die toevallig in een titel staan — `mortgage`,
`tax`, `land` — gaven een treffer.

`build-search-index.mjs` leest nu de bronpagina's en schrijft `search-content.json`:
per gids elke `<h2 id>` en elke Q&A-vraag, plus alle vragen uit `faq.html` met hun
eigen anker, plus een handvol losse pagina's op titel. Nu 531 regels over 22 pagina's,
38 kB.

Drie dingen die je niet moet omdraaien:

1. **Het script draait vanuit `build.mjs`, vóór de stempelberekening.** Het staat in
   `VERSIONED`, dus een nieuwe index hoort een nieuwe stempel te geven. Genereer je
   hem ná de digest, dan verschuift de inhoud wel en de stempel niet, en houden
   terugkerende bezoekers de oude index — precies de stille fout waar bovenin
   `build.mjs` voor gewaarschuwd wordt.
2. **Het staat ook in `SITE_ASSETS`**, anders komt het bestand nooit op de server.
   Zelfde patroon als `gambia-osm.json`: geen `<script>`, `app.js` haalt het pas op
   zodra iemand een toets indrukt in een zoekveld, en hangt er zelf de stempel aan.
3. **Het anker van de Q&A-vragen wordt structureel bepaald** — de laatste `<h2 id>`
   vóór het eerste `.qa`-blok — niet op de tekst van de kop. Alle dertien gidsen komen
   nu op `#qa` uit, maar een gids die die kop anders noemt blijft zo gewoon werken.

In `app.js` hangen er drie dingen aan: `mkContentIndex()` (laden), `mkContentSearch()`
(alle woorden moeten voorkomen, treffers in de kop of de vraag boven treffers in de
paginatitel) en de weergave in de headerzoek, het Guides-menu en het mobiele menu.

**De knop van het vergrootglas blijft de objectzoek.** Hij staat naast "Add your
property" op een woningportaal; wie hem gebruikt wil meestal advertenties. De
inhoudstreffers staan eronder als suggestie. Draai dat niet om zonder er goed over na
te denken — het is de hoofdtrechter van de site.

Let op bij het aanpassen van de meldingen: het Guides-menu toont eerst de titeltreffers
en pas daarna, als de index binnen is, de inhoudstreffers. Staat er "No match" van de
titelronde, dan moet die melding weg zodra er wél inhoudstreffers zijn — dat doet
`.mkam-nores` / `.md-sub-nores`. Zonder dat sprak het paneel zichzelf tegen.

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

### `upload.bat`: bouwen, uploaden en vastleggen in een keer

`upload.bat` in de root doet stap 2 tot en met 5 van de leverroute achter elkaar:
hij draait `build.mjs`, laat daarna met WinSCP eerst **zien** wat er naar de
server zou gaan, verstuurt, leegt de Cloudflare-cache via de API, en legt tot
slot de bron vast in git — `add -A`, commit, push. Vijf stappen, één handeling.
Er staat een snelkoppeling **MyKunda uploaden** op het bureaublad.

Sinds 26-08-2026 loopt hij van begin tot eind door zonder toetsaanslag:

- **Niets gewijzigd, niets geüpload.** Zegt WinSCP in stap 2 "Niets te
  synchroniseren", dan slaat het script stap 3 en 4 over. Geen upload, en vooral:
  géén purge. Een purge zonder aanleiding maakt de site tijdelijk trager, want
  Cloudflare moet dan alles opnieuw bij de server halen. Wordt die regel niet
  herkend — een andere taalversie van WinSCP — dan gaat het script gewoon door.
  Dat is de veilige kant van die keuze. Stap 5 draait wél door: een wijziging in
  `CLAUDE.md` of in een script komt niet in `deploy/` terecht en hoort tóch
  vastgelegd te worden.
- **Er wordt niets gevraagd over de upload.** Is er iets te synchroniseren, dan
  gaat het weg. De lijst uit stap 2 is je controle achteraf: sinds de stempel uit
  de inhoud komt staat daar alleen nog in wat je zelf hebt gewijzigd, dus een
  onverwacht lange lijst betekent iets. Wil je toch een moment om af te breken,
  dan staan de twee regels ervoor als commentaar in `upload.bat` klaar.
- **Alleen het commitbericht wordt gevraagd** — het enige in deze route dat een
  machine niet kan verzinnen. Geef je het als argument mee, dan draait ook dat
  vanzelf: `upload.bat "Areapagina's: kaartcoördinaten gecorrigeerd"`. Enter
  zonder tekst geeft een feitelijke standaardregel (datum plus het aantal
  gewijzigde bestanden), zodat een onbeheerde run nooit blijft hangen.
- **Git wordt nooit geforceerd.** Vóór de commit toont het script
  `git diff --cached --name-status`, zodat je ziet wat er vastgelegd wordt.
  Weigert de push — meestal omdat er op GitHub iets nieuwers staat — dan stopt hij
  met de aanwijzing `git pull --rebase` en dan `git push`. De commit staat op dat
  moment gewoon lokaal klaar; er gaat niets verloren.
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

### `.bat`-bestanden moeten CRLF houden

De hele repo staat op LF-regeleinden en dat is prima — behalve voor `upload.bat`.
`cmd.exe` voert een `.bat` met alleen LF nog wel regel voor regel uit, maar gaat
onderuit zodra er `call :label`, `set /p` of meerregelige `if (...)`-blokken in
staan. Het breekt niet met een foutmelding: hij slaat stukken over, geeft
nauwelijks uitvoer en sluit.

Dat gebeurde op 26-08-2026. De oude `upload.bat` overleefde LF omdat er alleen
losse regels en simpele labels in stonden; zodra stap 5 er met een subroutine en
een `set /p` bij kwam, deed hij niets meer. Omzetten naar CRLF loste het op,
zonder één inhoudelijke wijziging.

Let op bij het bewerken: veel editors en tools — waaronder de bestandstools van
Claude — schrijven standaard LF. Controleer het na elke bewerking van een `.bat`:

```powershell
$t=[IO.File]::ReadAllText('upload.bat')
'crlf=' + ([regex]::Matches($t,"`r`n")).Count + ' lf=' + ([regex]::Matches($t,"`n")).Count
```

Zijn die twee getallen gelijk, dan is het goed. Staat `crlf` op 0, dan zetten:

```powershell
$t=[IO.File]::ReadAllText('upload.bat') -replace "`r`n","`n" -replace "`n","`r`n"
[IO.File]::WriteAllText('upload.bat',$t,(New-Object Text.UTF8Encoding $false))
```

Die `UTF8Encoding $false` is er om een BOM te voorkomen: drie bytes vóór
`@echo off` en cmd struikelt al over de eerste regel.

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

## Kaarten: sinds 29-08-2026 levert Mapbox, met MapTiler als schakelstand

Edwin besloot op 29-08-2026 over te stappen van MapTiler op Mapbox. De site
bleef op Leaflet: de tegels komen nu van Mapbox' **Static Tiles API** (die
Leaflet in Mapbox' eigen documentatie als afnemer noemt), niet van Mapbox GL JS
— dat zou ruim 1 MB extra JavaScript en een herbouw van elke kaartpagina zijn
geweest voor hetzelfde beeld.

Hoe het geschakeld is, allemaal bovenin `app.js`:

- `MK_MAP.provider` — `'mapbox'` of `'maptiler'`, één regel voor de hele site.
  `mkProvider()` valt terug op MapTiler zolang `MK_MAPBOX.token` leeg is.
- `MK_MAPBOX` — token, stijlen (`mapbox/satellite-streets-v12`,
  `mapbox/streets-v12`), tegelformaat en zoomgrenzen. Het token is in het
  Mapbox-dashboard vastgezet op mykunda.com en *.mykunda.com; zonder die
  Referer geeft de API 403. Lokaal testen laat dus de terugval zien, geen bug.
- `mkTileTemplate(kind, forceHd)` — één sjabloonfunctie voor beide
  leveranciers; `mkTileLayer` en de @2x-keuze per tegel lopen erdoorheen.
- `mkStaticMapUrl` vertaalt de perceelomtrek zelf: geef hem `polygon` (de
  hoekpunten als `[lat,lng]`, zoals Leaflet ze geeft) en hij bouwt bij MapTiler
  een path-string en bij Mapbox een GeoJSON-overlay. `list.html` levert sinds
  29-08-2026 alleen nog de hoekpunten aan.
- **`mkGeocode` is sinds 30-08-2026 twee bronnen, eigen register eerst.** Mapbox
  kent Gambia niet op straatniveau. Live gemeten op mykunda.com, tegen zowel
  Geocoding v6 als de Search Box API, beide met `country=gm`: "Palma Rima Road"
  gaf één treffer — *Paima*, 45 km ernaast — en "Kairaba Avenue", "Bertil
  Harding Highway", "Coco Ocean" en "Senegambia Strip" gaven er **nul**. Een
  verkoper die op de List-pagina zijn eigen straat intikte kreeg dus geen
  suggestie en een kaart die bleef staan. `gambia-osm.json` (120 kB, 2.944
  namen: 376 straten, 1.343 plaatsen, 1.225 herkenningspunten, uit
  OpenStreetMap) staat nu vóór Mapbox; `mkRemoteGeocode` is de oude functie en
  blijft als tweede bron staan. Het bestand wordt **pas opgehaald zodra iemand
  in een locatieveld begint te typen**, staat op onze eigen server (geen live
  afhankelijkheid van een gratis dienst, werkt ook offline) en draagt de
  buildstempel in de URL — `app.js` leest die uit zijn eigen `<script src>`.
  Het staat daarom in `SITE_ASSETS` én in `VERSIONED` van `build.mjs`, en
  `.json` is aan `isStatic` in `sw.js` toegevoegd (anders belandde 120 kB in de
  paginacache en duwde het echte pagina's eruit).
  Verversen: `_werk/bouw-gambia-osm.py` opnieuw draaien, bestand vervangen,
  `node build.mjs`. Controle: `node _werk/check-locatiezoek.mjs` — die draait de
  zoeklogica op het bestand zonder browser en toetst tien bekende adressen.
  Bronvermelding: OpenStreetMap-bijdragers, ODbL 1.0 (staat al in de
  kaartattributie).
- `mkRemoteGeocode`/`mkReverseGeocode` praten bij Mapbox met Geocoding **v6**;
  `mkMbFeature` vertaalt het antwoord naar de vorm die de pagina's al lazen
  (`center`, `text`, `place_name`, `place_type`, `context`). Let op:
  uitkomsten die worden **opgeslagen** vereisen bij Mapbox `permanent=true` —
  een betaald eindpunt zonder gratis laag; het zoeken in de listingflow toont
  alleen en slaat het adres niet als geocodeuitkomst op.
- **Het Mapbox-logo is verplicht op elke kaart**, ook op de kleine wijkkaartjes
  en de perceelfoto (daar brandt Mapbox hem er zelf in). `mkBrandLogo` zet hem
  linksonder; het bestand staat zelf gehost in `images/mapbox-logo.svg` omdat
  de CSP geen vreemde afbeeldingshosts toelaat. De tekstattributie loopt sinds
  29-08-2026 via **`mkAttr(kind)`**, want ze verschilt per laagsoort: de
  kaartlaag krijgt `MK_ATTR_MAPBOX` (© Mapbox, © OpenStreetMap, "Improve this
  map") en de satellietlaag `MK_ATTR_MAPBOX_SAT` — dezelfde drie plus
  **© Maxar**, de beeldleverancier. Mapbox schrijft die vierde voor in zijn
  eigen Leaflet-handleiding en hij ontbrak tot dan. Zet `attribution` in een
  laag dus nooit meer op `MK_ATTR` rechtstreeks. De terugval naar Esri/OSM
  haalt het logo weer weg.
- De sleuteltoets op `tiles.json` is een MapTiler-eigenaardigheid: Mapbox
  stuurt bij een afgewezen token een echte 401, dus daar doet `tileerror` het
  werk en slaat `mkProbeMapKey` over.
- CSP: `api.mapbox.com` staat sinds 29-08-2026 naast `api.maptiler.com` in
  img-src én connect-src van `_headers`, `.htaccess` en `vercel.json` (drie
  bestanden, dezelfde regel — zie de waarschuwing verderop). De
  preconnect-hint in alle 49 pagina's wijst nu naar `api.mapbox.com`.

**Wat het kost:** een 512px-tegel telt bij Mapbox als één verzoek (niet vier,
zoals MapTiler telt), gratis tot 200.000 tegelverzoeken per maand en daarna
$0,50 per 1.000. Static Images: 50.000 gratis, dan $1,00 per 1.000. Geocoding
(tijdelijk): 100.000 gratis, dan $0,75 per 1.000. `tileSize: 512` +
`zoomOffset: -1` blijft de belangrijkste regel. Zet in het Mapbox-dashboard
een uitgavenlimiet, net als destijds bij MapTiler.

**Gemeten 29-08-2026: `satNativeMax` is 18, niet 19.** De 19 was overgenomen
van de MapTiler-meting van 25-08-2026 en gold niet voor Mapbox' bronbeeld. Per
zoomniveau is de tegel vergeleken met de opgeschaalde ouderquadrant en is de
gemiddelde Laplaciaan (scherpte) berekend, op vier plaatsen:

| bron-zoom | Kololi | Serrekunda | Tujereng | Basse |
| --- | --- | --- | --- | --- |
| 16 | 22,9 | 28,3 | 17,4 | 23,7 |
| 17 | 25,0 | 26,7 | 15,5 | 10,6 |
| 18 | 4,3 | 4,2 | 2,7 | 3,9 |

Overal dezelfde knik: tot bron-zoom 17 echt beeld, daarboven opschaling. De
tegelgrootte zegt hetzelfde (84 kB op z17, 37 kB op z18). Bron-zoom 17 is op
13,4 NB 0,58 m/px, wat past op het 50 cm-beeld dat Mapbox wereldwijd levert;
hoger dan 50 cm heeft Mapbox alleen in Noord-Amerika, Europa en Australie.

**Let bij dit getal altijd op de omrekening.** De lagen draaien op 512px-tegels
met `zoomOffset: -1`, dus de kaartzoom ligt een boven de bron-zoom. In de
browser nagemeten: kaartzoom 19 vraagt bron-zoom 18 op, kaartzoom 17 vraagt 16
op. `maxNativeZoom: 18` haalt dus bron-zoom 17 op — het laatste echte niveau.
Op 19 haalde de site een hele ronde tegels op zonder nieuw detail. De
documentatiewaarde 16 zou juist detail hebben weggegooid: die telt in bron-zoom,
niet in kaartzoom.

De meting is te herhalen met het script in `_werk/` (tegel ophalen, grijswaarde,
Laplaciaan) en hoort opnieuw te gebeuren zodra Mapbox nieuw beeld voor Gambia
publiceert of `MK_MAPBOX.satellite` een ander stijl-ID krijgt.

**Nog te meten:** de eigen-stijlvraag (de gele labels van de MyKunda-stijlen
bestaan bij Mapbox nog niet — dat vraagt een stijl in Mapbox Studio, waarna
alleen `MK_MAPBOX.satellite`/`streets` het nieuwe stijl-ID hoeft te krijgen).

**29-08-2026: MapTiler is geen leverancier meer.** Edwin heeft die dag bevestigd
dat de site alleen nog Mapbox gebruikt. Gemeten op dezelfde dag: vanaf
mykunda.com geeft elke MapTiler-tegel HTTP 403 en één en dezelfde
vervangingsafbeelding — nagegaan op drie totaal verschillende tegels (zoom 12,
16 en 18, verschillende plekken), byte-identiek, voor satelliet en kaartlaag.
De MapTiler-stand is dus geen werkende terugval meer; `provider` mag niet terug
naar `'maptiler'`.

Dat is geen risico voor de site, want de terugval die er werkelijk toe doet is
een andere: `MK_FALLBACK` (Esri-luchtfoto met namenlaag, OpenStreetMap voor de
kaartlaag) springt in via `tileerror` na drie mislukte tegels, ongeacht wie de
leverancier is. Die keten is sleutelloos en werkt. `mkProbeMapKey` op
`tiles.json` is een MapTiler-eigenaardigheid en doet bij Mapbox niets — Mapbox
stuurt bij een afgewezen token een echte 401 en dan doet `tileerror` het werk.

Het MapTiler-blok hieronder is daarmee dode stof geworden: het beschrijft een
stand die niet meer gekozen wordt. Het staat er nog omdat opruimen een aparte
wijziging is (`MK_MAP`, `mapTilerUrl`, de MapTiler-tak in `mkTileTemplate`,
`mkStaticMapUrl`, `mkGeocode` en `mkReverseGeocode`, plus `api.maptiler.com` in
de CSP van `_headers`, `.htaccess` en `vercel.json`). Bouw er niets nieuws op.

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
| `mkAreaMap(id, center, zoom)` | de kleine kaart van de gebiedspagina's — alle 46 roepen alleen dit aan |
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
4. `upload.bat` draaien — bouwen, uploaden, cache legen en vastleggen.

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
`node _werk/check-csp.mjs` vergelijkt de drie sinds 30-08-2026 letterlijk, toetst
of elke host die de site echt aanroept erin staat, en of wat bewust geweerd is
er níét in staat.

**De Meta Pixel stond sinds 23-08-2026 stil, en niemand kon dat zien.** Hij zit
in `app.js` (`loadAnalytics`, alleen na "Accept all") en staat in de
cookieverklaring, maar de CSP noemde zijn hosts niet — dus blokkeerde de browser
het script en meette hij nooit iets. Sinds 30-08-2026 staat
`https://connect.facebook.net` in `script-src` en `https://www.facebook.com` in
`img-src` én `connect-src`. Die drie zijn gemeten aan de inhoud van
`fbevents.js` zelf, niet gegokt: het bestand draagt één `ENDPOINT` en dat is
`https://www.facebook.com/tr/`. Wat er bewust **niet** bij hoeft: de
Topics-registratie van Meta (`Permissions-Policy` zet `browsing-topics` uit) en
`'unsafe-eval'` (het enige `new Function` in dat bestand is de
globalThis-noodgreep, in een try/catch).

**Cloudflare Insights blijft bewust geblokkeerd.** Dat script wordt door
Cloudflare zelf in elke pagina gespoten en draait dus vóór de cookiekeuze — dat
spreekt de eigen cookieverklaring tegen, die zegt dat analytics pas na
toestemming laadt. De console toont daarom een CSP-melding voor
`static.cloudflareinsights.com`; dat is bedoeld gedrag, geen fout. Wil je die
meting wél, zet Web Analytics dan uit óf aan bij Cloudflare zelf en pas hier
niets aan zonder ook de cookieverklaring aan te passen.

De perceelfoto in de verkoopflow heeft géén terugval: levert MapTiler niets, dan
komt er geen foto. Een wazige of lege kaart als hoofdfoto van een advertentie is
erger dan geen kaart, en de omtrek staat toch al als data bij de advertentie.

## De gebiedspagina's: twee generaties

Er zijn er 52, in twee soorten. De **41 oudere** (tot juli 2026) hebben zeven
vaste secties en 532–693 woorden lopende tekst. De **elf van augustus 2026** —
Mamuda, Latriya, Jambanjelly, Salagi, Farato, en sinds 31-08 Madiana, Jambur,
Ghana Town, Tintinto, Tranquil en Old Yundum — hebben er zes en 1.021–1.240
woorden. Ze missen Lifestyle scores, Getting around en What's nearby, en dat is
**bewust**: voor die dorpen bestaat die data niet, en de sectie "What we have
not measured here yet" zegt dat ook. Vul dat niet in.

### De zes van 31-08-2026

Madiana, Jambur, Ghana Town, Tintinto, Tranquil en Old Yundum zijn gebouwd met
`_werk/_bouw-nieuwe-gebiedspaginas.mjs`; elke bewering erop heeft een bron in
`_werk/onderzoek-nieuwe-gebieden-2026-08-31.md`. Wat daar "niet gevonden" heet,
staat niet op de pagina — ook niet omgeschreven. Alle bevolkingscijfers komen
uit de GBoS-census 2013 (Volume 10, Directory of Settlements), rechtstreeks
uitgelezen, inclusief de districtsindeling: Madiana, Ghana Town, Trankill en
Yundum Koto in Kombo North, Jambur en Tintinto in Kombo South. Jambur stond op
de site als Kombo Central; dat was fout.

Twee plaatsen zijn nieuw in `gambia-places.js` en daar zit een keuze in.
**Tintinto** staat op het gazetteer- en censuspunt (13,29556 / −16,78861, Kombo
South, 218 inwoners, aan de Coastal Road) en níét op de OSM-node vijf kilometer
landinwaarts: die is in 2017 uit luchtfoto's gezet, draagt geen bron en komt in
geen enkele gazetteer of census voor. **Tranquil** heet in de census en in
GeoNames *Trankill*; de pagina gebruikt de naam die makelaars en bewoners
gebruiken en noemt de censusnaam erbij. Zoek in een register altijd op Trankill.

### Bewijsklasse 'ref': het tarief van de buurplaats

Sinds 31-08-2026 kent `area-prices.json` naast `observed`, `band` en `thin` ook
**`ref`**. Die is voor een gebied dat te weinig eigen advertenties heeft én
waar geen enkele band overheen ligt — de banden zijn gebouwd uit advertenties
in met naam genoemde plaatsen, en Ghana Town en Tranquil zitten in geen ervan.
De pagina toont dan het tarief van de dichtstbijzijnde plaats die we wél hebben
gemeten en noemt die bij naam: "Brufut's rate — 7 listings there, 1 here". Een
band over een plaats heen trekken die er niet in zit, is minder eerlijk dan de
buurplaats opschrijven.

Een `ref` vraagt `ref` (de sleutel van dat gebied), `ref_km` (de afstand) en
optioneel `ref_note`. De vangrail in `build-area-prices.mjs` eist dat het
tarief, de lo en de hi letterlijk gelijk zijn aan die van het gebied waarnaar
wordt verwezen, weigert een verwijzing naar een gebied dat zelf een verwijzing
is, en weigert `ref` zodra er vijf eigen waarnemingen zijn. `valuation.js` kent
dezelfde klasse en trekt er 42 punten vertrouwen voor af — tussen een band (30)
en een regionale afleiding (52) in, want het is één gemeten plaats in plaats van
een gebundelde band, maar het is wél in de buurt echt gemeten.

Twee gebieden gebruiken hem: **Ghana Town** → Brufut (2,1 km) en **Tranquil** →
Brusubi (0,9 km). Madiana stond er eerst ook op, maar de ene advertentie die we
daar kennen vraagt D1.333 per m² — binnen de middelste helft van de band voor de
landinwaartse Kombo-dorpen en ver onder Brufut. Met die waarneming in de hand is
de band beter onderbouwd, en staat Madiana op `kombo_inland`.

Let op waar de metingen vandaan kwamen: Jambur (4 advertenties, mediaan
D1.612), Madiana (1, D1.333) en Ghana Town (1, D2.500) stonden in `LAND_HALF`
in `valuation.js`, omdat ze op 26-08-2026 nog geen pagina hadden. Ze zijn daar
weggehaald en staan nu als `n` en `own_med` in `area-prices.json`. Krijgt een
plaats uit `LAND_OBSERVED` of `LAND_HALF` een pagina, doe dat dan altijd —
`valuation-selftest.mjs` blok D valt er anders over.

En één valkuil die geld kost: de sleutels in `area-prices.json` gebruiken voor
een naam van twee woorden een **spatie**, niet een streepje ('cape point',
'ghana town', 'old yundum'). Het `slug`-veld draagt het streepje. Het model
zoekt met genormaliseerde plaatsnamen, dus een sleutel met een streepje wordt
nooit gevonden en valt stil terug op de oude portaaltabel.

Wat er wél ontbrak was de kaart, want die hangt in het blok What's nearby. Sinds
30-08-2026 hebben alle 52 er een (`_werk/patch-kaart-nieuwe-gebieden.mjs`; de
zes van 31-08 krijgen hem uit hun eigen bouwscript). Het
zoomniveau van die vijf volgt de nauwkeurigheid die de pagina zelf noemt — Farato
staat op 194 m van zijn bron en krijgt 15, Mamuda en Latriya zeggen "roughly
2 km" en krijgen 13. Een kaart die strak inzoomt op een punt dat twee kilometer
kan schelen, liegt over zijn eigen precisie.

**De helft van de tekst was standaardtekst.** Gemeten met
`_werk/audit-areatekst.mjs`, dat elke alinea met die van alle andere pagina's
vergelijkt met plaatsnamen en bedragen weggemaskeerd: 15.214 van 30.130 woorden
kwam op tien of meer pagina's letterlijk terug. Twee alinea's onder de
prijstabel waren samen goed voor ~8.100 woorden site-breed en zeiden twee keer
hetzelfde. Die zijn op 30-08-2026 ingekort (`_werk/patch-standaardtekst.mjs`,
omkeerbaar met `--terug`): 30.130 → 26.411 woorden, zonder dat er één feit uit
is. Alinea 1 heeft zes staarten (wel/geen rendement, met welke percentages) —
het script raakt alleen de openingszin, die op alle 46 gelijk is.

**De uitleg zelf staat op `how-we-measure-prices.html`,** waar elke
gebiedspagina onderaan al naar linkt. Wil je de waarschuwing uitbreiden, doe het
daar en niet 52 keer op de gebiedspagina's — dat is precies hoe deze situatie
ontstond.

`node _werk/audit-areapaginas.mjs` zet de opbouw van alle 52 op een rij (secties,
kaart, woordentelling) en meldt welke pagina een sectie mist die de rest wel heeft.

**Een gebied erbij is meer dan een pagina.** In volgorde: `area-prices.json`
(sleutel met spatie, `slug` met streepje), `gambia-places.js` plus
`_werk/_patch-appjs-plaatsen.mjs` voor `GM_AREAS`/`AREA_COORDS`, `MK_AREAS` in
`app.js` (het menu telt zichzelf, de regiotellingen hoef je niet aan te raken),
een kaartje in `areas-in-the-gambia.html` en een rij in
`gambia-property-prices.html`, en een regel in `sitemap-pages.xml`. Daarna
`node build-area-prices.mjs --write` en `node build.mjs`. Controleren met
`check-plaatsen.mjs`, `check-areaprices.mjs`, `audit-areapaginas.mjs`,
`valuation-selftest.mjs` en `_syntaxcheck.mjs`. De aantallen in de lopende tekst
("52 areas") zet `build-area-prices.mjs` zelf; typ ze nergens met de hand.

## Pushen na elke sessie

Deze repo heeft een remote: `github.com/scheperman/mykunda-com`, privé.
Dat is de enige kopie buiten deze pc.

**Sluit elke werksessie af met `git push`.** Niet omdat het netjes staat, maar
omdat een remote die maanden achterloopt je precies zoveel maanden minder
beschermt dan je denkt. Committen zonder pushen voelt als opslaan en is het
niet.

Sinds 27-08-2026 sluit `upload.bat` af met een **uitslagblok**: één regel per
stap — bouwen, uploaden, cache, git — en daaronder één oordeel. Ging alles goed,
dan sluit het venster vanzelf na tien seconden en is de exitcode 0. Ging er iets
mis, dan blijft het venster staan tot je een toets indrukt en is de exitcode 1.
Het blok leest daarbij de stand van git zelf uit: staat er nog iets staged of
ligt er een commit die niet gepusht is, dan zegt het dat, ook als de stappen
zelf "ok" meldden. Een venster dat je nooit hebt zien sluiten is geen bewijs
dat het gelukt is.

`upload.bat --zelftest` laat zien hoe een geslaagde run eindigt,
`upload.bat --zelftest fout` hoe een mislukte eindigt. Geen van beide bouwt,
uploadt of commit iets.

Sinds 26-08-2026 doet `upload.bat` de git-stap als stap 5/5 zelf, dus na een
upload is het al gebeurd. Werk je een sessie lang zonder te uploaden — aan `CLAUDE.md`, aan
een script, aan een edge function — dan blijft het jouw handeling. Weigert de
push, dan meldt het script dat en staat de commit lokaal klaar; er wordt niets
geforceerd.

Commits dragen `17229960+scheperman@users.noreply.github.com`. Dat is bewust:
GitHub weigert een push die een privé-e-mailadres zou publiceren, en het
persoonlijke gmail-adres hoort niet in de geschiedenis van een bedrijfsrepo.
Verander `user.email` in deze repo dus niet terug.

## Wisselkoersen: één bron, en die bron is de dalasi

De Central Bank of The Gambia publiceert dagelijks één kolom: **dalasi per
eenheid**. Dat is de vorm die we bewaren en teruggeven. De dalasi is het
anker; euro, dollar en pond volgen er door deling uit.

```
D per 1 EUR = eur_gmd            (van CBG)
D per 1 USD = usd_gmd            (van CBG)
D per 1 GBP = gbp_gmd            (van CBG)
EUR -> USD  = eur_gmd / usd_gmd  (kruiskoers)
```

**Er is precies één plek die een koers vaststelt: de edge function
`fx-rates`.** Die haalt op bij CBG, bewaart in `fx_rates`, vult zelf een
ontbrekende munt aan via de ECB, past zelf een handmatige override toe, en
geeft bij een GET `gmd_per` terug plus per munt de bron. De browser rekent
niet mee — `applyRates()` in `app.js` is de enige plek in de front-end waar
een koers wordt gezet, en die leest alleen.

Zet nooit een koers in een pagina, in een tweede function of in een JSON.
Zo stond de homepagina maandenlang op D83 per euro terwijl de rest van de
site op D85,74 rekende, en zo stonden er in augustus 2026 vier verschillende
koersen tegelijk in de bron.

### Wat er op 27-08-2026 is opgeruimd

* **De frontend belde zelf de ECB.** `app.js` haalde bij een ontbrekende
  notering `api.frankfurter.app` op. Dat werkte al niet meer: die host stuurt
  een 302 naar `api.frankfurter.dev` en `connect-src` liet alleen `.app` door,
  dus de CSP blokkeerde de omleiding. Erger was wat er zou gebeuren als het
  wél werkte — het overschreef ook de dollarkoers die wél van CBG kwam, en
  dan staat er een CBG-dalasi naast een ECB-dollar op één scherm. Het
  aanvullen gebeurt nu in de function, met de CBG-euro als brug.
* **Een ontbrekende munt werd een deling door nul.** `eur_gmd / gbp_gmd` met
  een lege `gbp_gmd` geeft `Infinity`, en dat serialiseert als `null`. De
  function schrijft nu de laatste goede waarde door in plaats van een null.
* **De override gold maar in één browser.** Hij stond in localStorage onder
  `mykunda_gmd_eur`, terwijl rates.html hem aankondigde als de koers waarmee
  élke prijs op de site wordt omgerekend. Hij staat nu in `fx_override`,
  sitebreed, met een reden erbij. Zolang hij aanstond ververste de site
  bovendien USD en GBP helemaal niet meer.
* **De vangrail keek alleen naar de euro.** De 3%-grens geldt nu per munt.
* **De verversknoppen op rates.html** wachtten met een `setTimeout` van
  anderhalve seconde en zetten dan "Refreshed ✓". `fetchLiveRates()` geeft nu
  een promise terug.

### De bron is de CBG-homepage, niet de koerspagina

`cbg.gm/indicative-exchange-rates-latest` heet ernaar en ziet er in een
browser goed uit, maar bouwt zijn tabel **client-side**. Een server-side
fetch krijgt 200 met 41.531 bytes waarin de valutacodes in de keuzelijst
van de omrekenmodule staan en de getallen nergens. De homepage rendert ze
wél in de HTML (66.556 bytes, alle drie de munten) en staat daarom
voorop.

Verwissel die volgorde niet terug omdat de detailpagina er logischer
uitziet. Tot 27-08-2026 stond hij voorop en viel élke run stil terug op
de homepage; `source_url` in fx_rates verraadde dat, maar niemand keek
ernaar omdat een mislukte eerste URL in een lege catch verdween.

`fetchCBG()` houdt nu per URL bij wat er gebeurde — status, bytes, welke
munten geparsed zijn, of de fout — en dat gaat als `trace` mee in het
antwoord van de POST. Wil je weten waar de koers van vandaag vandaan
komt, kijk daar: bij een goede run staat er precies één URL in met
`used: true`.

### De noodkoers in `app.js`

`CURRENCIES` draagt getallen voor de allereerste weergave met een lege cache
en een onbereikbare function. Ze staan er met `FX_FALLBACK_AS_AT` erbij, zodat
te zien is hoe oud ze zijn. Werk ze bij als je toch in dat blok zit; het is
geen tweede bron maar een startwaarde, en de function overschrijft hem binnen
een seconde.

## Dalasi is de opslageenheid, niet alleen de weergave

Sinds 27-08-2026 wordt elk bedrag **opgeslagen in dalasi** en pas in de
browser omgerekend naar de munt die de bezoeker kiest. Daarvóór stond alles
in euro's en werd het met de live koers naar dalasi vermenigvuldigd. Dat
ging op twee manieren mis:

* **Prijzen bewogen mee met de munt.** Zakte de dalasi 5%, dan stond elke
  dalasiprijs op de site de volgende ochtend 5% hoger zonder dat er iets was
  gemeten — en de vraagprijs die een verkoper als D2.000.000 intypte, kwam er
  een week later als D2.040.000 uit.
* **`create-payment` rekende met dalasigrenzen op een eurobedrag.** Een villa
  van D12.000.000 kwam binnen als ~140.000 en viel daarmee onder de grens van
  D2.000.000: `verified_s`, D4.500 in plaats van D16.000. Elke
  verkoopadvertentie zat in de goedkoopste band.

### De regel

**Een bedrag gaat de database in zoals het is afgesproken, en dat is in
dalasi.** `listings.price`, `deposit` en een vaste `fee_value` worden niet
meer omgerekend bij het opslaan of terugladen. `fromGMD()` in `app.js` is de
enige plek die van dalasi naar een andere munt gaat; `convert()` is dezelfde
functie onder zijn oude naam.

Het haakje in de HTML heet `data-gmd`, niet meer `data-eur`. Een attribuut
dat "eur" heet met dalasi erin is precies hoe een eenheid zoekraakt.

`build-area-prices.mjs` deelt niet meer door `DB.fx.eur`. Dat blok blijft in
`area-prices.json` staan als vastlegging van de koers waarop is gemeten —
het brengt de dollar- en eurokolom uit de bronadvertenties naar dalasi — maar
het rekent nergens meer mee.

### `price_currency`: de eenheid staat naast het bedrag

`listings.price_currency` is `not null default 'GMD'` met een
check-constraint die **niets anders toelaat**. `list.html` stuurt hem
expliciet mee en `create-payment` controleert hem vóórdat hij een
Verified-band kiest.

Dat lijkt overbodig zolang er maar één munt is, en dat is precies
waarom hij er staat. Een bedrag zegt uit zichzelf niet in welke munt het
staat; dat is hoe D12.000.000 als 140.007 in de goedkoopste band belandde.
Nu moet wie een ander bedrag wil opslaan óók een andere munt opgeven, en
dan weigert de database. Getest 27-08-2026: `update price_currency='EUR'`
geeft `violates check constraint "listings_price_currency_check"`.

**Verbreed die constraint nooit los.** Hoort er ooit een tweede munt in,
dan loop je in dezelfde wijziging elke plek na die `price` met een drempel
vergelijkt — te beginnen met `verifiedBandVoor()`. De controle in
`create-payment` is de tweede lijn: komt daar iets anders dan `GMD` langs,
dan is de constraint verbreed zonder dat die functie is nagekeken, en dan
stopt hij met `listing_price_currency_unsupported`.

De gekozen band draagt de eenheid mee in `payments.metadata`
(`asking_price_currency`), zodat achteraf uit de betaling zelf blijkt
waartegen er is ingedeeld.

### Een Plus Code of coördinaat moet de tarieventabel in — met zijn afstand

Op 29-08-2026 gaf de tool op `7C558652+9GG` "We have no rate for
7C558652+9GG", terwijl er anderhalve kilometer verderop elf geprijsde
advertenties liggen. De oorzaak was een regressie uit de herbouw van
26-08-2026: `areaName()` → `areaFromPlusCode()` → `nearestArea()` bleef in
`sell.html` staan, maar alleen nog vóór de **kaart**. `calc()` kreeg sindsdien
de ruwe tekst, en `matchArea()` doet niets anders dan die tekst tegen de
gebiedssleutels leggen. Tot de herbouw ging de waardering via
`rateFor(area||loc.value)` en was `area` wél opgelost.

Sindsdien lost `resolveArea()` het locatieveld op vóór `MK_VAL.value()`, en
geeft het naast de plaatsnaam de **afstand** mee (`input.areaKm`). Twee regels
die bij elkaar horen:

* **Het punt gaat vóór de naam.** Staat er allebei, dan wint de coördinaat —
  een naam zou het model laten denken dat het hele gebied bedoeld is, en dat
  maakt de band smaller dan het bewijs toelaat.
* **Afstand verbreedt de band, hij verschuift het tarief niet.** In
  `confidence()` kost 0–2 km 8 punten, 2–5 km 25 en daarboven 40, met een
  bodem onder de band van 0,55 respectievelijk 0,70.

Die drempels zijn gemeten, niet gekozen. Over de dertien gebieden met een
eigen mediaan is elk gebied weggelaten en voorspeld uit zijn dichtstbijzijnde
buur (2,8–10,1 km uit elkaar): mediane afwijking factor 1,75, binnen 6 km
1,57, en maar 46% van de gevallen binnen ±60%. Onder de 2 km is er géén
meting — de twee dichtstbijzijnde gebieden in de lijst liggen 2,8 km uit
elkaar — dus die trap staat er op een ander argument: een gebiedsmediaan is
zelf al een gemiddelde over advertenties die over het hele dorp verspreid
liggen. Komt er ooit een variogram op de losse advertenties uit het
Facebook-bestand, dan hoort die trap als eerste herijkt te worden.

`nearestByCoords()` leest bewust `AREA_COORDS` en niet `areaFromCoords()` uit
`app.js` (tabel `GM_AREAS`): dezelfde plaats staat in die twee tabellen een
paar honderd meter uit elkaar, en het tarief komt uit `AREA_COORDS`.

### De pin op de kaart schrijft het locatieveld — en gaat vóór de naam

Tot 29-08-2026 werkte een klik op de kaart of een versleepte pin in de
waarderingstool alleen `LD.ll` en de zeeafstand bij; het locatieveld bleef op
de eerder getypte naam staan en `calc()` rekende door op het oude gebied. Wie
"Kerr Serign" koos en de pin naar Bijilo sleepte, zag Bijilo op de kaart en
Kerr Serign in het veld én in het bedrag. Edwin meldde dit op de dag zelf.

Sindsdien doet `ldAdoptPin()` in `sell.html` drie dingen bij elke met de hand
gezette pin (kaartklik, pin verslepen, ingetekende kavel — de centroid):

1. het veld en het kaartlabel krijgen de dichtstbijzijnde bekende plaats uit
   `nearestByCoords()` — het eigen register, niet Mapbox, want het veld voedt
   de tarieventabel (Mapbox mag alleen het kaartlabel verfijnen); buiten 12 km
   van elke bekende plaats komt de coördinaat zelf in het veld;
2. `LD.pinExact` gaat aan, en `calc()` rekent dan met het púnt
   (`nearestByCoords(LD.ll)`, mét afstandsklasse) in plaats van de veldnaam —
   een gesleepte pin geeft zo hetzelfde antwoord als dezelfde plek getypt als
   coördinaat;
3. de rapportaanvraag krijgt de pin als `payload.pin` mee, zodat de expert de
   exacte plek heeft en niet alleen de gebiedsnaam.

De lusbewaking zit in de events: veld → kaart loopt via `input`,
`ldAdoptPin()` vuurt bewust alleen een programmatische `change`
(`isTrusted=false`). Echt typen (`isTrusted=true`) zet `LD.pinExact` weer uit
en de naam heeft weer de regie. Wie hier een derde pad bijbouwt: houd dat
onderscheid in stand, anders vliegt de kaart terug naar het gebiedsanker op
het moment dat iemand de pin loslaat.

Lokaal controleren kan met `node _werk/serve-lokaal.mjs` (statische server;
Mapbox-tegels weigeren op localhost, de terugvallaag doet het wel) en
`node _werk/check-inline-js.mjs sell.html` (syntax van de inline scripts).

### Geen tweede tarieventabel in een pagina

Op 27-08-2026 stonden er in `sell.html` eigen `HOUSE`/`APT`/`LAND`-tabellen
in EUR per m² voor ruim 180 gebieden, met `rateFor()` eromheen. Dertien
kilobyte, en **geen enkele aanroep**: `rateFor`, `effectiveArea`,
`effectiveLandArea`, `row`, `rowStrong`, `rowMuted` en `pct` werden alleen
gedefinieerd. De schatter die de pagina wél toont rekent via
`window.MK_VAL`, net als `list.html`.

Ze waren bovendien uit de pas gelopen — Kololi stond er op EUR 140 per m²
(D11.999) waar `area-prices.json` en `valuation.js` allebei D8.800 zeggen.
Een vierde bron voor gebiedsprijzen die niemand las, maar die er wel
uitzag alsof je hem kon vertrouwen. Weggehaald.

Nieuwe gebiedstarieven horen in `area-prices.json` of in het
`LAND_OBSERVED`/`LAND_HALF`-blok van `valuation.js`. Niet in een pagina.

### Wat de vangrail in `create-payment` wél en niet vangt

`MIN_VRAAGPRIJS_GMD` staat op D50.000 en weigert een Verified-bestelling
met `asking_price_implausible` als de vraagprijs daaronder zit. Getest op
27-08-2026: D30.000 geeft 409 en er wordt geen betaling aangemaakt.

**Reken je daar niet rijk mee.** Die grens vangt een grove eenheidsfout in
de onderkant van de markt, en verder niets. Was de villa van D12.000.000
uit deze test nog in euro's opgeslagen, dan stond er 140.007 — ruim boven
D50.000, dus de vangrail zwijgt en de bestelling belandt gewoon in
`verified_s` voor D4.500. Precies de fout die we net hebben weggehaald.

Hoger zetten kan niet: 400 m² grond upcountry doet D28.400, dus boven de
D50.000 begin je echte advertenties te weigeren.

Wat dit wél dichtzet is de eenheid naast het bedrag: `price_currency`, zie
hierboven. Deze grens is de tweede lijn, voor het geval een bedrag ooit in
dalasi wordt opgeslagen maar dan een orde van grootte ernaast zit.

### Wat bewust in euro's blijft

Twee dingen zijn geen afgeleide van een dalasibedrag maar een eigen markt of
een eigen ijking, en die blijven staan:

* `PORTAL_RATE` in `valuation.js` — het diaspora-aanbod wordt in euro's
  geadverteerd en is in euro's waargenomen. Er in dalasi over rekenen zou een
  tweede markt wegpoetsen die er echt is.
* De bouwkosten in `valuation.js` (`BUILD_COST`, `BUILD_EXTRA`) zijn in euro's
  geijkt. Ze zijn van onderaf opgebouwd uit dalasi-materiaalprijzen, maar de
  gepubliceerde uitkomst is EUR 200/300/500 — ronde getallen, gekruist met
  USD-bronnen. Omrekenen geeft D17.148/D25.722/D42.870, een precisie die er
  niet is. **Doe dit bij de volgende herijking**, niet los: het juiste moment
  om de eenheid van een geijkt model te veranderen is wanneer je hem opnieuw
  afleidt, zodat de nieuwe getallen in de nieuwe eenheid rond uitkomen.
  Sinds 27-08-2026 noemt `guide-building-a-house-in-the-gambia.html` dezelfde
  drie tarieven (D17.000/25.500/43.000 per m², incl. de FAQ-structured-data);
  wijzigt BUILD_COST, dan hoort die gids in dezelfde beurt mee.

`money()` in `sell.html` rekent daarom eerst naar dalasi
(`* CURRENCIES.EUR.gmdPer`) en daarna pas naar de weergavemunt. Die functie
mag `convert()` níét rechtstreeks op een eurobedrag loslaten: `convert()`
neemt dalasi, dus dan wordt er gedeeld waar vermenigvuldigd hoort en staat
een huis van EUR 900 per m² als D10 op het scherm.

De marktindex (`market_observations.price_usd`, `market_snapshots`) blijft
in dollars. Dat is een index met veertig maanden geschiedenis waarin de
eenheid tegen zichzelf wegvalt, en `market-sources` haalt zijn koers al uit
`fx_rates`. Omzetten zou geschiedenis herschrijven zonder iets op te
lossen.

### Twee stille fouten die hierbij boven kwamen

**De vergelijkingslijst op de areapagina's werd nooit bijgewerkt.** De
generator zocht op `var comp=` met dubbele aanhalingstekens; de pagina's
schrijven `const comp=` met enkele. Hij matchte dus geen enkele pagina, en de
melding daarover stond binnen de `replace` die nooit draaide. Sindsdien
tolerant op beide, en een gemiste match is nu een gemeld probleem.

**De wijktegels op de voorpagina stonden met de hand in de pagina.** Kololi
was er D83.747/m², op `/buy` D95.450, en op de areapagina zelf D8.800 —
met een koers van D83,00 per euro ingebakken die nergens anders voorkomt. Ze
komen nu uit `area-prices.json` en heten "Land", net als overal elders.

## Het areamenu: 46 gebieden in zeven groepen (28-08-2026)

`MK_AREAS` in `app.js` is de enige bron voor het areamenu, voor de zoekkiezer
op /buy en /rent, en — via deze regel — voor de regiokolom in de twee
prijstabellen. Op 28-08-2026 zijn de zes groepen zeven geworden, west naar
oost: **Greater Banjul · Kombo Coast · Kombo Inland · North Bank · Lower River
· Central River · Upper River**. "Banjul Area" en "Upcountry" bestaan niet
meer; "Upcountry" zette Soma en Mansa Konko (Lower River) achter Central
River, wat geografisch omgekeerd is. Dezelfde zeven namen staan als koppen op
`areas-in-the-gambia.html` en in de kolom `reg` van beide tabellen. Wijkt daar
iets af, dan is `MK_AREAS` de baas.

Beide areamenu's (desktop én mobiel) sluiten af met een link naar
`areas-in-the-gambia.html`; het aantal in die link komt uit `MK_AREAS.length`,
dus tel nooit met de hand mee.

### De vijf gebieden die erbij kwamen

Salagi, Farato, Latriya, Mamuda en Jambanjelly. Ze zijn gekozen op **bewijs**,
niet op bekendheid: in het Facebook-bestand van 25-08-2026 en in
`external_listings` staan ze bij de meest genoemde plaatsen van het hele land
(Mamuda 23 vermeldingen, Brufut 20, Brusubi 20 — tegen Kololi 6 en Cape Point
1), terwijl zestien gebieden die wél een pagina hadden in geen van beide
bronnen voorkomen.

Hun pagina's zijn met opzet **soberder** dan de andere 41: geen
leefbaarheidsscores, geen reistijden in minuten, geen tellingen van winkels of
scholen. Dat onderzoek bestaat voor deze vijf niet, en een verzonnen score is
precies wat de eerlijkheidsalinea belooft niet te doen. In plaats daarvan
heeft elke pagina een blok "What we have not measured here yet" en een
bronnenlijst onder het stuk over grond en titel. Neem die blokken niet weg bij
een volgende bewerking; ze zijn het verschil tussen dun en onbetrouwbaar.

Wat er wél op staat is nagetrokken bij Gambiaanse pers en officiële bronnen.
Vier van de vijf hebben een gedocumenteerd, onopgelost titelverhaal (Salagi:
sloop 2020 en 2025; Farato: 950+ ontruimingsaanzeggingen 2024 om de
dorpsgrens met Bafuloto; Latriya: eigendomsgeschil sinds 2014; Mamuda: de
grensruzie bij Pacholling). Bij Jambanjelly is er niets gevonden — en dat
staat er ook zo, als "wij vonden er geen", niet als "die zijn er niet".

### De vijfde band: `kombo_inland`

Farato, Latriya, Mamuda en Jambanjelly pasten in geen bestaande band. In de
`kombo`-band (D2.330) zou Mamuda D2.330 publiceren terwijl zijn eigen vier
advertenties op D948 uitkomen — ruim twee keer zo hoog. Er is daarom een band
bij: **D1.560 per m², p25–p75 D1.190–D2.080, n=13**, de gepoolde mediaan over
de dertien prijsbare kavels van die vier dorpen. Hij zit netjes tussen
`tanji_tujereng` (D2.280) en `sanyang_gunjur` (D970), en de vangrail in
`build-area-prices.mjs` bewaakt die volgorde nu ook.

Salagi zit in de bestaande `kombo`-band: zijn twee prijsbare kavels (mediaan
D2.915) liggen erboven, en twee waarnemingen zetten geen tarief. De bestaande
banden zijn **niet** herrekend — dat zou zes andere pagina's laten bewegen
zonder dat iemand het gevraagd heeft. Neem het mee bij de herijking van
3 september: dan horen de nieuwe waarnemingen gewoon in de pool.

### Wat de generator er sindsdien bij doet

Twee dingen die eerder met de hand in pagina's stonden en stil achterliepen:

* **De gebiedsaantallen in lopende tekst.** "41 areas" stond op vier pagina's,
  plus "12 van de 41" en "13 van de 41 — en de andere 28". Die drie getallen
  komen nu uit `area-prices.json` (aantal gebieden, aantal `observed`, aantal
  zonder huurcijfer). Typ ze nergens meer.
* **De drie budgetbanden op `areas-in-the-gambia.html`.** Die stonden in
  DOLLARS per m² en dateerden van vóór de omzetting naar dalasi: "Under
  $150/m²" is D10.900 per m², waar sinds 27-08-2026 vrijwel elk gebied van het
  land onder valt — Brusubi stond in de middelste band terwijl het op $89 per
  m² staat. Ze worden nu uit de tabel geschreven, in dalasi.

`check-rents.mjs` telt het aantal pagina's voortaan zelf; de "41" in de
slotregel stond er ook met de hand.

### Eén bron: de Valuation-tool leest nu wat de areapagina publiceert

Op 27-08-2026 is besloten dat geen enkel gebied een eigen grondtarief
publiceert onder **vijf** bruikbare waarnemingen — één advertentie is geen
markt. Die regel is toen doorgevoerd in `area-prices.json` en op de
areapagina's, maar **niet** in `valuation.js`, dat op n≥3 bleef staan met een
eigen, met de hand bijgehouden tabel. Op 28-08-2026 gaf de tool daardoor over
**twintig van de 46 gebieden** een ander getal dan de pagina ernaast:

| gebied | pagina | tool (oud) | verschil |
|---|---|---|---|
| Bakoteh | D2.330 | D10.549 (1 advertentie) | **+353%** |
| Cape Point | D6.460 | D16.667 (1) | +158% |
| Banjul | D6.460 | D12.500 (1) | +93% |
| Serrekunda | D2.330 | D6.006 (zonefactor) | +158% |
| Kotu | D6.460 | D9.971 (1) | +54% |
| Latriya | D1.560 | — (gebied onbekend) | tool weigerde |
| Mamuda | D1.560 | D896 (5) | −43% |

Bakoteh was precies het getal dat op 27-08-2026 als ongeloofwaardig was
aangemerkt: de pagina was gerepareerd, de tool niet.

**Hoe het nu werkt.** `valuation.js` bevat een blok tussen
`/* mk:land-published */` en `/* /mk:land-published */` dat door
`build-area-prices.mjs` uit `area-prices.json` wordt geschreven — tarief,
bewijsklasse, aantal waarnemingen en de eigen mediaan per gebied. `landRate()`
kijkt daar als eerste. Bewerk dat blok nooit met de hand.

`LAND_OBSERVED` en `LAND_HALF` gelden sindsdien **alleen nog voor plaatsen
zonder eigen areapagina** (Kitty, Jambur, Sifoe, Brufut Heights, Ghana Town,
Madiana, Jalanbang, Bafuloto, Faraba, Pirang). Daar geldt dezelfde bar: een
eigen mediaan pas vanaf vijf waarnemingen. Jambur (4) en Sifoe (3) zijn
daarop naar `LAND_HALF` gegaan.

`confidence()` heeft er twee klassen bij: `band` (−30, tussen een lokale
mediaan en één losse advertentie in) en `regional` (−52). Gebieden die eerder
62 tot 74 punten scoorden op twee tot vier advertenties komen nu op 44 uit —
dat is geen verslechtering maar het wegnemen van een belofte die er niet was.

**Blok D van `valuation-selftest.mjs`** legt de tool naast `area-prices.json`
en faalt bij elk verschil in tarief, aantal of bewijsklasse, en zodra een
gebied met een pagina óók nog in `LAND_OBSERVED` of `LAND_HALF` staat. Draai
die zelftest na elke herijking, vóór upload.

### De vijf punten die voor 3 september op de lijst stonden

Op 28-08-2026 alsnog per punt bekeken in plaats van doorgeschoven. Uitkomst:

**1. De vier bestaande banden herrekenen — vervallen, er is niets toe te voegen.**
De banden poolen Bijilo/Fajara/Kololi/Kerr Serign/Brusubi/Kotu/Banjul/Cape Point
(strip), Sukuta/Lamin/Jabang/Yundum (kombo), Tanji+Tujereng, Sanyang+Gunjur. Van
de vijf nieuwe gebieden valt er precies één in een bestaande band: Salagi, in
`kombo`. Zijn twee prijsbare kavels zijn D1.900 en D3.931 — één onder en één boven
de huidige mediaan van D2.330. Eén waarde onder en één boven toevoegen aan 31
gesorteerde waarden verschuift de mediaan van de 16e van 31 naar de 17e van 33,
en dat is **hetzelfde element**. De band beweegt dus aantoonbaar niet. De andere
drie banden krijgen geen enkele nieuwe waarneming. Pas als er nieuwe marktdata
binnenkomt is hier weer werk.

**2. Het Bakoteh-huurpaar — kan niet zonder de bronadvertenties.**
De drie huuradvertenties die D28.500 per maand opleveren staan in het
Facebook-bestand van 25-08-2026 en zijn nooit in `external_listings` beland; de
pijplijn heeft voor Bakoteh geen enkele huuradvertentie. Zonder die drie regels
is er niets te beoordelen. De pagina doet nu al het voorzichtige: de huur staat
er met "3 rental listings only", en het rendement is bewust leeg met de reden
erbij (8,5% tegen een afgeleide woningprijs zou de 1–8%-vangrail raken). Dit
punt wacht op het bestand, niet op een beslissing.

**3. Farafenni — opgelost.** Publiceerde D93 per m² uit ÉÉN advertentie, terwijl
de regel van 27-08-2026 zegt dat één advertentie geen gebiedstarief zet. Dat was
dezelfde fout als Bakoteh, alleen naar beneden: Farafenni stond daarmee onder
Kerewan en Essau, die uit dezelfde tabel komen. Publiceert nu **D189**, de
regionale afleiding die Kerewan ook krijgt (portaaltabel D343 × 0,55), met de
D93 ernaast als context. Boven de Kombos is er geen buurband om van te lenen; de
generator zegt dat er nu ook bij.

**4. `zone_scale` opruimen — het item was fout.** Het blok is niet dood.
`upcountry: 0.55` is de **live** afleiding van alle twaalf tarieven boven de
Kombos: Barra D600×0,55=330, Essau D429×0,55=236, Kerewan en Basse D343×0,55=189,
enzovoort. Alleen `coast`, `kombo` en `greater` zijn door de banden vervangen.
Het commentaar in `area-prices.json` zei "ongebruikt sinds 27-08-2026" en dat
klopte voor drie van de vier. Rechtgezet; niet weggooien zolang upcountry hierop
rust.

**5. Jambanjelly stond in `ZONE_OF.coast` — opgelost**, verplaatst naar `kombo`.
Het dorp ligt 6,8 km van de kustlijn. Het viel niet op omdat het gebied via
`LAND_PUBLISHED` wordt afgehandeld, maar de zone bepaalt wél de terugval voor
alles wat er in de buurt ligt en geen eigen pagina heeft.

### Waar de oude toolgetallen vandaan kwamen

De tellingen in `valuation.js` weken af van die in `area-prices.json` voor
dezelfde meting van 25-08-2026 (Farato n=13 tegen 4, Mamuda 5 tegen 4, Salagi 4
tegen 2). Die afwijking is weg doordat de tool de telling van
`area-prices.json` overneemt, maar de herkomst is niet achterhaald: de oude
getallen zijn niet reproduceerbaar uit `external_listings`, dat voor alle vijf
precies de aantallen van `area-prices.json` geeft. Vermoedelijk zijn ze met een
ruimere definitie uit het Facebook-bestand geteld. Duikt er ooit een tweede
telling op: de pijplijntelling is de reproduceerbare.

### Wat de ruwe import laat zien en de pijplijn terecht tegenhoudt

In `market_import_raw` staan vier advertenties waarin het **telefoonnummer als
prijs** is ingelezen (Tujereng D3.071.677, Gunjur D5.142.869 en D7.731.519,
Serrekunda D2.966.066). Geen van vieren heeft `external_listings` gehaald, dus ze
vervuilen geen enkel gepubliceerd cijfer. Wel iets om in de gaten te houden bij
de volgende import: een prijs van zeven cijfers die ook letterlijk in de
omschrijving staat na "call" of "contact" is bijna altijd een nummer.

### Coördinaten

`gambia-places.js` had Jambanjelly op 13,2167 / −16,7500. Dat is het
zwaartepunt van het *district* Kombo South, niet het dorp: ruim 7 km mis.
Gecorrigeerd naar 13,2806 / −16,7276 (GeoNames, als "Jambanjali", en
OpenStreetMap liggen 0,4 km uit elkaar; dit ligt ertussen). Salagi, Farato,
Mamuda en Latriya zijn toegevoegd, en `Serekunda` heet daar nu ook
`Serrekunda`, zoals de rest van de site het schrijft.

Let op bij alle vijf: **Salagi, Mamuda en Latriya staan in geen enkele
gazetteer** — niet in GeoNames, niet in OpenStreetMap, niet in de nationale
nederzettingenlaag. Hun coördinaat is een schatting op 1,5 tot 2 km, en dat
staat ook op de pagina zelf. Farato staat er onder zijn oude naam *Medina
Suware Kunda*; drie ándere plaatsen in het land heten óók Farato, en

#### Plaatscontrole 30-08-2026: één bron, en de val van 26-08

Edwin zag dat plaatsen op de verkeerde plek op de Mapbox-kaart stonden. De
oorzaak bleek tweeledig. Eén: de correctieronde van 26-08 heeft
`gambia-places.js` en de areapagina's gerepareerd, maar **niet** `GM_AREAS`
en `AREA_COORDS` in `app.js` — en juist die twee voeden de kaart in de
listing-wizard (list.html) en de Valuation-tool (sell.html). Daardoor stonden
39 plaatsen er in de site-bronnen onderling tot 40 km naast (Gambissara,
Fatoto, Sinchu Alagie…), en won bij Jambanjelly een dubbele objectsleutel met
het oude districtszwaartepunt. Twee: de dorpenstaart (de "additional
villages"-blokken met twee decimalen) was nooit gecontroleerd; 55 dorpen
stonden in álle tabellen fout, tot 78 km (Bondali) en 29 km (Sibanor).

Alle 186 plaatsen zijn vergeleken met OpenStreetMap (alle place-nodes én
-ways binnen Gambia via Overpass, 1.112 bruikbare vermeldingen) en GeoNames
(cities500): 75 gecorrigeerd met bronvermelding, 31 zonder bron gevlagd
(`// niet onderbouwd` in `gambia-places.js` — daar niets aan "verbeteren"
zonder bron; Plus Codes van Edwin zijn de beste route, zoals eerder bij
Sinchu Alagie en Nema Kunku). Een steekproef van 12 correcties is bevestigd
tegen Mapbox Geocoding v6 zelf: 11 exact, 1 binnen 0,4 km. Volledige tabel
met bewijs per plaats: `_werk/plaatscontrole-2026-08-30.json`.

De GeoNames-val die de oude Gambissara-fout verklaart: GeoNames "Gambissar"
(13,317 / −13,95) is het dorpje Gambisarra Lamoi in Kantora, niet de stad
Gambissara (13,238 / −14,311). Wie blind op GeoNames-namen geocodeert, zet
de stad 40 km mis. OSM had het wel goed.

Voor **straten en herkenningspunten** is `gambia-places.js` niet de bron —
dat is `gambia-osm.json` (zie het Mapbox-hoofdstuk hierboven). De twee staan
los van elkaar: `gambia-places.js` bepaalt de gebiedsindeling en de prijzen,
`gambia-osm.json` alleen wat het zoekveld herkent.

Het locatieveld op `list.html` heeft sinds 30-08-2026 twee vangnetten die het
daarvoor niet had. Eén: op Enter of blur neemt het de klaarstaande suggestie
over, en vindt het er geen, dan zoekt het alsnog één keer — daarvoor stond er
meteen "not a recognised area" en bleef de kaart staan, ook als de treffer
eronder klopte. Twee: `locAdopted` onthoudt wat een aangeklikte suggestie in
het veld heeft gezet, want de blur daarna las die volledige naam ("Palma Rima
Road, Kololi, The Gambia") als een gebiedsnaam, herkende hem niet en gooide
een goede treffer alsnog weg.

**De regel sinds 30-08-2026: `gambia-places.js` is de enige bron.**
`GM_AREAS` en `AREA_COORDS` in `app.js` zijn daaruit gegenereerd (zelfde
waarden; langste naam eerst, zodat substring-matching in `plusCodeRefPoint`
nooit op een kortere naam als "Banjul" in "Banjulunding" blijft hangen) en
worden nooit los bijgewerkt. `node _werk/check-plaatsen.mjs` bewaakt de
gelijkheid van de drie tabellen en hoort in elke controle-run; hij faalde op
de oude bestanden met 83 verschillen en staat nu op nul.

Diezelfde dag heeft Edwin de invullijst met de 31 niet-onderbouwde plaatsen
teruggegeven; die is verwerkt. Vijftien plaatsen kregen een eigenaarspunt of
een hoofdplaats-anker (de vijf districtsnamen ankeren nu op Diabugu, Baja
Kunda, Fatoto, Kass Wollof en Ngayen Sanjal), twee namen zijn gecorrigeerd
(Kaiaf Niji → Konti Kunda Niji, Basse Nding → Banjul Nding — die laatste ook
in de sleutels van valuation-areas.js en AREA_LABELS in sell.html), Bani en
Bantanto zijn op zijn keuze verwijderd, en twaalf plaatsen zijn bewust
gehandhaafd zonder gazetteer-bron (zo gemarkeerd in gambia-places.js). Let op
bij Konti Kunda Niji en Konteh Kunda: dat zijn nu twee vermeldingen op ~1 km
van elkaar in Baddibu — mogelijk hetzelfde dorp, bewust zo gelaten.

Nog open na de verwerking: wil Edwin Bantanto terug, dan moet hij kiezen
tussen de twee CRR-dorpen (bij Bansang 13.418,-14.652 of bij Jarreng
13.613,-15.159); en voor het gehandhaafde Bantango Koto (13.55,-14.72) bleek
er na zijn invulling alsnog een OSM-kandidaat te bestaan: Bantangkoto
(Village/Fulakunda, Niamina, 13.645,-15.294, alleen als way gemapt) — nog aan
hem voorgelegd.
kaartdiensten geven meestal die in Upper River.

## Gebiedsprijzen: één bron, en huur nooit uit een prijs

`area-prices.json` is de enige bron voor elk bedrag op de 41 area-pagina's, op
`gambia-property-prices.html`, op `land-for-sale-in-the-gambia.html` en in het
buurtblok van `property.html`. `build-area-prices.mjs` schrijft die pagina's
eruit en moet **vóór** `build.mjs` draaien. Zet nooit met de hand een bedrag in
een pagina — de volgende run overschrijft het, of erger, hij overschrijft het
niet en dan lopen de vijf plekken met hetzelfde getal weer uit elkaar.

### De eerlijkheidsalinea is van de generator

Sinds 27-08-2026 sluit elk waardeblok af met de vaste alinea "These figures are
as honest as we can make them — and still young…": betrouwbare Gambiaanse
marktdata bestaat nog nauwelijks — voor niemand — en het bouwen ervan is een
deel van waarom MyKunda bestaat. Die tekst is eigendom van
`build-area-prices.mjs`, net als de rest van het blok; niet in een pagina
herformuleren. De handgeschreven, uitgebreidere versies staan op
`how-we-measure-prices.html` (sectie "Where the data stands today"), in de FAQ
("How accurate are the prices on MyKunda?", ook in de structured data) en op
`about.html`. Wijzigt de boodschap, dan horen die vier plekken samen bij te
blijven.

### De regel die op 27-08-2026 is bijgekomen

**Een huur wordt nooit uit een vraagprijs afgeleid, en een rendement nooit uit
een aanname.**

Tot die datum was `rent_year` op 24 van de 29 gebieden met een huurbedrag exact
2,0% van de vraagprijs van de woning op diezelfde pagina. Vervolgens meldde
`how-we-measure-prices.html` een bruto huurrendement van "roughly 2%" als
bevinding. Dat was dezelfde 2% die er was ingestopt. Kololi stond daardoor op
D124.000 per jaar terwijl Songhai Properties er onmeubileerde driekamerwoningen
adverteert voor D350.000 tot D450.000.

Wat er nu geldt:

* Huur komt alleen uit **huuradvertenties**, per gebied: mediaan van woningen
  met twee of meer slaapkamers, onmeubileerd, met p25–p75 als band.
* **Geen bewijs, geen bedrag.** Grond mag van een buurgebied worden geschaald
  omdat grondprijs meebeweegt met locatie. Huur niet: over de gebieden waar we
  huuradvertenties hebben, is het verband tussen lokale huur en lokale
  grondprijs vrijwel nul (R² = 0,004). Dertien gebieden hebben een huurcijfer,
  achtentwintig niet, en die zeggen dat ook.
* **Periode is geen detail.** Facebook toont ongeveer de eerste honderd tekens,
  en "D45.000" kan een maand, zes maanden of een jaar betekenen. Onleesbaar =
  weglaten, niet raden. Ongeveer één op de zes huuradvertenties valt daarop af.
* Een losse kamer of een room-and-parlour telt niet mee: dat is geen kleine
  woning maar een ander product.
* `yield` in het bestand is een **uitkomst**, geen invoer. Hetzelfde geldt voor
  `RENT_YIELD.local` in `valuation.js`: dat stond op 1,95%, geijkt op precies
  die kapotte huren, en is herijkt naar 2,7% — de mediaan over dertien gebieden
  waar huur en vraagprijs los van elkaar zijn waargenomen.

### Wat er meedraait als controle

* `node check-rents.mjs` — legt de gebouwde pagina's in `deploy/` naast
  `area-prices.json` en klaagt bij elk verschil, bij een achtergebleven
  2%-tekst en bij een rendement buiten 1–8%.
* `node valuation-selftest.mjs` — blok C toetst of het ene landelijke rendement
  de per gebied waargenomen huren nog reproduceert. Grenzen: scheefheid ten
  opzichte van de mediaan maximaal 0,40 procentpunt, en geen gebied verder dan
  een factor 2 buiten zijn band.

Een rendement buiten 1–8% is bijna altijd hetzelfde probleem: een lokale huur
die tegen een expat-vraagprijs is afgezet. Zoek dan de bron van het paar, niet
een correctiefactor.

De eenmalige scripts van deze herijking staan in `_werk/` met de datum in de
naam. Ze zijn geschiedenis, geen onderdeel van de bouw.


## De naam in de begroeting komt uit de sessie, niet uit de cache

`localStorage.mykunda_user` is een weergavecache, geen bron van waarheid. Bij
een vroege aanmelding werd de naam daar afgeleid uit het e-mailadres
(`edwinscheperman@gmail.com` -> `Edwinscheperman`). Alles wat op voornaam groet
doet `split(' ')[0]`, en zonder spatie levert dat de hele naam op — de code was
goed, de data niet.

De regel: de naam die het account draagt wint van de naam in de cache.

* `auth.html` schrijft na OTP-verificatie de naam uit het account
  (`user_metadata.full_name` of `.name`) en valt alleen terug op de uit het
  e-mailadres afgeleide naam als het account niets draagt. Het magic-linkpad
  doet hetzelfde.
* `supabase.js` heeft `syncCachedUserName()`, die bij elke paginalading de
  cache geneest. Die leest `sb.auth.getSession()` — dat komt uit local storage,
  dus het kost geen netwerkcall. Alleen als de sessie zelf geen naam draagt
  volgt één `profiles.full_name`-lookup.
* Draait één tick ná `DOMContentLoaded`: `app.js` tekent de header in zijn
  eigen listener, en wij corrigeren wat er staat in plaats van ermee te racen.
  Gecorrigeerd worden `.user-chip` (naam, initialen, `title`) en `#welcomeName`.

Wie iets nieuws bouwt dat de naam toont: lees `getUser()`, toon de voornaam, en
laat het genezen aan `syncCachedUserName()` over. Schrijf niet nog ergens een
eigen afleiding uit het e-mailadres.

## Een vastgezette balk hoort bij zijn sectie

`.mkv-rail` op `sell.html` — de ESTIMATED VALUE-balk — is onder 1100px
`position:fixed;bottom:0`. Er stond niets tegenover, dus hij bleef over de
prijstabel, de FAQ, de voettekst en de WhatsApp-knop staan, de hele pagina lang.

De regel: wat `position:fixed` is, hoort weg zodra de sectie waar het bij hoort
uit beeld is. In `sell.html` doet een `IntersectionObserver` op `#value` dat:
buiten beeld krijgt de balk `data-off` (`transform:translateY(115%)` plus
`pointer-events:none`, alleen binnen de mobiele media-query) en klapt hij dicht;
in beeld gaat het attribuut eraf. Boven de sectie is hij nu ook weg, dus hij
dekt de hero niet meer af. Vanaf 1100px is de balk de onderste rij van de
werkbank (zie hieronder) en staat hij dus altijd stil — daar doet het attribuut
niets.

De `#value{padding-bottom:150px}` blijft staan: die reserveert ruimte binnen de
sectie, waar de balk wél hoort.

## De waarderingstool is een werkbank, geen formulier met een plaatje

Tot 28-08-2026 stond de tool als één kolom vragen met daaronder een kaart van
260px hoog, en rechts een smalle kolom met het bedrag. De kaart is niet de
illustratie bij die vragen — het is het gereedschap waarmee de verkoper zijn
perceel aanwijst en intekent. Op 260px is dat niet te doen, en de rest van de
pagina liet zien hoe kaal dat blok erbij stond.

Sindsdien is `.mkv` één omkaderd raster met drie vlakken:

* **links** `.mkv-form` — de stappen, met een voortgangsbalk (`#mkvProg`)
  bovenaan en een vaste voetnoot onderaan. Het paneel scrolt zelf
  (`overflow-y:auto`), zodat de kaart niet meebeweegt met een lang stap 4;
* **rechts** `.mkv-map` — de kaart, over de volle hoogte van de werkbank, met
  daaronder een balk (`.mkv-mapbar`) met de plaatsnaam en één regel uitleg die
  per stap meeloopt (`setMapHint()`);
* **onderlangs** `.mkv-rail` — het bedrag, over beide kolommen. `#mkvMore` is
  een lade die op elke breedte dicht begint en met `The workings` opengaat.

De hoogte van de bovenste rij is `clamp(560px, calc(100vh - 240px), 720px)`.
Onder 1100px stapelt alles en wordt de balk weer `position:fixed`.

Wat je hierbij moet weten voordat je eraan sleutelt:

* `.vmap-tools` en `#ldRead` staan **naast** `#ldMapBox`, niet erin. Daardoor
  komt een klik op een knop nooit op de kaart terecht. Het JS bindt op
  `#ldTools [data-ldmode]`, dus de knoppen mogen daarbinnen gegroepeerd staan;
  de segmentknop `.vmt-seg` doet dat.
* De zoomknoppen zijn na `mkBaseToggle` verplaatst naar `bottomright`
  (`ldMap.zoomControl.setPosition`). Linksboven is van de tekengereedschappen.
  `.vmap-tools` houdt rechts 104px vrij voor de Satellite/Map-schakelaar.
* **Een kaart die een kolom vult, moet blijven weten hoe groot hij is.** Leaflet
  meet zijn venster één keer bij het opzetten en daarna alleen bij
  `window.resize`. Klopt die maat niet, dan vraagt hij tegels op voor een
  kleiner vlak en blijft de rest leeg — bij de eerste versie van de werkbank gaf
  dat na het kiezen van een gebied een half gevulde, donker ogende kaart. In het
  oude ontwerp viel dat niet op: 745 × 260 paste binnen één rij tegels.

  De correctie is `valMapFix()` plus `valMapReady()`, dat hem aanhaakt op `load`,
  `orientationchange`, `document.fonts.ready`, een `ResizeObserver` op
  `.mkv-map` — bewaard in `valMapRO`, want een observer zonder verwijzing is
  niet gegarandeerd blijvend — en twee natikkende timers. Daarnaast wordt er
  hermeten **vlak vóór elke `setView`**, in `updateValMap()` en in de
  invoerhandler van `#lfLocation`. `invalidateSize()` is goedkoop en
  idempotent; te vaak aanroepen kost niets, te weinig kost de kaart.

  **Maar nooit terwijl de kaart beweegt.** `invalidateSize()` midden in een
  zoomanimatie kan het ophalen van de tegels voor het nieuwe niveau afbreken;
  de kaart blijft dan staan op de uitvergrote tegels van het vorige niveau.
  Vandaar `valMapBusyUntil`: `zoomstart` en `movestart` zetten een grens ~1,2 s
  vooruit, `zoomend`/`moveend` halen hem weg en hermeten dan alsnog. De grens
  loopt vanzelf af, zodat een gemist eindsignaal de hermeting niet permanent
  blokkeert.

  Meetlat bij het testen: tel de tegels en lees de schaalbalk. Goed is, na het
  kiezen van een gebied, tegels op zoom 14 met de schaalbalk op 500 m en
  `.leaflet-tile-container` op `scale(1)`. Blijft het bij zoom 8, 30 km en een
  `scale(64)`, dan volgt de tegellaag de kaart niet.

## Een kaart meet je nooit in een verborgen tabblad

Op 28-08-2026 leek de kaart op de live pagina kapot: na het kiezen van een
gebied bleef hij op zoom 9 hangen, met de tegels van zoom 8 vierenzestig keer
uitvergroot. Dat was geen fout in de pagina maar in de meetopstelling. De
metingen liepen via een geautomatiseerd tabblad, en dat stond op de achtergrond:
`document.visibilityState` was `hidden`. Chrome draait dan geen
`requestAnimationFrame`, en Leaflet zet zijn hele geanimeerde zoom in een
`requestAnimFrame` — `setView()` keert dan meteen terug zonder iets te doen, er
komt geen enkel `zoomstart`/`zoomend`, en de tegellaag blijft staan waar hij
stond. Op een zichtbare pagina klopt alles.

Dus: controleer bij elke kaartmeting eerst `document.visibilityState`, en of
`requestAnimationFrame` daadwerkelijk vuurt. Een kaart die "niet zoomt" zonder
één enkel zoom-event is bijna altijd dit, en niet de code.
* `initValMaps()` wordt twee keer aangeroepen — direct, en nog eens zodra
  `ensureLeaflet` klaar is. De tweede mag de kaart niet opnieuw opbouwen:
  Leaflet gooit dan "Map container is already initialized" en alles achter die
  regel blijft liggen. Vandaar de `if(ldMap){ valMapFix(); return; }` bovenaan,
  en een `try/catch` om `mk()`.
* Het kaartvlak is `--map-land`, niet donkergroen, en `.mkv-mapview::before`
  zegt "Loading the map…". Laadt de kaart niet, dan staat daar een leesbare
  mededeling in plaats van een zwart venster — dat laatste leest als een
  storing van de hele pagina.
* Het aantal kolommen van `.mkv-grid.three` hangt af van de breedte van het
  **paneel**, niet van het venster. Drie kolommen alleen in de gestapelde
  opzet (`max-width:1099px`). Zet er geen `min-width:1240px`-regel terug: op
  een breed scherm is de linkerkolom nog steeds ~440px.
* `.mkv-rail` heeft onder 1100px `z-index:1200`, boven het gereedschap op de
  kaart (`z-index:1000`) uit, anders zweeft de gereedschapsbalk over de balk
  met het bedrag heen.

Bij dezelfde ingreep is de dode CSS van de vorige tool weggehaald: `.value`,
`.value-text`, `.value-form`, `.value-done`, `.vf-*`, `.vd-*`, `.value-toggle`
en `.vtab` hoorden bij de twee losse formulieren van vóór de adaptieve flow en
stonden nergens meer op een element.

### Na een upload ziet de eerste pagina er nog oud uit

`sw.js` bedient HTML stale-while-revalidate: de gecachte pagina schildert
meteen en de verse kopie wordt op de achtergrond opgehaald voor de volgende
keer. Bij het controleren van een verse upload is de eerste lading dus nog de
oude — herlaad één keer, of kijk in een privévenster. Dat is het ontwerp, geen
storing. `dashboard`, `list`, `checkout`, `auth` en de andere ingelogde
pagina's staan in `isPrivate()` en worden nooit bewaard; die zijn meteen vers.

## Het waarderingsmodel rekent in dalasi

Tot 27-08-2026 was de interne eenheid van `valuation.js` de euro, terwijl elke
waarneming die het model voedt in dalasi is gedaan. `LAND_OBSERVED` droeg per
gebied het waargenomen dalasibedrag én een `eur`-veld dat daaruit was afgeleid
door te delen door 85,74; het model rekende met dat afgeleide getal en de
weergave vermenigvuldigde weer met de koers van de dag. In
`valuation-selftest.mjs` stond twintig keer `3_500_000/EURGMD`.

Twee omrekeningen die elkaar hadden moeten opheffen, maar dat niet deden: de
rekenkoers stond vast op 85,74 en de weergavekoers liep mee. Zakte de dalasi
naar 90, dan steeg "de waargenomen mediaan in Fajara" met 5% zonder dat er in
Gambia iets was gebeurd. Nu staat de waarneming er zoals hij is waargenomen.

Wat er is omgezet, in één commit — half omzetten ís de fout:

* `LAND_OBSERVED` en `LAND_HALF`: `gmd` is het veld dat het model leest, `eur`
  is weg. `landRate()` levert `{gmd}` in plaats van `{eur}`.
* `BUILD_COST` en `BUILD_EXTRA`, tegen 85,74 en daarna afgerond (per m² op
  D500, vaste posten op D5.000). Grootste afrondafwijking 0,9% op `standard`.
* De terugvaltabel in `valuation-areas.js`, 183 tarieven, afgerond op drie
  significante cijfers; grootste afwijking 0,41%.
* De afrondstap van de band: was EUR 5.000/1.000/500, nu D500.000/100.000/50.000.
* De verbruikers: `sell.html` (`money()` gaat via `fromGMD()`), `list.html`
  (de `× CURRENCIES.EUR.gmdPer` in de prijshint is eruit), de prijs in de link
  van `sell.html` naar `list.html`, en `valuation-selftest.mjs`.

`PORTAL_RATE` blijft bewust euro: dat is een echte euromarkt, staat naast het
hoofdgetal en nooit erin. `sell.html` heeft daarvoor één `moneyEur()`, en dat
is de enige plek waar die grens de weergave raakt.

### Het vangnet, en waarom een volgende eenheidswijziging er weer een krijgt

`_werk/unit-harness-27-08-2026.mjs` draait het model over 104 gevallen — elk
type, elke bewijsklasse, met en zonder opstal, met en zonder de losse posten —
en schrijft alle bedragen weg. Vóór de wijziging als nulmeting, erna nog eens,
en `diff` eist dat elk bedrag gelijk is aan het oude maal de koers, binnen de
afrondmarge, met identiek vertrouwenslabel, band en herkomst. Uitkomst: 720
bedragen, geen afwijkingen.

Dat is de enige manier om deze klasse fout te vangen. Eén verbruiker die zijn
omrekening houdt geeft een factor 86 op het scherm van een verkoper, en geen
enkele bestaande test kijkt daarnaar: `valuation-selftest.mjs` meet
verhoudingen, en die zijn eenheidsvrij. Verandert er ooit weer een eenheid, dan
eerst dit vangnet.

### Een koerswijziging is geen herijking

De constanten zijn omgezet tegen 85,74 — de koers waarop de grondtarieven zijn
geijkt, niet de koers van vandaag. Daarmee blijft de ijkdatum kloppen bij de
getallen. Toevallig lag de CBG-koers op de dag van omzetten op 85,71, dus voor
de bezoeker verschoof er vrijwel niets. Was dit een half jaar later gebeurd,
dan waren de getallen zichtbaar verschoven zonder dat de markt was bewogen —
en dat had uitgelegd moeten worden.

`BUILD_COST` blijft afgeleid, niet waargenomen. Komt er een Gambiaanse offerte,
dan is dat blok nog steeds de enige plek die verandert; de omzetting hierboven
is een eenheid, geen herijking. Listings gaan die herijking overigens niet
brengen: een listing geeft grond plus opstal in één bedrag, en de opstal
eruit halen is precies de aanname die je wilde toetsen.


---

## Listing-flow en bewijsladder — 28-08-2026

De aanmeldwizard en de listing-detailpagina zijn herzien voor vier doelgroepen:
particuliere verkoop en verhuur, en professionele verkoop en verhuur namens
derden. De as die dat draagt bestond al (`S.deal` maal `S.who` in `list.html`);
wat erbij is gekomen is diepte, en het zichtbaar maken van bewijs.

### Regels die hieruit volgen

- **Geen verzonnen kenmerken meer op `property.html`.** Twee blokken vulden
  zichzelf met vaste tekst als er te weinig echte gegevens waren: de
  Floor plan-tab (een gegenereerde plattegrond met vaste kamermaten op elke
  listing) en de terugvallijst in `buildFeatures` (met onder meer "Verified
  title deed" en "Clear of encumbrances" op panden die niemand had gecontroleerd).
  Beide zijn weg. De Floor plan-tab verschijnt alleen bij een echt geüploade
  plattegrond (`P.floorplan_url`); een dunne listing leest voortaan als dun, en
  het blok "What we have not checked" zegt met zoveel woorden wat ontbreekt.
  **Zet er nooit een standaardlijst voor terug.**
- **`listings.evidence_level` is afgeleid, nooit met de hand gezet.** Hij wordt
  berekend door `refresh_evidence_level()`, aangeroepen door een trigger op
  `listing_evidence`. 0 = verklaring, 1 = stukken geüpload, 2 = bureaucontrole,
  3 = kadastercontrole. Alleen trede 3 mag de Verified-badge dragen.
- **Een verkoper kan zijn eigen bewijs niet promoveren.** `listing_evidence_guard()`
  zet status, `checked_at`, `checked_by`, `checked_label` en `internal_note`
  terug voor iedereen die geen admin is. Hetzelfde geldt voor `agencies`:
  `agencies_guard_verification()` beschermt `verified_at` en de licentievelden.
- **De publieke bewijsladder loopt via `listing_evidence_public(uuid)`**, niet
  via een select op de tabel. Die functie geeft bewust geen `media_id`,
  `doc_sha256` of `internal_note` terug. `listing_evidence` heeft geen publieke
  select-policy; dat is geen omissie.
- **`listing_plot_claims` is een opsporingsmiddel, geen etalage.** Alleen admin
  leest hem; `plot_claim_overlaps()` draait achter `is_admin()`. De claim wordt
  bij elke publicatie weggeschreven, ook al draait de detectie nog niet:
  wachten met vullen kost een jaar aan gegevens.
- **`price_currency` blijft alleen GMD.** De invoervaluta staat in
  `price_input_amount` / `price_input_currency` / `fx_rate_used` / `fx_as_at`
  ernaast. De koers komt van `fx-rates`, nooit uit de pagina zelf. De
  constraint op `price_currency` is niet verbreed en moet dat ook niet worden.
- **Kolommen zijn hergebruikt waar dat kon.** `road`, `fencing`, `security`,
  `water`, `land_water`, `power` en `electricity` dekken al wat ze dekken; er
  is geen tweede kolom voor hetzelfde feit bijgemaakt. Nieuwe kolommen bestaan
  alleen waar er nog geen veld voor was (metertype, watertank, septic, kWp/kVA,
  perceelmaten, afstand tot de tarmac, TDA, Alkalo, leasejaren, registratie).
- **`GAMBIA_COLS` is de tweede kolomprobe in `list.html`**, naast `EXTRA_COLS`.
  Komt er weer een reeks nieuwe kolommen bij, zet die dan in dezelfde probe of
  maak een derde — nooit een save die faalt op een onbekende kolom.
- **Nummerverificatie loopt omgekeerd, en dat is de kern.** Wij sturen géén code
  naar een ingetypt nummer: de verkoper stuurt ons een code die op zijn scherm
  staat (`MYKUNDA-XXXXXXXX`), `wa-inbound` herkent hem en vult het nummer in met
  het afzendernummer dat van Meta komt. Twee gevolgen: er is **geen goedgekeurde
  Meta-template nodig** (die is alleen verplicht als het bedrijf het gesprek
  begint), en het nummer is bewezen in plaats van geloofd. Inkomende berichten
  kosten bovendien niets.
- **`wa-verify` is een zachte drempel.** Ontbreekt `WA_BUSINESS_NUMBER`, dan
  antwoordt hij 503 en blijft het blok in de wizard verborgen — geen knop die
  niet kan werken. De function staat op `verify_jwt:false` zoals de rest, maar
  de poort die telt is de `getUser()`-check erin: de anon-sleutel is openbaar en
  zou anders genoeg zijn om hem leeg te trekken.
- **Codes zijn 8 tekens uit een alfabet zonder O/0/I/1** (32^8, circa 10^12).
  Ze staan gehasht in `phone_verifications`; die tabel heeft bewust geen
  policies, alleen `wa-verify` en `wa-inbound` (service role) komen erbij.
- **`wa-inbound` verwerkt nu ook verificatieberichten** en maakt daar géén lead
  van. Alles wat niet op `MYKUNDA-XXXXXXXX` lijkt valt ongemoeid door naar het
  bestaande leadpad.
- **Webhook-handtekening.** `wa-inbound` accepteerde tot 28-08-2026 elke POST van
  wie dan ook — iedereen die de URL kent kon een lead injecteren. Nu er
  verificatie aan hangt weegt dat zwaarder. Zet `WA_APP_SECRET` (Meta → App →
  Settings → Basic → App Secret) en de `x-hub-signature-256` wordt hard
  gecontroleerd. Zonder die secret gedraagt de function zich exact als
  voorheen, dus het zetten van de secret is de enige stap.
- **De Supabase-CLI werkt niet via `npx` op deze machine** (28-08-2026): er zit
  een schil tussen die alleen `npm notice run supabase …` afdrukt en met code 0
  stopt zonder iets te doen — ook bij `projects list`. Uitrollen dus via de
  Supabase-MCP, via het dashboard, of met een echte CLI-installatie.
- **Verplicht om te publiceren** is sinds nu: vier foto's, een beschrijving van
  minstens 40 tekens, een documenttype bij verkoop, en bij customary land de
  naam van de Alkalo en het dorp. Het document zelf is níét verplicht — trede 0
  en 1 van de ladder bestaan juist omdat een verkoper zijn papieren nog niet
  hoeft te hebben. Dat is een bewuste keuze, geen gat.

### Wizard: vijf stappen uit dezelfde secties

`TRACK_STEPS` bevat sinds 28-08-2026 groepen in plaats van losse sleutels. Een
stap toont meerdere `.step`-secties tegelijk; secties na de eerste krijgen
`.sub` (kop een niveau lager, eyebrow verborgen). Er is geen HTML verplaatst.
`validate(n)` loopt de sleutels van de groep af via `validateKey(k)`.
De review telt niet mee in "Step N of 5".

## Communicatie: wat er wanneer uitgaat — 30-08-2026

Op 30 augustus is elk communicatiemoment op de site nagelopen: negen
leadformulieren, het berichtencentrum, de bezichtigingen, de advertentieflow,
de betaalketen, de auth-mails en WhatsApp. Onderstaande regels volgen daaruit.
Het volledige testplan (138 gevallen) staat als artifact "Communicatie-audit
MyKunda".

### De levensloop van een advertentie mailt nu wél

`createListing()` en `submitForReview()` zetten **elke** advertentie op
`pending_review`, en de select-policy op `listings` toont alleen `active` en
`under_offer` aan het publiek. Een nieuwe advertentie staat dus **niet** live.

De bevestigingsmail zei bij een gratis plan letterlijk "Your listing is live and
buyers can find it right now", en daarna hoorde de verkoper nooit meer iets —
er ging geen mail uit bij goedkeuring, afwijzing of uit de lucht halen. Beide
gerepareerd:

- `listingConfirmationEmail` zegt nu "with our team for a quick check".
- `listingBackofficeEmail` heet "New listing awaiting review" (stond op "New
  listing published", tegen de eigen ⚡-onderwerpregel in).
- Nieuw: **`notify-listing-status`**, aangeroepen door de trigger
  `listings_notify_status` → `notify_listing_status_change()`. Drie statussen
  mailen: `active` ("your listing is live"), `rejected` ("we need a bit more",
  met `listings.review_note` erin) en `archived`. Bewust niet: `sold`, `let` en
  `under_offer` — die zet de verkoper zelf.
- **`listings.review_note`** is de reden die bij een afwijzing letterlijk in de
  mail van de verkoper komt. Schrijf hem dus voor de verkoper, niet voor de
  backoffice.
- Elke overgang mailt hooguit één keer. Dat dwingt de unieke index
  `email_events_listing_status_once` af, sinds 30-08-2026 op
  `(payload->>'listing_id', payload->>'status', coalesce(payload->>'reason',''))`,
  met de claim-eerst-constructie van `notify-fulfilment`. Heen en weer zetten
  levert dus geen tweede mail op — maar een tweede afwijzing met een **andere**
  reden wél, want dat is een ander bericht.
- Afkeuren in `admin.html` **vraagt** sinds 30-08-2026 een reden van minstens
  tien tekens. Die gaat in één update mee met de status (de trigger leest
  `new.review_note` op het moment van de wissel) en komt op twee plekken terug:
  in de afwijzingsmail en woordelijk boven de advertentie in het dashboard van
  de aanbieder. `submitForReview()` maakt `review_note` weer leeg bij
  herindienen — een reden hoort bij één ronde.

Er is **geen** verloopmechanisme voor advertenties, en dat is geen omissie: de
site belooft nergens een looptijd. Wat wél een looptijd heeft is
`listings.boosted_until` (Boost, 30 dagen) en `verified_until` (Verified, 180
dagen). Daar gaat sinds 30-08-2026 wél post over — zie `notify-plan-expiry`.

### Boost was tot 30-08-2026 een aankoop zonder gevolg

`apply_paid_plan()` zette `boosted_until` netjes, maar **niets op de site las
die kolom**: de sorteeroptie "Featured" (de standaard!) had geen enkele regel,
en `fetchFeaturedListings()` keek er niet naar. Wie D2.500 betaalde voor "top of
search results and featured on the homepage" kreeg letterlijk niets. Nu wel:
`mkIsBoosted()` in `app.js` is de enige bron voor "loopt er nu een Boost",
`filtered()` in `search.html` sorteert er als eerste op, en
`fetchFeaturedListings()` haalt de gebooste advertenties in een aparte query op
zodat ze niet buiten de nieuwste vier vallen.

Let op de andere kant hiervan: het Verified-vinkje (`is_verified_title`) gaat er
**niet** vanzelf af als `verified_until` verstrijkt — dat zet een medewerker met
de hand via admin.html. Schrijf dus nergens dat het vinkje verdwijnt.

### De professionele back-office (fase 5, 30-08-2026)

Voor `role = agent` of `admin` krijgt het dashboard vier weergaven erbij:
Portfolio, Leads, Viewings en Statistics. Een particuliere aanbieder houdt zijn
overzicht — de rol bepaalt wat je erbij krijgt, nooit wat je verliest.

Twee dingen lagen klaar en waren nergens op aangesloten:

- **De leadpijplijn.** `leads.stage` kent zeven fases en `assigned_to` bestond,
  maar geen scherm gebruikte ze en de eigenaar mócht ze niet aanraken: de enige
  updateregel was `is_admin() OR auth.uid() = assigned_to`. Er is nu een regel
  `leads owner update` bij, plus de kolommen `note` en `lost_reason`. De
  tabelbrede UPDATE (op alle zeventien kolommen, ook voor `anon`) is ingetrokken
  en vervangen door een kolomrecht op vijf kolommen: een aanbieder zet de fase
  en zijn eigen aantekeningen, en kan de naam of het bericht van de aanvrager
  niet herschrijven.
- **De bezoekcijfers.** `bump_listing_views()` schreef bij elke objectpagina een
  rij, en `rollup_listing_views()` telde die op bij `listings.views` — maar die
  rollup stond in **geen enkele cron-taak**. Hij heeft dus nooit gedraaid en
  elke "0 views" in het dashboard was onwaar in plaats van leeg. Nu draait hij
  om 02:10, en hij bewaart voortaan dagtotalen in de nieuwe tabel
  `listing_view_days` (`listing_views` is de ruwe buffer van één dag, die tabel
  is het geheugen). Zonder dat had een aanbieder alleen een totaal en nooit een
  verloop.

De reactietijd is `leads.contacted_at` tegenover `created_at`, en wordt gestempeld
op het moment dat een lead voor het eerst uit `new` gaat. Getoond als **mediaan**,
niet als gemiddelde, en alleen als er iets te meten valt — anders staat er een
streepje. Geen geschatte conversie, geen trend uit twee datapunten: staat er
niets in de database, dan staat er niets op het scherm.

### Poorten op de notify-functies

| functie | poort |
| --- | --- |
| `notify-payment`, `notify-fulfilment`, `notify-listing-status` | `x-notify-key` = `NOTIFY_SHARED_KEY` (staat in de kluis als `notify_shared_key`, de triggers lezen hem daaruit) |
| `notify-saved-search`, `notify-plan-expiry` | `x-notify-key`; gewekt door pg_cron via `run_saved_search_alerts()` (08:00) en `run_plan_expiry_notices()` (08:30), die de sleutel uit de kluis halen. Allebei ondersteunen `{"dry_run":true}` |
| `notify-listing` | `x-notify-key`, óf een ingelogde gebruiker die eigenaar is van de listing |
| `wa-notify` | `x-notify-key` verplicht — zonder secret weigert hij **alles** |
| `wa-inbound` | `WA_APP_SECRET` verplicht (handtekening) en `WA_VERIFY_TOKEN` verplicht (geen terugval meer) |
| `notify-lead` | open, maar met dedupe op `notified_at` en drie auto-replies per adres per uur |

De wekkers zelf (`run_mail_health_check`, `run_saved_search_alerts`,
`run_plan_expiry_notices`, `rollup_listing_views`) zijn sinds 30-08-2026
dichtgezet voor `anon` en `authenticated`: ze zijn SECURITY DEFINER en stonden
via `/rest/v1/rpc/<naam>` voor iedereen open — gevonden met de Supabase security
advisor. Zet ze niet terug open, en let op dat intrekken bij die twee rollen
**niet** genoeg is: Postgres geeft een nieuwe functie EXECUTE aan `PUBLIC`, en
daar erven ze het van. Revoke dus altijd ook van `public`. Nieuwe cron-wekkers
krijgen dezelfde behandeling; `bump_listing_views()` en `price_history_public()`
blijven met opzet open, want die roept de site zelf aan.

`notify-listing` haalt het ontvangstadres uit de **database**, nooit uit de
payload. `listing_data` mag de mail alleen verrijken. Zet die regel niet terug:
met een adres uit de payload is dit endpoint een mailrelay op ons eigen
geverifieerde domein.

Roep `notify-listing` vanuit de browser aan met `sb.functions.invoke(...)`, niet
met een losse `fetch` en de anon-sleutel — die levert geen gebruiker op en komt
dus niet langs de poort.

### Wat er nooit meer een knop mag krijgen

Bezichtigingen, advertentiestatus en betalingen zijn transactioneel. De enige
opt-out is `profiles.notify_messages` (berichtmeldingen). Op het dashboard
stonden vier schakelaars, een kanaalkeuze en een WhatsApp-nummerveld waarvan er
precies één iets bewaarde; de rest is weg. Zet er niets terug wat niet
daadwerkelijk wordt opgeslagen — dat geldt ook voor de knop "Save search" op
`search.html`, die tot 30-08-2026 "Search saved" toonde zonder iets op te slaan
en nu echt naar `saved_searches` schrijft.

### info@mykunda.com werkt wél — voor mensen

De bounce van 14-08-2026 gold voor mail van **Amazon SES/Resend** naar info@
(Cloud86-blocklist). Gemeten op 30-08-2026: een gewone mail vanaf Gmail naar
info@mykunda.com komt zonder bounce aan. Dus:

- interne meldingen blijven naar `admin@mykunda.com` — die route loopt via
  Resend en is de route die bounct;
- `info@mykunda.com` mag gewoon in de voettekst en op de site blijven staan als
  contactadres voor klanten.

Test dit opnieuw voordat je een van beide verandert; gis er niet over.

### Twee dingen die nog niets versturen

- **Area alerts.** 47 pagina's schrijven `area_alert`-leads weg en de
  auto-reply zegt "Your area alert is set up". Er is geen enkele functie of
  cron die die alerts daadwerkelijk verstuurt. De belofte klopt letterlijk (hij
  ís ingesteld), maar er komt nog niets.
- **Het rapport bij een titelcontrole.** De `report_sent`-mail zegt "It comes as
  a separate email". Geen enkele edge function verstuurt bijlagen; dat rapport
  gaat met de hand. Zet `fulfilment_status` dus pas op `report_sent` **nadat**
  je het rapport hebt gemaild, anders stuur je de klant zijn spamfolder in voor
  iets dat nog niet bestaat.

### Tweede ronde, 30-08-2026: de laatste elf

**Eén bron voor de bankrekening.** `supabase/functions/_shared/bank.ts`.
`create-payment`, `send-payment-instructions` en het (latente) bankblok in
`paymentReceiptEmail` lezen daar allemaal uit. Wijzigt de rekening, dan
wijzig je dat ene bestand en rol je `create-payment` én
`send-payment-instructions` opnieuw uit. Zet nooit weer losse waarden in een
functie — er is geschiedenis met Ecobank, en een klant die naar het
verkeerde nummer overmaakt is niet met een deploy te helpen.

**Gereserveerde testdomeinen.** `isReservedTestAddress()` staat in
`_shared/email-template.ts` en zit in élke verzender. Test met
`delivered@resend.dev` of `bounced@resend.dev`, nooit met een `.invalid`- of
`.test`-adres: die blijven veertien uur bij Amazon SES hangen en worden
daarna als bounce op de reputatie van mykunda.com geboekt.

**`profiles.email_bounced_at`.** Gezet door `resend-webhook` bij een harde
bounce of een spamklacht. `auth-email` leest hem en zegt dan dat er niets
aankomt, in plaats van "we hebben een code gestuurd" te tonen bij een adres
dat op de suppressielijst staat. Maak hem leeg zodra iemand een werkend
adres heeft, anders blijft die persoon buiten.

**De herinnering stempelt zichzelf.** `run_viewing_reminders()` zet
`reminded_24h_at` / `reminded_2h_at` niet meer vooraf;
`notify-viewing-reminder` doet dat na een geslaagde verzending. Een mislukte
herinnering wordt daardoor binnen het venster vanzelf opnieuw geprobeerd.
Zet dat stempelen niet terug in de cron.

**Transactionele post heeft geen knop.** De opt-out
`profiles.notify_messages` geldt alleen voor chatberichten. De
bezichtigingsherinnering luistert er sinds deze ronde niet meer naar: wie
een afspraak heeft bevestigd, hoort te weten dat hij morgen ergens wordt
verwacht. Wil hij er vanaf, dan zegt hij de afspraak af.

**`notify-health` en de dagelijkse controle.** Elke ochtend om 07:30 UTC
kijkt `run_mail_health_check()` wat er in 24 uur is misgegaan — mislukte
verzendingen, bounces, leads met `notify_error`, accounts met
`email_bounced_at` — en mailt dat één keer. Staat er niets in, dan gaat er
niets uit; dat is met opzet. Dit is het vangnet onder alle `pg_net`-triggers,
die hun eigen antwoord nooit lezen.

**Twee wegen naar een bezichtiging.** `propose_viewing()` vraagt om een
conversatie en dus om een account. Is de bezoeker ingelogd, dan loopt zijn
aanvraag via `requestViewingAsUser()` door de echte keten (`viewings`, met
bevestiging, afwijzing, annulering en herinneringen). Is hij dat niet, dan
blijft het `viewings_legacy_v0` plus een lead. Inloggen verplicht stellen op
het moment van hoogste koopintentie is bewust niet gedaan.

**Anti-spam.** `mkFormGuard()` in `app.js` hangt zichzelf aan élk `<form>`:
een honeypot (`mk_hp_website`, absoluut uit beeld, niet `display:none`) en
een ondergrens van twee seconden na het laden. Je hoeft per formulier niets
te doen, ook niet bij een nieuw formulier. Een gevulde honeypot wordt stil
genegeerd; te snel verzenden krijgt wél een melding, want dat kan een mens
zijn.

**De eigendomscheck legt zijn aanvraag vast vóór de betaling.**
`verify.html` schrijft nu een `verification`-lead bij het intakeformulier.
Wie afhaakt op het betaalscherm is daarmee opvolgbaar in plaats van
spoorloos. De lead mag nooit blokkeren: lukt hij niet, dan gaat de bezoeker
gewoon door naar de betaling.

**`lead_source` bevat `agent_partner`.** Die waarde ontbrak, terwijl
`agent.html` hem al schreef — het aanmeldformulier voor partnermakelaars
sloeg dus niets op en toonde het terugvalpaneel. Voeg je een nieuwe
leadbron toe in de front-end, voeg hem dan in dezelfde wijziging toe aan de
enum én aan `TEAM_LABEL`/`REPLY_SUBJECT` in `notify-lead`.

**Wat bewust NIET is gebouwd.** Een uitschrijflink op transactionele mail
(een bon of een bevestiging van je eigen afspraak hoort er geen te hebben;
alleen een echte stroom als de area-alerts heeft `List-Unsubscribe` nodig,
en die verstuurt nog niets). En een pad om je e-mailadres te wijzigen —
dat bestaat nergens op de site, dus er valt ook niets terug op de mailer van
Supabase; het is een ontbrekende functie, geen defect.

## Derde ronde, 30-08-2026: de wizard op een telefoon

Reis 2 van de testronde, met de browser op `list.html` en één echte
advertentie helemaal door de keten. Vijf regels die hieruit volgen.

**Een afgekeurde stap moet zeggen wát er ontbreekt.** `shake()` en `flash()`
deden alleen een animatie van 0,4 seconde en een rode rand van 1,5 seconde.
Beide nemen nu een tweede argument: de zin die de gebruiker leest. Die komt
in `#wizMsg` (`role="alert"`, `aria-live="assertive"`), en dat element wordt
vlak boven het veld gehangen dat bezwaar maakt, waarna `wizFocus()` regel en
veld samen in beeld brengt. Voeg je een validatieregel toe aan
`validateKey()`, geef hem dan een zin mee. Zonder tekst is de afkeuring op
een telefoon onzichtbaar: gemeten stond de knop Continue op y=1959 en het
bezwaar op y=992, en de pagina scrolde er niet heen.

**Geen `alert()` meer in de site.** Er staat er geen enkele meer in
`list.html`. Een fout die de gebruiker moet lezen gaat via `wizSay()` of via
het bestaande terugvalpaneel van de leadformulieren.

**Meet een nieuw scherm altijd op 375 pixels.** De wizard had een
grid-blowout: `.stepwrap` was een grid-item met `min-width:auto` en weigerde
te krimpen, waardoor `document.scrollWidth` 419 werd tegen een `clientWidth`
van 375. Controleer bij elke nieuwe pagina of `scrollWidth === clientWidth`
op 375px. Let op de volgorde van de media queries in `list.html`: de
520px-query staat bewust ná de 900px-query, anders wint die laatste met
dezelfde specificiteit.

**Verwijder de foto's vóór de advertentierij.** Het verwijderbeleid op
`listing-photos` en `listing-docs` eist een `EXISTS` op `listings` met
dezelfde mapnaam, en `is_admin()` staat bínnen die EXISTS. Verdwijnt de rij
eerst, dan kan niemand de bestanden nog weg krijgen: de Storage API
antwoordt `0 verwijderd` zónder fout, en `storage.objects` weigert een
directe SQL-delete. Migratie `20260830_07` voegt een admin-ontsnappingsluik
toe dat niet van de advertentierij afhangt, plus `on delete cascade` op
`listing_media`. Houd de volgorde toch aan: eerst storage, dan de rij.

**En één correctie op de tweede ronde.** De honeypot uit `mkFormGuard()`
hangt aan elk `<form>`-element — dat zijn de negen leadformulieren.
`list.html`, `auth.html`, `checkout.html` en `messages.html` hebben geen
`<form>` en vallen er dus buiten. Dat mag: die schrijven niet naar `leads`,
en `listings` eist volgens de RLS-regel `auth.uid() = owner_id`. Schrijf
niet dat "elk formulier" is afgedekt.

**Werkomgeving.** PowerShell's `Add-Content` en een exclusieve
`[System.IO.File]::Open(...,'None')` mislukken op deze map met "wordt
gebruikt door een ander proces", ook voor bestanden die niemand open heeft.
Dat is de mount, geen vergrendeling. Bewerk bestanden hier met `edit_block`
of `write_file`, niet met `Add-Content`.

## Intl in de Supabase edge runtime groepeert geen cijfers

Gemeten 31-08-2026: `(20000).toLocaleString('en-US')` geeft in een edge function
gewoon `"20000"` terug. Datums opmaken werkt daar wél. Elke prijs in een mail kwam
dus zonder scheidingsteken bij de klant aan.

Gebruik in `supabase/functions/**` daarom **nooit** `toLocaleString` voor een getal.
Er staat één helper klaar: `nummer(waarde, decimalen)` in
`_shared/email-template.ts`. In de browser mag `toLocaleString` gewoon.

## Plan-id's staan op twee plekken in mensentaal

`listing_plans` heet in de database `boost_30`, `doc_check`, `ownership_check`,
`verified_s|m|l`. `checkout.html` gebruikt eigen sleutels (`boost`, `verified`,
`ownership-standard`, `ownership-full`) en vertaalt vóór het versturen. Alles wat
een betaling terugleest krijgt dus het SERVERid te zien:

- `betaling-status.html` → `PLAN_INFO` (naam + de checkout-sleutel voor "Try again")
- `dashboard.html` → `PLAN_WORDS` (naam in de facturentabel)

Verandert `listing_plans`, dan horen die twee tabellen mee. Staat een id er niet in,
dan valt de pagina terug op het kale id en leest de klant een databasesleutel.

## Wat een klant na een betaling ziet

`fetchMyPayments()` hoort voor ELKE rol te draaien, niet alleen voor agent/admin.
De koperproducten (Document Check, Ownership Check) worden per definitie door een
zoeker gekocht; die zag tot 31-08-2026 nooit een bestelling in zijn dashboard,
terwijl de bon wel naar My MyKunda verwijst. De leesregel op `payments` scoopt op
`user_id`, dus er lekt niets.

Bon, betaalinstructies en terugbetaalmail wijzen naar
`betaling-status.html?ref=<referentie>` — niet naar `dashboard.html`. Daar staat de
stand van de betaling en, bij een titelcontrole, de voortgang van het werk.

## Het mailalarm bewijzen (alarmproef)

`notify-health` mailt alleen als er iets mis is. Stilte is dus dubbelzinnig: het
betekent "niets aan de hand" óf "het alarm werkt niet". Bewezen op 31-08-2026 dat
het werkt; herhaal deze proef na elke wijziging aan de mailketen.

1. Kunstmatige fout invoeren:
   `insert into email_events (event_type, recipient, subject, reason, payload)
    values ('payment_receipt','alarmproef@mykunda.com','TEST — alarmproef','Kunstmatige fout','{"ok": false, "alarmproef": true}'::jsonb);`
2. De echte productieroute afvuren: `select public.run_mail_health_check();`
   (niet de function met curl aanroepen — deze weg bewijst óók dat de sleutel uit
   de kluis komt en dat pg_net de function bereikt)
3. Na ~20 seconden controleren in Resend: mail aan admin@mykunda.com met onderwerp
   `[MyKunda] N mail issue(s) in the past 24 hours`, status `delivered`.
   De backoffice-mailbox is niet vanuit deze omgeving te lezen; de bezorgstatus in
   Resend is het bewijs.
4. Opruimen: `delete from email_events where payload->>'alarmproef' = 'true';`
5. Nog één keer `run_mail_health_check()` en controleren dat er GEEN mail komt.
   Die tweede helft is het punt: een alarm dat niet meer stil kan worden, leert je
   het te negeren.

Let op: `notify-health` schrijft zijn eigen verzending NIET naar `email_events`.
Mislukt de alarmmail zelf, dan legt niets dat vast — Resend is dan de enige bron.

De vierde controle (accounts met `profiles.email_bounced_at`) heeft geen
tijdvenster. Eén geblokkeerd account laat het alarm dus elke dag afgaan tot iemand
die kolom leegmaakt. Dat is met opzet, maar weet het voordat je je afvraagt waarom
de mail blijft komen.
