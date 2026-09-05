import { readFileSync, writeFileSync } from 'node:fs';
const P = 'CLAUDE.md';
let t = readFileSync(P, 'utf8');
if (t.includes('### De Land-pagina staat sinds 05-09-2026 weer in de lucht')) { console.log('stond er al'); process.exit(0); }
const E = (t.match(/\r\n/g) || []).length > 100 ? '\r\n' : '\n';
const anker = '### Links vanaf de zustersites';
if (!t.includes(anker)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const blok = [
'### De Land-pagina staat sinds 05-09-2026 weer in de lucht',
'',
'`land-for-sale-in-the-gambia.html` was op 29-08-2026 met commit `e61883e` ingetrokken,',
'dezelfde dag als de opbouw. Search Console laat sindsdien zien dat grond met 72',
'vertoningen de grootste commerciele zoekvraag is die de site bereikt en dat er geen',
'enkele pagina voor was: "land for sale in gambia" 30 vertoningen op positie 42,2,',
'"buying land in gambia" 17 op 50,6, "gambia land" 13 op 42,8 - alle drie nul klikken.',
'',
'Het herstel is een **chirurgische terugdraai** van de vier inhoudelijke delen van die',
'commit, met alles wat er sinds 29-08 bij is gekomen ongemoeid: de pagina zelf uit',
'`f39f08e`, de 301 uit `.htaccess`, de verwijzing in de voettekst, het 103-regelige',
'patch-blok in `build-area-prices.mjs`, de sitemapregel en `sw.js`. Script:',
'`_werk/herstel-landpagina.mjs` (idempotent, draait ook met `--droog`).',
'',
'**Niet in de kopnavigatie.** Daar staat sinds 29-08 `Commercial` op de plek van `Land`;',
'acht menu-items in plaats van zeven is een ontwerpvraag, geen herstelvraag. De pagina',
'hangt aan de voettekst (elke pagina), aan de prijsindex en aan de gebiedspagina\'s.',
'',
'**Interne links.** De pagina had alleen de voettekst plus de prijsindex.',
'`build-area-prices.mjs` zet nu in het prijsblok van elke gebiedspagina een regel naar',
'de Land-pagina, wat 53 contextuele links oplevert vanaf topisch relevante pagina\'s. Een',
'sitemap laat Google een pagina vinden; links geven hem gewicht.',
'',
'Controleren: `node _werk/check-landpagina.mjs` (bron of `deploy`) en, na een upload,',
'`node _werk/check-landpagina-live.mjs` vanaf je eigen pc. Op 05-09 waren dat 21 van 21',
'en 12 van 12 goed.',
'',
'Effectmeting: de afspraak van 29-08-2026 staat - geen uitspraak vóór eind november 2026.',
'',
'### De eerlijkheidsalinea liep uit de pas met de generator',
'',
'Los hiervan bleek `build-area-prices.mjs` nog "every **verified** sale" te schrijven,',
'terwijl commit `3478e19` van 03-09 dat op alle 52 gebiedspagina\'s bewust naar "every',
'**reported** sale" had gezet - de ronde waarin de teksten zijn gelijkgetrokken met wat',
'MyKunda echt is. De generator en de pagina\'s liepen dus uit elkaar, en de eerstvolgende',
'prijsronde zou die correctie stil hebben teruggedraaid. De generator zegt nu ook',
'"reported sale". Les: een tekst die de generator schrijft, corrigeer je in de generator',
'en niet in de pagina - anders komt hij terug.',
'',
anker
].join(E);
t = t.replace(anker, blok);
writeFileSync(P, t);
console.log('CLAUDE.md: Land-hoofdstuk toegevoegd');
