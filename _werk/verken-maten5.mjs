/* verken-maten5.mjs — onderwijs als kandidaat-maat: dekking en samenhang */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const osm = await j('_werk/gambia-amenities.json');
const amen = await j('area-amenities.json');
const prijzen = await j('area-prices.json');

const R = 6371.0088, rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));

const isSchool = o => o.amenity === 'school' || o.amenity === 'college' || o.amenity === 'university' || o.amenity === 'kindergarten';
const ruw = osm.items.filter(isSchool).map(o => ({ lat: o.lat, lon: o.lon, naam: (o.name || '').toLowerCase().replace(/\s+/g, ' ').trim() }));

/* zelfde ontdubbelregel: zelfde naam binnen 250 m, naamloos binnen 40 m */
const uniek = [];
for (const p of ruw) {
  if (uniek.some(q => (p.naam ? q.naam === p.naam : !q.naam) && km(p.lat, p.lon, q.lat, q.lon) <= (p.naam ? 0.25 : 0.04))) continue;
  uniek.push(p);
}
console.log(`scholen in OSM: ${ruw.length} ruw, ${uniek.length} na ontdubbelen`);

const gebieden = Object.values(amen.areas);
const prijsPerSlug = new Map(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => [a.slug, a]));
const c = (g, ...ks) => ks.reduce((s, k) => s + (g.counts[k] || 0), 0);

const rijen = gebieden.map(g => ({
  naam: g.name,
  school: uniek.filter(p => km(g.lat, g.lon, p.lat, p.lon) <= 2).length || null,
  prijs: prijsPerSlug.get(g.slug)?.gmd_m2 ?? null,
  winkels: c(g, 'shop', 'supermarket', 'market') || null,
  eten: c(g, 'eat', 'bar') || null,
  zorg: c(g, 'health', 'pharmacy') || null,
}));

const kol = k => rijen.map(r => r[k]);
const nz = a => a.filter(x => x != null).sort((x, y) => x - y);
for (const k of ['school', 'prijs', 'winkels', 'eten', 'zorg']) {
  const v = nz(kol(k));
  console.log(`  ${k.padEnd(8)} ingevuld ${String(v.length).padStart(2)}/41  min ${v[0]}  med ${v[Math.floor(v.length / 2)]}  max ${v[v.length - 1]}`);
}

const rang = a => { const i = a.map((v, k) => [v, k]).filter(p => p[0] != null).sort((x, y) => x[0] - y[0]); const r = Array(a.length).fill(null); i.forEach((p, k) => r[p[1]] = k + 1); return r; };
const sp = (a, b) => { const ra = rang(a), rb = rang(b); const p = ra.map((x, i) => [x, rb[i]]).filter(q => q[0] != null && q[1] != null); const n = p.length; const ma = p.reduce((s, q) => s + q[0], 0) / n, mb = p.reduce((s, q) => s + q[1], 0) / n; let ab = 0, aa = 0, bb = 0; for (const [x, y] of p) { ab += (x - ma) * (y - mb); aa += (x - ma) ** 2; bb += (y - mb) ** 2; } return ab / Math.sqrt(aa * bb); };
console.log('\nsamenhang van onderwijs met de rest:');
for (const k of ['prijs', 'winkels', 'eten', 'zorg']) console.log(`  school vs ${k.padEnd(8)} ${sp(kol('school'), kol(k)).toFixed(2)}`);

console.log('\nper gebied (scholen binnen 2 km):');
for (const r of rijen.sort((a, b) => (b.school || 0) - (a.school || 0))) console.log(`  ${r.naam.padEnd(18)} ${String(r.school ?? '-').padStart(3)}`);
