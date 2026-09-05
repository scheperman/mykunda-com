/* 05-09-2026: build.mjs leren dat advertentiepagina's in sitemap-listings.xml horen
   en niet in sitemap-pages.xml. No-op zolang er geen listing-pagina's zijn. */
import { readFileSync, writeFileSync } from 'node:fs';
let b = readFileSync('build.mjs', 'utf8');
if (b.includes('sitemap-listings.xml')) { console.log('build.mjs: stond er al'); process.exit(0); }

const a1 = "  'robots.txt', 'sitemap.xml', 'sitemap-pages.xml', '.htaccess',";
const a2 = `  for (const f of pages) {
    if (NOT_UPLOADED.has(f) || NOINDEX_PAGES.has(f) || JS_ROBOTS.has(f) || f === '404.html') continue;
    if (!inSitemap.has(f)) console.log(\`LET OP: \${f} is indexeerbaar maar staat niet in sitemap-pages.xml\`);
  }`;
for (const [n, a] of [[1, a1], [2, a2]]) if (!b.includes(a)) { console.error('anker ' + n + ' niet gevonden - NIETS gewijzigd'); process.exit(1); }

/* 1. de tweede sitemap mee naar de server. De mirrorstap slaat bestanden over die
      niet bestaan, dus dit mag al vóór de eerste advertentie. */
b = b.replace(a1, a1 + "\n  /* Tweede sitemap, alleen aanwezig zodra build-listing-pages.mjs draait.\n     Ontbreekt het bestand, dan slaat de mirrorstap het over. */\n  'sitemap-listings.xml',");

/* 2. de vangrail: listing-pagina's tegen hun eigen sitemap houden */
const nieuw = `  /* Advertentiepagina's (listing-*.html) horen niet in sitemap-pages.xml maar in
     sitemap-listings.xml, geschreven door build-listing-pages.mjs. Zolang dat script
     niet meedraait bestaan ze niet en doet deze lus niets. */
  let inListings = new Set();
  try {
    const sl = readFileSync('sitemap-listings.xml', 'utf8');
    inListings = new Set([...sl.matchAll(/<loc>https:\\/\\/mykunda\\.com\\/([^<]*)<\\/loc>/g)].map(m => m[1]));
  } catch {}
  for (const f of pages) {
    if (NOT_UPLOADED.has(f) || NOINDEX_PAGES.has(f) || JS_ROBOTS.has(f) || f === '404.html') continue;
    if (f.startsWith('listing-')) {
      if (!inListings.has(f)) console.log(\`LET OP: \${f} is indexeerbaar maar staat niet in sitemap-listings.xml\`);
      continue;
    }
    if (!inSitemap.has(f)) console.log(\`LET OP: \${f} is indexeerbaar maar staat niet in sitemap-pages.xml\`);
  }
  for (const f of inListings) if (!pages.includes(f)) console.log(\`LET OP: sitemap-listings.xml noemt \${f}, maar dat bestand staat niet in de root\`);`;
b = b.replace(a2, nieuw);
writeFileSync('build.mjs', b);
console.log('build.mjs: vangrail voor advertentiepagina\'s toegevoegd');
