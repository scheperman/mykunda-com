/* verken-maten4.mjs — zit onderwijs in de OSM-vangst? en hoe ziet Essau eruit? */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const ruw = await j('_werk/gambia-amenities.json');
const lijst = Array.isArray(ruw) ? ruw : (ruw.items || ruw.elements || Object.values(ruw).find(Array.isArray));
console.log('ruwe vangst:', Array.isArray(ruw) ? 'array' : Object.keys(ruw).join(', '), '| objecten:', lijst.length);
console.log('voorbeeld:', JSON.stringify(lijst[0]));

const tellen = {};
for (const o of lijst) {
  const t = o.tags || o;
  for (const k of ['amenity', 'shop', 'tourism', 'healthcare', 'office', 'leisure', 'landuse']) {
    if (t[k]) { const s = k + '=' + t[k]; tellen[s] = (tellen[s] || 0) + 1; }
  }
}
const onderwijs = Object.entries(tellen).filter(([k]) => /school|college|university|kindergarten|education|library/.test(k));
console.log('\nonderwijs-achtige tags in de vangst:');
for (const [k, v] of onderwijs.sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(28)} ${v}`);

const amen = await j('area-amenities.json');
const essau = Object.values(amen.areas).find(a => a.slug === 'essau');
console.log('\nEssau nu:', JSON.stringify(essau, null, 1));
