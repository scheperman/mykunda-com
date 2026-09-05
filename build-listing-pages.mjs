/* MyKunda — statische advertentiepagina's (05-09-2026)
 *
 * WAAROM DIT BESTAAT
 * Op 05-09-2026 was er geen enkele indexeerbare advertentie: property.html draagt
 * noindex (ook mét ?id=) omdat de inhoud pas na een Supabase-aanroep in de pagina
 * komt, en `listings` stond op nul rijen. Een vastgoedsite haalt zijn lange staart
 * juist daar vandaan ("3 bedroom house Brusubi"). Dit script maakt per actieve
 * advertentie een echte, statische pagina met de inhoud al in de HTML.
 *
 * DIT SCRIPT DRAAIT (NOG) NIET MEE IN build.mjs. Dat is bewust: zolang er geen
 * enkele advertentie is, valt er niets te controleren op echte data. Aanzetten is
 * één regel in upload.bat of in build.mjs; zie ONDERAAN dit bestand.
 *
 * GEBRUIK
 *   node build-listing-pages.mjs --fixture --uit=_werk/proef-listings
 *                                                op de proefdata, in een aparte map
 *   node build-listing-pages.mjs --droog         haalt echte data op, schrijft niets
 *   node build-listing-pages.mjs                 haalt echte data op en schrijft
 *
 * --uit=<map> schrijft alles daarheen in plaats van naar de root. Draai de proefdata
 * ALTIJD met --uit: een proefpagina in de root wordt door build.mjs opgepakt als een
 * echte pagina en staat na de eerstvolgende upload live.
 *
 * DE URL LIGT VAST NA DE EERSTE KEER
 * listing-urls.json (root, niet op de server) onthoudt welke bestandsnaam bij welke
 * advertentie hoort. Verandert de titel later, dan blijft de URL staan: een URL die
 * meebeweegt met een tekstveld is geen URL maar een momentopname, en elke wijziging
 * zou een 404 in de index achterlaten.
 *
 * WAT HET NOOIT DOET
 * Bij een mislukte of lege ophaal terwijl er wél pagina's bestaan, schrijft het niets
 * en meldt het LET OP. Een netwerkfout mag nooit de hele advertentievoorraad uit de
 * index halen.
 */
import { readFile, writeFile, readdir, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SB = 'https://jejaerpqltqryqzjvbjp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplamFlcnBxbHRxcnlxemp2YmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MTg0MTQsImV4cCI6MjA5NzE5NDQxNH0.PhsM5IGMIY_VOl1eleQyoUJeYB4VoEHUpJtlLxpj7hA';
const HOST = 'https://mykunda.com/';
const LEDGER = 'listing-urls.json';
const SITEMAP = 'sitemap-listings.xml';
const PREFIX = 'listing-';

const fixture = process.argv.includes('--fixture');
const droog = process.argv.includes('--droog') || process.argv.includes('--dry');
const UIT = (process.argv.find(a => a.startsWith('--uit=')) || '--uit=.').slice(6) || '.';
const pad = f => join(UIT, f);
if (fixture && UIT === '.') {
  console.log('LET OP: proefdata schrijven naar de root zou proefpagina\'s live zetten.');
  console.log('        Gebruik --uit=_werk/proef-listings, of --droog om alleen te kijken.');
  if (!droog) process.exit(1);
}

/* ---------------- ophalen ---------------- */
async function haalOp() {
  if (fixture) {
    const j = JSON.parse(await readFile('_werk/listing-fixtures.json', 'utf8'));
    return { rijen: j.listings, media: j.media, bron: 'fixture' };
  }
  const q = `${SB}/rest/v1/listings?status=eq.active&select=*&order=updated_at.desc`;
  const h = { apikey: ANON, authorization: 'Bearer ' + ANON };
  const r = await fetch(q, { headers: h });
  if (!r.ok) throw new Error('listings: HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const rijen = await r.json();
  const media = {};
  for (const l of rijen) {
    const m = await fetch(`${SB}/rest/v1/listing_media?listing_id=eq.${l.id}&is_document=is.false&select=storage_path,sort&order=sort.asc`, { headers: h });
    media[l.id] = m.ok ? await m.json() : [];
  }
  return { rijen, media, bron: 'supabase' };
}

/* ---------------- hulpjes ---------------- */
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slug = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');
const foto = p => `${SB}/storage/v1/object/public/listing-photos/${p}`;
const dalasi = n => 'D' + Number(n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 });

/* "4 bedroom house in Brusubi" - het soort zin waarop mensen zoeken. */
const CAT = { apartment: 'apartment', house: 'house', villa: 'villa', townhouse: 'townhouse', penthouse: 'penthouse',
  compound: 'compound', land: 'land', lodge: 'lodge', commercial: 'commercial property', office: 'office',
  retail: 'retail unit', warehouse: 'warehouse', restaurant: 'restaurant', mixed_use: 'mixed-use property',
  business_plot: 'business plot' };

/* "4 bedroom house for sale in Brusubi" - de woordvolgorde waarin mensen zoeken
   ("house for sale gambia", "land for sale in gambia"), niet "in Brusubi for sale". */
function kop(l) {
  const wat = CAT[l.category] || 'property';
  const beds = l.beds ? l.beds + ' bedroom ' : '';
  const actie = l.kind === 'rent' ? ' for rent' : ' for sale';
  const waar = l.area ? ' in ' + l.area : ' in The Gambia';
  return (beds + wat + actie + waar).replace(/^./, c => c.toUpperCase());
}
function titel(l) {
  const p = l.kind === 'rent' && l.price_period ? '/' + l.price_period : '';
  const vol = `${kop(l)} — ${dalasi(l.price)}${p} | MyKunda`;
  /* Google kapt rond 65 tekens af. Past het niet, dan valt eerst de prijs weg en
     daarna pas de merknaam: de kop is het enige dat de zoeker moet herkennen. */
  if (vol.length <= 65) return vol;
  const zonderPrijs = `${kop(l)} | MyKunda`;
  return zonderPrijs.length <= 65 ? zonderPrijs : kop(l).slice(0, 65);
}
function omschrijving(l) {
  const stukken = [kop(l), 'at ' + dalasi(l.price) + '.'];
  if (l.plot_sqm) stukken.push(l.plot_sqm + ' m² plot.');
  if (l.sqm) stukken.push(l.sqm + ' m² built.');
  if (l.is_verified_title) stukken.push('Title verified by MyKunda.');
  stukken.push('Photos, location and full details.');
  return stukken.join(' ').slice(0, 160);
}

/* ---------------- de pagina ---------------- */
function feiten(l) {
  const r = [];
  const zet = (k, v) => { if (v !== null && v !== undefined && v !== '' && v !== 0) r.push([k, v]); };
  zet('Type', CAT[l.category] || l.category);
  zet('Area', l.area);
  zet('Bedrooms', l.beds);
  zet('Bathrooms', l.baths);
  zet('Built area', l.sqm ? l.sqm + ' m²' : null);
  zet('Plot size', l.plot_sqm ? l.plot_sqm + ' m²' : null);
  zet('Plot', l.plot_width_m && l.plot_depth_m ? l.plot_width_m + ' × ' + l.plot_depth_m + ' m' : null);
  zet('Title', l.title_type);
  zet('Lease remaining', l.lease_years_remaining ? l.lease_years_remaining + ' years' : null);
  zet('Year built', l.year_built);
  zet('Condition', l.condition);
  zet('Water', l.water || l.land_water);
  zet('Electricity', l.electricity || l.power);
  zet('Road access', l.road);
  zet('Fencing', l.fencing);
  zet('Beach', l.beach_m ? l.beach_m + ' m to the beach' : l.land_beach);
  return r;
}

function pagina(l, fotos, bestand) {
  const url = HOST + bestand;
  const t = titel(l), d = omschrijving(l);
  const h1 = kop(l);
  const cover = fotos[0] || HOST + 'images/og/home-hero.jpg';
  const gebied = l.area ? slug(l.area) + '.html' : 'areas-in-the-gambia.html';
  const gebiedBestaat = existsSync(gebied);
  const terug = l.kind === 'rent' ? 'rent.html' : 'buy.html';
  const ld = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'MyKunda', item: HOST },
        { '@type': 'ListItem', position: 2, name: l.kind === 'rent' ? 'Property to rent' : 'Property for sale', item: HOST + terug },
        { '@type': 'ListItem', position: 3, name: h1, item: url }
      ] },
      { '@type': l.kind === 'rent' ? 'RentAction' : 'Product', '@id': url + '#object' }
    ]
  };
  /* Een advertentie is voor Google een Offer op een Accommodation of een stuk grond.
     RealEstateListing is het type dat Google zelf noemt voor vastgoedadvertenties. */
  ld['@graph'][1] = {
    '@type': 'RealEstateListing', '@id': url + '#listing', url, name: h1,
    datePosted: (l.created_at || '').slice(0, 10) || undefined,
    description: (l.description || d).slice(0, 900),
    image: fotos.slice(0, 8),
    offers: { '@type': 'Offer', price: Number(l.price), priceCurrency: l.price_currency || 'GMD',
      availability: 'https://schema.org/InStock', url },
    about: {
      '@type': l.category === 'land' ? 'Place' : 'Accommodation',
      name: h1,
      address: { '@type': 'PostalAddress', addressLocality: l.area || undefined, addressCountry: 'GM' },
      ...(l.lat && l.lng ? { geo: { '@type': 'GeoCoordinates', latitude: l.lat, longitude: l.lng } } : {}),
      ...(l.beds ? { numberOfBedrooms: l.beds } : {}),
      ...(l.baths ? { numberOfBathroomsTotal: l.baths } : {}),
      ...(l.sqm ? { floorSize: { '@type': 'QuantitativeValue', value: l.sqm, unitCode: 'MTK' } } : {}),
      ...(l.plot_sqm ? { lotSize: { '@type': 'QuantitativeValue', value: l.plot_sqm, unitCode: 'MTK' } } : {})
    }
  };
  const rijen = feiten(l).map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  const gal = fotos.slice(0, 12).map((u, i) =>
    `<img src="${esc(u)}" alt="${esc(h1)} — photo ${i + 1}" width="1200" height="800" loading="${i ? 'lazy' : 'eager'}"${i ? '' : ' fetchpriority="high"'}>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" type="image/png" sizes="64x64" href="images/mykunda-icon-sm.png">
<link rel="apple-touch-icon" href="images/mykunda-icon.png">
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#15463A">
<title>${esc(t)}</title>
<meta name="description" content="${esc(d)}">
<meta property="og:site_name" content="MyKunda">
<meta property="og:locale" content="en_GB">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(t)}">
<meta property="og:description" content="${esc(d)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${esc(cover)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${esc(cover)}">
<meta name="twitter:title" content="${esc(t)}">
<meta name="twitter:description" content="${esc(d)}">
<link rel="preconnect" href="${SB}" crossorigin>
<link rel="preload" href="fonts/mulish-var-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="styles.min.css?v=0">
<style>
.lst-wrap{max-width:1000px;margin:0 auto;padding:34px 24px 60px}
.lst-crumbs{font-size:13.5px;color:var(--muted);font-weight:600;margin-bottom:14px}
.lst-crumbs a{color:var(--green-700)}
.lst h1{font-size:clamp(26px,3.4vw,36px);letter-spacing:-.02em}
.lst-price{font-size:26px;font-weight:800;color:var(--green-700);margin-top:6px}
.lst-sub{color:var(--ink-2);margin-top:6px}
.lst-gal{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:22px 0}
.lst-gal img{width:100%;height:230px;object-fit:cover;border-radius:var(--r-md);background:var(--paper-2)}
.lst-cols{display:grid;grid-template-columns:1.4fr 1fr;gap:30px;align-items:start}
@media(max-width:760px){.lst-cols{grid-template-columns:1fr}}
.lst-facts{width:100%;border-collapse:collapse;font-size:14.5px;border:1px solid var(--line);border-radius:var(--r-md);overflow:hidden}
.lst-facts th{text-align:left;padding:9px 14px;background:var(--paper);color:var(--muted);font-weight:700;width:45%}
.lst-facts td{padding:9px 14px;color:var(--ink-2)}
.lst-facts tr+tr th,.lst-facts tr+tr td{border-top:1px solid var(--line-2)}
.lst-body p{color:var(--ink-2);line-height:1.75;margin-bottom:12px}
.lst-cta{margin-top:22px;display:flex;gap:10px;flex-wrap:wrap}
.lst-note{margin-top:26px;font-size:13.5px;color:var(--muted)}
</style>
</head>
<body>
<div id="header"></div>
<div class="lst-wrap lst">
  <nav class="lst-crumbs"><a href="./">MyKunda</a> › <a href="${terug}">${l.kind === 'rent' ? 'Property to rent' : 'Property for sale'}</a>${gebiedBestaat ? ` › <a href="${gebied}">${esc(l.area)}</a>` : ''}</nav>
  <h1>${esc(h1)}</h1>
  <div class="lst-price">${esc(dalasi(l.price))}${l.kind === 'rent' && l.price_period ? ' <span class="lst-sub">per ' + esc(l.price_period) + '</span>' : ''}</div>
  ${l.street || l.area ? `<p class="lst-sub">${esc([l.street, l.area].filter(Boolean).join(', '))}, The Gambia</p>` : ''}
  <div class="lst-gal">${gal}</div>
  <div class="lst-cols">
    <div class="lst-body">
      ${(l.description || '').split(/\n{2,}/).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('') || `<p>${esc(d)}</p>`}
      ${l.highlights ? `<p><b>Highlights:</b> ${esc(l.highlights)}</p>` : ''}
      <div class="lst-cta">
        <a class="btn btn-primary" href="property.html?id=${esc(l.id)}">Contact the seller</a>
        <a class="btn btn-ghost" href="${terug}">More ${l.kind === 'rent' ? 'rentals' : 'property for sale'}</a>
      </div>
      <p class="lst-note">Listed on MyKunda${l.is_verified_title ? ', with the title checked by MyKunda' : ''}. Always verify ownership and boundaries before you pay anything — <a href="verify.html">how MyKunda checks a title</a>.</p>
    </div>
    <table class="lst-facts">${rijen}</table>
  </div>
</div>
<div id="footer"></div>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase.js?v=0"></script>
<script src="app.min.js?v=0"></script>
<script>
document.getElementById('header').innerHTML = headerHTML('${l.kind === 'rent' ? 'rent' : 'buy'}', false);
document.getElementById('footer').innerHTML = footerHTML();
</script>
</body>
</html>
`;
}

/* ---------------- uitvoeren ---------------- */
if (UIT !== '.' && !droog) await mkdir(UIT, { recursive: true });
let ledger = {};
try { ledger = JSON.parse(await readFile(pad(LEDGER), 'utf8')); } catch {}
let bestaand = [];
try { bestaand = (await readdir(UIT)).filter(f => f.startsWith(PREFIX) && f.endsWith('.html')); } catch {}

let data;
try { data = await haalOp(); }
catch (e) {
  console.log('LET OP: advertenties niet op te halen (' + e.message + ').');
  console.log('        Er is NIETS gewijzigd; de ' + bestaand.length + ' bestaande pagina(s) blijven staan.');
  process.exit(1);
}
const { rijen, media, bron } = data;

if (!rijen.length && bestaand.length) {
  console.log('LET OP: de ophaal gaf nul actieve advertenties terwijl er ' + bestaand.length + ' pagina(s) staan.');
  console.log('        Dat is bijna altijd een fout in plaats van een lege voorraad, dus er is niets gewijzigd.');
  process.exit(1);
}

const gemaakt = [];
const genomen = new Set(Object.entries(ledger).map(([, v]) => v.file));
for (const l of rijen) {
  const plat = String(l.id).replace(/-/g, '');
  let naam = ledger[l.id]?.file;
  if (!naam) {
    /* Botsing is onwaarschijnlijk maar niet onmogelijk: twee objecten met dezelfde
       kop én dezelfde eerste acht tekens van hun id. Dan schuift het staartje op tot
       de naam vrij is - nooit twee advertenties op één bestand. */
    for (let n = 8; n <= 32; n += 4) {
      naam = `${PREFIX}${slug(kop(l))}-${plat.slice(0, n)}.html`;
      if (!genomen.has(naam)) break;
    }
  }
  genomen.add(naam);
  const fotos = (media[l.id] || []).map(m => foto(m.storage_path));
  const html = pagina(l, fotos, naam);
  gemaakt.push({ id: l.id, file: naam, lastmod: (l.updated_at || l.created_at || '').slice(0, 10) });
  if (!droog) await writeFile(pad(naam), html);
  ledger[l.id] = { file: naam, first: ledger[l.id]?.first || new Date().toISOString().slice(0, 10) };
}

/* Pagina's van advertenties die niet meer actief zijn: weg uit de root en uit de
   sitemap. De URL geeft daarna een echte 404 via ErrorDocument in .htaccess. Dat is
   het juiste antwoord voor een verkocht of ingetrokken object: een 301 naar een
   overzicht zou de bezoeker laten denken dat het er nog is. */
const houden = new Set(gemaakt.map(g => g.file));
let weg = 0;
let nietWeg = 0;
for (const f of bestaand) {
  if (houden.has(f)) continue;
  if (droog) { weg++; continue; }
  /* Verwijderen kan mislukken - een openstaand bestand, of een map die tegen
     verwijderen beschermd is. Dat mag de rest van de run niet omgooien: de pagina
     blijft dan staan en verdwijnt alleen uit de sitemap, en je krijgt het te horen. */
  try { await rm(pad(f), { force: true }); weg++; }
  catch (e) { nietWeg++; console.log(`LET OP: ${f} hoort weg maar kon niet verwijderd worden (${e.code || e.message}). Hij staat niet meer in de sitemap; haal hem met de hand weg.`); }
}
for (const [id, v] of Object.entries(ledger)) if (!houden.has(v.file)) delete ledger[id];

const sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + gemaakt.map(g => `<url><loc>${HOST}${g.file}</loc><lastmod>${g.lastmod || new Date().toISOString().slice(0, 10)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join('\n')
  + '\n</urlset>\n';

if (!droog) {
  await writeFile(pad(LEDGER), JSON.stringify(ledger, null, 1) + '\n');
  if (gemaakt.length) await writeFile(pad(SITEMAP), sm);
  else if (existsSync(pad(SITEMAP))) await rm(pad(SITEMAP), { force: true });
}

/* De sitemapindex hoort naar beide lijsten te wijzen, maar alleen zolang de tweede
   lijst bestaat: een index die naar een 404 wijst is erger dan een index met één
   verwijzing. Alleen bij een echte run in de root; een proefmap raakt de index niet. */
if (!droog && UIT === '.') {
  const idx = await readFile('sitemap.xml', 'utf8');
  const regel = `<sitemap><loc>${HOST}${SITEMAP}</loc><lastmod>${new Date().toISOString().slice(0, 10)}</lastmod></sitemap>`;
  let uit = idx.replace(/<sitemap><loc>[^<]*sitemap-listings\.xml<\/loc>[\s\S]*?<\/sitemap>\n?/, '');
  if (gemaakt.length) uit = uit.replace('</sitemapindex>', regel + '\n</sitemapindex>');
  if (uit !== idx) await writeFile('sitemap.xml', uit);
}

console.log(`${droog ? '[droge run] ' : ''}bron ${bron}: ${gemaakt.length} advertentiepagina(s)${weg ? `, ${weg} verlopen pagina(s) verwijderd` : ''}${nietWeg ? `, ${nietWeg} NIET verwijderd` : ''}`);
for (const g of gemaakt) console.log('  ' + g.file);
if (droog) console.log('  (er is niets geschreven)');

/* ---------------- AANZETTEN ----------------
 *
 * Zolang `listings` leeg is, heeft meedraaien geen zin en kan niemand het resultaat
 * op echte data nakijken. Aanzetten gaat zo, in deze volgorde:
 *
 *  1. Zet in build.mjs, vlak vóór de sitemapstap, een aanroep van dit bestand
 *     (of zet in upload.bat een regel `call node build-listing-pages.mjs` vóór
 *     `call node build.mjs`). Vóór de sitemapstap, want build.mjs controleert daar
 *     of elke indexeerbare pagina in een sitemap staat.
 *  2. Zet 'sitemap-listings.xml' in SITE_ASSETS in build.mjs. De mirrorstap slaat
 *     bestanden over die niet bestaan, dus dat mag nu al.
 *  3. Zorg dat de vangrail in build.mjs pagina's die met 'listing-' beginnen
 *     tegen sitemap-listings.xml houdt in plaats van tegen sitemap-pages.xml.
 *     Die uitzondering staat er sinds 05-09-2026 al in.
 *  4. Zet een crawlbare lijst neer: sitemap alleen is genoeg om gevonden te worden,
 *     maar niet om gewicht te krijgen. Op de gebiedspagina van het object hoort een
 *     link naar de advertentie te staan, en op buy.html en rent.html een statische
 *     lijst van de laatste advertenties. Zonder die links blijft elke pagina een wees.
 *  5. Draai daarna `node _werk/check-listing-pages.mjs` en pas dan upload.bat.
 */
