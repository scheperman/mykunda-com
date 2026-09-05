import { readFileSync, existsSync } from 'node:fs';
const h = readFileSync('_werk/landpagina-uit-git.html', 'utf8');
console.log('=== plaatjes waar de pagina om vraagt');
const bronnen = new Set();
for (const m of h.matchAll(/(?:src|href)="((?:images|logo|fonts|vendor)\/[^"?]+)/g)) bronnen.add(m[1]);
for (const m of h.matchAll(/srcset="([^"]+)"/g)) for (const d of m[1].split(',')) { const p = d.trim().split(/\s+/)[0]; if (/^(images|logo)\//.test(p)) bronnen.add(p); }
let weg = 0;
for (const b of [...bronnen].sort()) { const ok = existsSync(b); if (!ok) weg++; console.log((ok ? '  ok   ' : '  WEG  ') + b); }
console.log(weg ? `\n${weg} ontbreken` : '\nalle bestanden aanwezig');

console.log('\n=== interne links');
let kapot = 0;
for (const m of new Set([...h.matchAll(/href="([a-z0-9-]+\.html)/g)].map(x => x[1]))) {
  if (!existsSync(m)) { kapot++; console.log('  KAPOT ' + m); }
}
console.log(kapot ? `${kapot} kapotte links` : 'geen kapotte interne links');

console.log('\n=== ankers die build-area-prices.mjs nodig heeft');
for (const [naam, re] of [['faqA1', /<div class="a" id="faqA1">/], ['mkFaqLd', /<script type="application\/ld\+json" id="mkFaqLd">/],
  ['eyebrow Land & plots', /<div class="eyebrow">Land &amp; plots · /], ['tabelrijen', /<tr><td><a href="[a-z-]+\.html">/],
  ['px-stamp', /<p class="px-stamp">/], ['thead', /<thead><tr>/]]) console.log((re.test(h) ? '  ok   ' : '  WEG  ') + naam);

console.log('\n=== kop en meta');
console.log('title: ' + (h.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1]);
console.log('desc:  ' + (h.match(/name="description" content="([^"]*)"/) || [])[1]);
console.log('h1:    ' + (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]+>/g, ''));
console.log('canonical: ' + (h.match(/rel="canonical" href="([^"]*)"/) || [])[1]);
console.log('scripts: ' + [...h.matchAll(/<script src="([^"?]+)/g)].map(m => m[1]).join(', '));
