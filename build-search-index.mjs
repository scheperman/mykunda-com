/* ============================================================
   build-search-index.mjs — de inhoudsindex achter de zoekbalken
   ------------------------------------------------------------
   Tot 31-08-2026 kende de site twee zoekvelden en geen van beide
   doorzocht de inhoud:

     · het vergrootglas in de header ging naar search.html?q= en
       filtert daar alleen advertenties op area + street + title;
     · het zoekveld in het Guides-menu matchte uitsluitend de
       GIDSTITEL. Gemeten op 31-08: "stamp duty", "consent",
       "erosion" en "faq" gaven alle vier "No match", terwijl dat
       nu juist de onderwerpen zijn waar de gidsen over gaan.

   Dit script leest de gebouwde bronpagina's en schrijft
   search-content.json: per gids elke <h2 id> en elke Q&A-vraag,
   plus alle vragen uit faq.html met hun eigen anker.

   Het draait vanuit build.mjs, VOORDAT de stempel wordt berekend —
   anders verschuift de inhoud wel maar de stempel niet, en houden
   terugkerende bezoekers de oude index. search-content.json staat
   daarom in VERSIONED en in SITE_ASSETS, net als gambia-osm.json.

   Er komt geen <script> voor in de pagina's: app.js haalt het
   bestand pas op zodra iemand een toets indrukt in een zoekveld.
   ============================================================ */

import { readFile, readdir } from 'node:fs/promises';

const FILE = 'search-content.json';

/* Losse pagina's die geen gids zijn maar wel een antwoord kunnen zijn.
   Alleen op titel doorzoekbaar; ze hebben geen bruikbare kopstructuur. */
const KEY_PAGES = [
  ['verify.html',                'Ownership Verification — check who really owns it', 'Service'],
  ['sell.html',                  'List your property, and what it costs',             'Service'],
  ['how-we-measure-prices.html', 'How we measure prices',                             'Method'],
  ['areas-in-the-gambia.html',   'Every area in The Gambia, compared',                'Areas'],
  ['safe.html',                  'Safe and supported — how we protect buyers',        'Trust'],
  ['legal-privacy.html',         'Privacy policy',                                    'Legal'],
];

const strip = h => h
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
  .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (m, d) => String.fromCharCode(d))
  .replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/&lsquo;|&rsquo;/g, '’').replace(/&ldquo;|&rdquo;/g, '"')
  .replace(/&hellip;/g, '…').replace(/&[a-z]+;/g, ' ')
  .replace(/\s+/g, ' ').trim();

/* De rolnaam achter het id-voorvoegsel van een FAQ-item. faq.html geeft elk
   antwoord een id als "sell-do-i-need-the-ministers-consent". */
const FAQ_ROLE = { buy: 'FAQ · buying or renting', sell: 'FAQ · selling', pro: 'FAQ · agents & developers' };

export async function buildSearchIndex() {
  const pages = [];
  const items = [];
  const pageIx = new Map();
  const addPage = (url, label, group) => {
    const key = url + '\0' + group;
    if (!pageIx.has(key)) { pageIx.set(key, pages.length); pages.push([url, label, group]); }
    return pageIx.get(key);
  };

  const files = (await readdir('.')).filter(f => /^guide-.+\.html$/.test(f)).sort();

  for (const f of files) {
    const s = await readFile(f, 'utf8');

    const h1  = strip((s.match(/<h1>([\s\S]*?)<\/h1>/) || [, ''])[1]);
    const cat = strip((s.match(/<span class="a-cat">([\s\S]*?)<\/span>/) || [, 'Guide'])[1]);
    if (!h1) { console.log(`LET OP: ${f} heeft geen <h1>, overgeslagen in de zoekindex`); continue; }
    const p = addPage(f, h1, cat);

    /* De secties. "In short" staat in een <aside> zonder id en valt hier dus
       vanzelf buiten; Sources laten we bewust weg — niemand zoekt daarop. */
    for (const m of s.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)) {
      const text = strip(m[2]);
      if (!text || /^sources$/i.test(text)) continue;
      items.push([p, m[1], text, 0]);
    }

    /* De Q&A-vragen. Het anker is de laatste <h2 id> vóór het eerste
       .qa-blok — structureel, dus onafhankelijk van hoe de kop heet. */
    const qi = s.indexOf('<div class="qa"');
    if (qi > -1) {
      const before = [...s.slice(0, qi).matchAll(/<h2 id="([^"]+)"/g)];
      const anchor = before.length ? before[before.length - 1][1] : '';
      for (const m of s.matchAll(/<div class="qa">\s*<h3>([\s\S]*?)<\/h3>/g)) {
        const q = strip(m[1]);
        if (q) items.push([p, anchor, q, 1]);
      }
    }
  }

  /* faq.html — elk antwoord heeft al een eigen id, dus een echt diep anker. */
  try {
    const s = await readFile('faq.html', 'utf8');
    for (const m of s.matchAll(/<details class="fq" id="([^"]+)"><summary>([\s\S]*?)<\/summary>/g)) {
      const id = m[1], q = strip(m[2]);
      const role = FAQ_ROLE[id.split('-')[0]] || 'FAQ';
      if (q) items.push([addPage('faq.html', 'Frequently asked questions', role), id, q, 1]);
    }
  } catch { console.log('LET OP: faq.html niet gevonden voor de zoekindex'); }

  for (const [url, label, group] of KEY_PAGES) {
    try { await readFile(url, 'utf8'); } catch { continue; }
    items.push([addPage(url, label, group), '', label, 2]);
  }

  const json = JSON.stringify({ v: 1, pages, items });
  const faq = items.filter(i => i[3] === 1).length;
  console.log(`index     ${items.length} regels (${items.length - faq - KEY_PAGES.length} secties, ${faq} vragen) over ${pages.length} pagina's, ${Math.round(json.length / 1024)} kB`);
  return { name: FILE, body: json };
}
