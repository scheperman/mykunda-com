/* verken-maten3.mjs — kandidaat-set doorrekenen: dekking, samenhang, volledigheid */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const amen = await j('area-amenities.json');
const prijzen = await j('area-prices.json');
const feat = await j('area-features.json');
const reis = await j('area-travel.json');

const gebieden = Object.values(amen.areas);
const prijsPerSlug = new Map(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => [a.slug, a]));
const featPerSlug = new Map(Object.values(feat.areas).map(a => [a.slug, a]));
const reisPerSlug = new Map(Object.values(reis.areas).map(a => [a.slug, a]));

const c = (g, ...ks) => ks.reduce((s, k) => s + (g.counts[k] || 0), 0);
const banjul = g => { const r = reisPerSlug.get(g.slug); const rij = r && r.rows.find(x => /^banjul$/i.test(x.to)); return rij ? rij.km : null; };

const kand = {
  prijs: g => prijsPerSlug.get(g.slug)?.gmd_m2 ?? null,
  winkels: g => c(g, 'shop', 'supermarket', 'market') || null,
  eten: g => c(g, 'eat', 'bar') || null,
  zorg: g => c(g, 'health', 'pharmacy') || null,
  vervoer: g => c(g, 'fuel', 'transport', 'ferry') || null,
  kust: g => featPerSlug.get(g.slug)?.coast_km ?? null,
  rivier: g => featPerSlug.get(g.slug)?.river_km ?? null,
  banjul_km: banjul,
};
const waarden = {}; for (const [n, f] of Object.entries(kand)) waarden[n] = gebieden.map(f);

console.log('dekking:');
for (const [n, v] of Object.entries(waarden)) {
  const nz = v.filter(x => x != null).sort((a, b) => a - b);
  console.log(`  ${n.padEnd(10)} ${String(nz.length).padStart(2)}/41  min ${nz[0]}  med ${nz[Math.floor(nz.length/2)]}  max ${nz[nz.length-1]}`);
}

const rang = a => { const i = a.map((v, k) => [v, k]).filter(p => p[0] != null).sort((x, y) => x[0] - y[0]); const r = Array(a.length).fill(null); i.forEach((p, k) => r[p[1]] = k + 1); return r; };
const sp = (a, b) => { const ra = rang(a), rb = rang(b); const p = ra.map((x, i) => [x, rb[i]]).filter(q => q[0] != null && q[1] != null); const n = p.length; if (n < 8) return null; const ma = p.reduce((s, q) => s + q[0], 0) / n, mb = p.reduce((s, q) => s + q[1], 0) / n; let ab = 0, aa = 0, bb = 0; for (const [x, y] of p) { ab += (x - ma) * (y - mb); aa += (x - ma) ** 2; bb += (y - mb) ** 2; } return ab / Math.sqrt(aa * bb); };
const N = Object.keys(kand);
console.log('\nrangcorrelatie:');
console.log('             ' + N.map(n => n.slice(0, 6).padStart(8)).join(''));
for (const a of N) console.log('  ' + a.padEnd(11) + N.map(b => { const s = sp(waarden[a], waarden[b]); return (s == null ? '  .' : s.toFixed(2)).padStart(8); }).join(''));

console.log('\nvolledigheid van de set {prijs, winkels, eten, zorg, vervoer}:');
const set = ['prijs', 'winkels', 'eten', 'zorg', 'vervoer'];
const tel = {};
gebieden.forEach((g, i) => { const k = set.filter(s => waarden[s][i] != null).length; tel[k] = (tel[k] || 0) + 1; });
for (const k of Object.keys(tel).sort((a, b) => b - a)) console.log(`  ${k} ringen: ${tel[k]} gebieden`);
console.log('  gebieden met minder dan 5:');
gebieden.forEach((g, i) => { const ont = set.filter(s => waarden[s][i] == null); if (ont.length) console.log(`    ${g.name.padEnd(18)} mist ${ont.join(', ')}`); });

console.log('\nvolledigheid met kust erbij i.p.v. vervoer:');
const set2 = ['prijs', 'winkels', 'eten', 'zorg', 'kust'];
const tel2 = {}; gebieden.forEach((g, i) => { const k = set2.filter(s => waarden[s][i] != null).length; tel2[k] = (tel2[k] || 0) + 1; });
for (const k of Object.keys(tel2).sort((a, b) => b - a)) console.log(`  ${k} ringen: ${tel2[k]} gebieden`);
