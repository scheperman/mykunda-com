/* 05-09-2026: de Land-pagina terugzetten. Zij is op 29-08-2026 met commit e61883e
   ingetrokken; Search Console laat sindsdien zien dat grond met 72 vertoningen de
   grootste commerciele zoekvraag is die de site bereikt en dat er geen enkele pagina
   voor is. Dit script draait de vier inhoudelijke delen van die commit terug - de
   pagina zelf, de 301, de navigatie en het generatorblok - en laat alles wat er sinds
   29-08 is bijgekomen ongemoeid. Idempotent. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const zeg = [];
const V = process.argv.includes('--droog');
const schrijf = (p, s) => { if (V) zeg.push('[droog] ' + p); else { writeFileSync(p, s); zeg.push('geschreven: ' + p); } };

/* ---- 1. de pagina zelf, uit de laatste commit waarin zij bestond ---- */
const DOEL = 'land-for-sale-in-the-gambia.html';
if (existsSync(DOEL)) zeg.push('pagina stond er al');
else {
  let h = execSync('git show f39f08e:' + DOEL, { encoding: 'utf8', maxBuffer: 1 << 26 });
  /* Twee preloads wijzen naar lettertypen die sinds de designronde niet meer bestaan.
     Een preload naar een 404 kost een verzoek en levert niets. */
  const voor = h.length;
  h = h.replace(/[ \t]*<link rel="preload" href="fonts\/(?:hanken-grotesk|source-serif-4)-var-latin\.woff2"[^>]*>\n?/g, '');
  zeg.push('dode font-preloads verwijderd: ' + (voor !== h.length ? 'ja' : 'geen gevonden'));
  schrijf(DOEL, h);
}

/* ---- 2. de 301 uit .htaccess ---- */
{
  const p = '.htaccess';
  let t = readFileSync(p, 'utf8');
  const blok = t.match(/\r?\n# De grondpagina is op 29-08-2026 ingetrokken\.[\s\S]*?RewriteRule \^land-for-sale-in-the-gambia\(\\\.html\)\?\$ \/gambia-property-prices\.html \[R=301,L\]\r?\n/);
  if (!blok) zeg.push('.htaccess: de 301 stond er niet meer');
  else schrijf(p, t.replace(blok[0], '\n'));
}

/* ---- 3. navigatie en voettekst in app.js ---- */
{
  const p = 'app.js';
  let t = readFileSync(p, 'utf8');
  /* Het menu is sinds 29-08 veranderd: 'Land' is er toen uit gegaan en 'Commercial'
     is erbij gekomen. De koptekst raken we hier niet aan - acht items in plaats van
     zeven is een ontwerpvraag, geen herstelvraag. Wat wel meteen kan: de voettekst,
     want die staat statisch op elke pagina en is daarmee de sterkste interne link
     die zonder JavaScript te crawlen valt. */
  let n = 0;
  const ftOud = "'Commercial to let','Area guides'";
  const ftNieuw = "'Commercial to let','Land for sale','Area guides'";
  if (t.includes(ftOud)) { t = t.replace(ftOud, ftNieuw); n++; }
  const mapOud = "'Commercial to let':'search.html?seg=commercial&type=rent',";
  const mapNieuw = "'Commercial to let':'search.html?seg=commercial&type=rent','Land for sale':'land-for-sale-in-the-gambia.html',";
  if (t.includes(mapOud) && !t.includes("'Land for sale':")) { t = t.replace(mapOud, mapNieuw); n++; }
  if (n === 2) schrijf(p, t);
  else if (t.includes("'Land for sale':")) zeg.push('app.js: voettekst stond al goed');
  else { console.error('app.js: anker niet gevonden (' + n + ' van 2) - NIETS gewijzigd'); process.exit(1); }
}

/* ---- 4. het generatorblok in build-area-prices.mjs ---- */
{
  const p = 'build-area-prices.mjs';
  let t = readFileSync(p, 'utf8');
  if (t.includes("await patch('land-for-sale-in-the-gambia.html'")) zeg.push('build-area-prices.mjs: blok stond er al');
  else {
    const plaatshouder = `/* De grondpagina is op 29-08-2026 ingetrokken; het patch-blok dat hier zijn tabel
   en FAQ bijwerkte is daarmee vervallen. De kavelcijfers staan in
   gambia-property-prices.html, dat hierboven wel wordt bijgewerkt. */`;
    if (!t.includes(plaatshouder)) { console.error('build-area-prices.mjs: plaatshouder niet gevonden - NIETS gewijzigd'); process.exit(1); }
    const blok = execSync('git show f39f08e:build-area-prices.mjs', { encoding: 'utf8', maxBuffer: 1 << 26 });
    const start = blok.indexOf('/* de grondpagina: dezelfde tabel, maar dan voor kavels */');
    const eind = blok.indexOf("/* objectpagina: het buurtblok onder de listing */");
    if (start < 0 || eind < 0 || eind < start) { console.error('blok niet uit de git-versie te knippen'); process.exit(1); }
    t = t.replace(plaatshouder, blok.slice(start, eind).trimEnd());
    /* de verwijzing op de prijsindexpagina weer naar de grondpagina */
    t = t.replace("'For bare plots specifically, see the <a href=\"search.html?type=sale&amp;cat=land\">plots for sale</a>.</p>';",
      "'For bare plots specifically, see <a href=\"land-for-sale-in-the-gambia.html\">land for sale in The Gambia</a>.</p>';");
    /* en de pagina weer in de lijst die de aantallen bijwerkt */
    t = t.replace("'buy.html', 'rent.html',\n", "'buy.html', 'rent.html', 'land-for-sale-in-the-gambia.html',\n");
    schrijf(p, t);
  }
}

/* ---- 5. de opmerking in supabase.js ---- */
{
  const p = 'supabase.js';
  let t = readFileSync(p, 'utf8');
  const oud = `/* Plots for sale. Stond hier voor de strip op de grondpagina; die pagina is
   op 29-08-2026 ingetrokken, dus deze functie heeft nu geen aanroeper meer.`;
  const nieuw = `/* Plots for sale, for the strip on land-for-sale-in-the-gambia.html.`;
  if (t.includes(oud)) schrijf(p, t.replace(oud, nieuw)); else zeg.push('supabase.js: opmerking stond al goed');
  if (!/function fetchLandListings/.test(t)) zeg.push('LET OP: fetchLandListings ontbreekt in supabase.js');
}

/* ---- 6. terug in de sitemap ---- */
{
  const p = 'sitemap-pages.xml';
  let t = readFileSync(p, 'utf8');
  if (t.includes(DOEL)) zeg.push('sitemap: stond er al in');
  else {
    const anker = '<url><loc>https://mykunda.com/gambia-property-prices.html</loc>';
    if (!t.includes(anker)) { console.error('sitemap: anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
    const regel = `<url><loc>https://mykunda.com/${DOEL}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;
    schrijf(p, t.replace(anker, regel + anker));
  }
}

/* ---- 7. servicewerker ophogen ---- */
{
  const p = 'sw.js';
  let t = readFileSync(p, 'utf8');
  const m = t.match(/const V = 'mk-v(\d+)'/);
  if (!m) zeg.push('LET OP: const V niet gevonden in sw.js');
  else if (V) zeg.push('[droog] sw.js zou naar mk-v' + (Number(m[1]) + 1) + ' gaan');
  else { const nv = Number(m[1]) + 1; writeFileSync(p, t.replace(m[0], `const V = 'mk-v${nv}'`)); zeg.push(`sw.js: mk-v${m[1]} -> mk-v${nv}`); }
}

console.log(zeg.join('\n'));
