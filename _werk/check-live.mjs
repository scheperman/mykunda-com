/* Live nameten na een upload. Draait vanaf de pc van Edwin, want Cloudflare
 * weigert verzoeken uit de cloudomgeving met 403.
 *
 *   node _werk/check-live.mjs
 *
 * Elke URL krijgt een cache-buster mee: een WebFetch direct na het legen van de
 * Cloudflare-cache kan anders nog een oude edge-kopie tonen (leerpunt 29-08-2026).
 */
const T = Date.now();
const B = 'https://mykunda.com/';
const haal = async p => {
  const r = await fetch(B + p + (p.includes('?') ? '&' : '?') + 'mk=' + T, {
    headers: { 'cache-control': 'no-cache', pragma: 'no-cache' }
  });
  if (!r.ok) throw new Error(p + ' gaf ' + r.status);
  return await r.text();
};

const fouten = [], ok = [];
const eis = (naam, v, uitleg) => v ? ok.push(naam) : fouten.push(naam + (uitleg ? ' — ' + uitleg : ''));

const land = await haal('land-for-sale-in-the-gambia.html');
const sw   = await haal('sw.js');
const buy  = await haal('buy.html');
const idx  = await haal('index.html');

/* 1. staat de nieuwe pagina er echt */
eis('hero-CTA naar de kavelzoekpagina', /href="search\.html\?type=sale&amp;cat=land"[^>]*class="btn btn-amber"|class="btn btn-amber" href="search\.html\?type=sale&amp;cat=land"/.test(land));
eis('anker #prices', /id="prices"/.test(land) && /href="#prices"/.test(land));
eis('aanbodsectie verborgen', /id="landPlots" hidden/.test(land));
eis('verkopersband', /Got a plot to sell\?/.test(land));
eis('leadband', /class="landband"/.test(land));
eis('diaspora-checklist gelinkt', /href="diaspora-land-buying-checklist\.html"/.test(land));
eis('waardebepaling gelinkt', /href="sell\.html#value"/.test(land));
const rijen = (land.match(/<tr><td><a href="[a-z-]+\.html">/g) || []).length;
eis(`prijstabel ${rijen} rijen`, rijen === 19, 'verwacht 19');

/* 2. de FAQ en de structured data */
const vragen = [...land.matchAll(/<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="a"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/g)];
eis(`${vragen.length} FAQ-vragen`, vragen.length === 5);
const ldm = land.match(/<script type="application\/ld\+json" id="mkFaqLd">\s*([\s\S]*?)\s*<\/script>/);
eis('mkFaqLd aanwezig', !!ldm);
if (ldm) {
  let j = null;
  try { j = JSON.parse(ldm[1]); } catch (e) { fouten.push('mkFaqLd ongeldige JSON — ' + e.message); }
  if (j) {
    const kaal = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    eis('mkFaqLd is FAQPage met 5 vragen', j['@type'] === 'FAQPage' && j.mainEntity.length === 5);
    const afw = j.mainEntity.filter((q, i) => vragen[i] &&
      (kaal(vragen[i][1]) !== q.name || kaal(vragen[i][2]) !== q.acceptedAnswer.text));
    eis('structured data gelijk aan zichtbare tekst', afw.length === 0, `${afw.length} wijken af`);
  }
}
const a1 = land.match(/<div class="a" id="faqA1">([\s\S]*?)<\/div>/);
eis('faqA1 heeft bedragen', !!a1 && /D[\d,.]+[kM]?/.test(a1[1]));

/* 3. stempel en service worker horen bij elkaar */
const stamp = (land.match(/app\.min\.js\?v=(\d+)/) || [])[1];
const swStamp = (sw.match(/STAMP\s*=\s*'(\d+)'/) || [])[1];
const swV = (sw.match(/const V = '([^']+)'/) || [])[1];
eis(`stempel ${stamp} gelijk in sw.js`, stamp && stamp === swStamp, `sw.js zegt ${swStamp}`);
eis(`service worker ${swV}`, swV === 'mk-v82', 'verwacht mk-v82');

/* 4. de twee opgeloste generatorbugs mogen live niet meer zichtbaar zijn */
for (const [naam, html] of [['buy.html', buy], ['index.html', idx]]) {
  eis(`${naam}: geen herhaald "band rate"`, !/band rate\s*·\s*band rate/.test(html));
  eis(`${naam}: regioteller in het menu klopt`, /<span>10 areas<\/span>/.test(html), 'Kombo Coast zou 10 areas moeten zijn');
}
eis('land: regioteller in het menu klopt', /<span>15 areas<\/span>/.test(land), 'Kombo Inland zou 15 areas moeten zijn');

/* 5. indexeerbaar */
eis('robots op index,follow', /name="robots" content="index, follow/.test(land));
eis('canonical ongewijzigd', /rel="canonical" href="https:\/\/mykunda\.com\/land-for-sale-in-the-gambia\.html"/.test(land));

for (const r of ok) console.log('  ok   ' + r);
for (const f of fouten) console.log('  FOUT ' + f);
console.log(`\nlive: ${ok.length} goed, ${fouten.length} fout   (cache-buster mk=${T})`);
process.exit(fouten.length ? 1 : 0);
