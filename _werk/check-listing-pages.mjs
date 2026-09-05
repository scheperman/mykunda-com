/* Controle op de gegenereerde advertentiepagina's (05-09-2026).
   Draait op de root of op deploy/:
      node _werk/check-listing-pages.mjs
      node _werk/check-listing-pages.mjs deploy
   Controleert per pagina: canonical gelijk aan de bestandsnaam, unieke title en
   description binnen de grenzen, precies één H1, geldige JSON-LD met RealEstateListing
   en BreadcrumbList, elke <img> met alt, en dekking in sitemap-listings.xml. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.';
/* Interne links wijzen naar pagina's in de webroot. Draait de controle op een
   proefmap, dan staan die pagina's in de projectroot, niet naast de proefpagina's. */
const wortel = (dir === '.' || dir === 'deploy') ? dir : '.';
const HOST = 'https://mykunda.com/';
let fout = 0, ok = 0;
const zeg = (goed, tekst) => { if (goed) ok++; else { fout++; console.log('  FOUT ' + tekst); } };

const files = readdirSync(dir).filter(f => f.startsWith('listing-') && f.endsWith('.html'));
if (!files.length) { console.log('Geen advertentiepagina\'s gevonden in ' + dir + '/ - niets te controleren.'); process.exit(0); }

const titels = new Map(), descs = new Map();
for (const f of files) {
  const h = readFileSync(join(dir, f), 'utf8');
  const attr = (re) => (h.match(re) || [])[1];
  const title = attr(/<title[^>]*>([\s\S]*?)<\/title>/i) || '';
  const desc = attr(/<meta name="description" content="([^"]*)"/i) || '';
  const canon = attr(/<link rel="canonical" href="([^"]*)"/i) || '';
  zeg(canon === HOST + f, `${f}: canonical is "${canon}" en niet ${HOST}${f}`);
  zeg(title.length > 24 && title.length <= 65, `${f}: title is ${title.length} tekens (24-65)`);
  zeg(desc.length > 60 && desc.length <= 165, `${f}: description is ${desc.length} tekens (60-165)`);
  zeg(!titels.has(title), `${f}: dezelfde title als ${titels.get(title)}`);
  zeg(!descs.has(desc), `${f}: dezelfde description als ${descs.get(desc)}`);
  titels.set(title, f); descs.set(desc, f);

  const h1 = (h.match(/<h1[\s>]/g) || []).length;
  zeg(h1 === 1, `${f}: ${h1} H1's op de pagina`);

  const zonderAlt = (h.match(/<img\b(?![^>]*\salt=)[^>]*>/gi) || []).length;
  zeg(zonderAlt === 0, `${f}: ${zonderAlt} afbeelding(en) zonder alt`);

  const ld = (h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1];
  let types = [];
  try { const o = JSON.parse(ld); types = (o['@graph'] || [o]).map(x => x['@type']); }
  catch (e) { zeg(false, `${f}: JSON-LD is stuk (${e.message})`); }
  zeg(types.includes('RealEstateListing'), `${f}: geen RealEstateListing in de JSON-LD`);
  zeg(types.includes('BreadcrumbList'), `${f}: geen BreadcrumbList in de JSON-LD`);

  /* Kapotte interne links vangen we hier ook: een verwijzing naar een gebiedspagina
     die niet bestaat is precies de fout die op een gegenereerde pagina ontstaat. */
  for (const m of h.matchAll(/href="([a-z0-9-]+\.html)"/g)) {
    zeg(existsSync(join(wortel, m[1])), `${f}: link naar ${m[1]}, dat bestaat niet in ${wortel}/`);
  }
}

const smPad = join(dir, 'sitemap-listings.xml');
if (!existsSync(smPad)) zeg(false, 'sitemap-listings.xml ontbreekt terwijl er ' + files.length + ' pagina(s) zijn');
else {
  const sm = readFileSync(smPad, 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(HOST, ''));
  for (const f of files) zeg(locs.includes(f), `${f} staat niet in sitemap-listings.xml`);
  for (const l of locs) zeg(files.includes(l), `sitemap-listings.xml noemt ${l}, maar dat bestand bestaat niet`);
}

console.log(`\n${dir}: ${files.length} pagina(s), ${ok} controles goed, ${fout} fout`);
process.exit(fout ? 1 : 0);
