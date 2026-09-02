/* verken-maten.mjs — welke meetbare maten hebben genoeg dekking voor een ring? */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const amen = await j('area-amenities.json');
const gebieden = Object.values(amen.areas);
console.log('bovenkant area-amenities.json:', Object.keys(amen).join(', '));
console.log('radius_km:', amen.radius_km, '| gebieden:', gebieden.length);
console.log('\nvoorbeeldgebied:\n' + JSON.stringify(gebieden[0], null, 1).slice(0, 1200));

const sleutels = new Set();
for (const g of gebieden) for (const k of Object.keys(g.counts || {})) sleutels.add(k);
console.log('\ncategorieen in counts:', [...sleutels].join(', '));

console.log('\ndekking per categorie (aantal gebieden met n>0, totaal, mediaan, max):');
for (const k of sleutels) {
  const v = gebieden.map(g => g.counts[k] || 0);
  const nz = v.filter(n => n > 0).sort((a, b) => a - b);
  const med = nz.length ? nz[Math.floor(nz.length / 2)] : 0;
  console.log(`  ${k.padEnd(14)} n>0: ${String(nz.length).padStart(2)}/${gebieden.length}   som ${String(v.reduce((a, b) => a + b, 0)).padStart(4)}   mediaan ${String(med).padStart(3)}   max ${Math.max(...v)}`);
}
