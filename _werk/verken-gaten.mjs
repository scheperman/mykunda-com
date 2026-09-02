/* verken-gaten.mjs — welke pagina's missen ringen, en waarom precies? */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const scores = await j('area-scores.json');
const amen = await j('area-amenities.json');
const prijzen = await j('area-prices.json');
const reg = await j('_werk/moh-register-2026-09-01.json');

const MATEN = ['Affordability', 'Everyday shopping', 'Places to eat', 'Healthcare'];
const KEYS = { 'Everyday shopping': ['shop', 'supermarket', 'market'], 'Places to eat': ['eat', 'bar'], Healthcare: ['health', 'pharmacy'] };

const alleGebieden = Object.values(prijzen.areas).filter(a => a && a.slug);
const metBlok = new Set(Object.values(amen.areas).map(g => g.slug));
console.log(`gebieden in area-prices.json: ${alleGebieden.length}; met scoreblok: ${metBlok.size}\n`);

console.log('A. GEBIEDEN ZONDER SCOREBLOK');
for (const a of alleGebieden.filter(a => !metBlok.has(a.slug))) {
  console.log(`  ${a.slug.padEnd(16)} prijs ${String(a.gmd_m2 ?? '-').padStart(6)} /m²  bewijs: ${a.evidence ?? '?'}`);
}

console.log('\nB. GEBIEDEN MET BLOK MAAR MINDER DAN VIER RINGEN');
for (const g of Object.values(scores.areas)) {
  if (g.measures.length === 4) continue;
  const heeft = new Set(g.measures.map(m => m.label));
  const mist = MATEN.filter(m => !heeft.has(m));
  const gA = Object.values(amen.areas).find(a => a.slug === g.slug);
  const detail = mist.map(m => {
    if (m === 'Affordability') return 'Affordability (geen prijs)';
    const n = KEYS[m].map(k => `${k}=${gA.counts[k] || 0}`).join(' ');
    return `${m} (${n})`;
  });
  console.log(`  ${g.slug.padEnd(16)} ${g.measures.length} ringen — mist: ${detail.join('; ')}`);
}

console.log('\nC. HET REGISTER VAN HET MINISTERIE');
console.log(`  ${reg.facilities.length} voorzieningen, gekoppeld aan gebied: ` +
  [...new Set(reg.facilities.map(f => f.area))].join(', '));
const zonderZorg = Object.values(scores.areas).filter(g => !g.measures.some(m => m.label === 'Healthcare'));
console.log(`  gebieden zonder Healthcare-ring: ` + zonderZorg.map(g => g.name).join(', '));
