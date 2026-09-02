/* verken-maten2.mjs — dekking en samenhang van kandidaat-maten */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const amen = await j('area-amenities.json');
const prijzen = await j('area-prices.json');
const feat = await j('area-features.json');
const reis = await j('area-travel.json');

const gebieden = Object.values(amen.areas);
const prijsPerSlug = new Map(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => [a.slug, a]));
const featPerSlug = new Map(Object.values(feat.areas ?? feat).map(a => [a.slug, a]));
const reisPerSlug = new Map(Object.values(reis.areas ?? reis).map(a => [a.slug, a]));

console.log('area-features bovenkant:', Object.keys(feat).join(', '));
console.log('voorbeeld feature:', JSON.stringify(featPerSlug.get(gebieden[0].slug)));
console.log('area-travel bovenkant:', Object.keys(reis).join(', '));
const r0 = reisPerSlug.get(gebieden[0].slug);
console.log('voorbeeld reis:', JSON.stringify(r0).slice(0, 500));

const c = (g, ...ks) => ks.reduce((s, k) => s + (g.counts[k] || 0), 0);
const kand = {
  prijs_gmd_m2: g => prijsPerSlug.get(g.slug)?.gmd_m2 ?? null,
  eten: g => c(g, 'eat', 'bar') || null,
  winkels: g => c(g, 'shop', 'supermarket', 'market') || null,
  zorg: g => c(g, 'health', 'pharmacy') || null,
  verblijf: g => c(g, 'stay') || null,
  geld: g => c(g, 'bank', 'atm', 'money') || null,
  brandstof: g => c(g, 'fuel') || null,
  vervoerpunt: g => c(g, 'transport', 'ferry') || null,
  gebed: g => c(g, 'mosque', 'church', 'worship') || null,
  kust_km: g => featPerSlug.get(g.slug)?.coast_km ?? null,
  rivier_km: g => featPerSlug.get(g.slug)?.river_km ?? null,
};

console.log('\ndekking kandidaten:');
const waarden = {};
for (const [naam, f] of Object.entries(kand)) {
  const v = gebieden.map(f);
  waarden[naam] = v;
  const nz = v.filter(x => x != null);
  console.log(`  ${naam.padEnd(14)} ingevuld ${String(nz.length).padStart(2)}/41   min ${Math.min(...nz)}   mediaan ${nz.slice().sort((a,b)=>a-b)[Math.floor(nz.length/2)]}   max ${Math.max(...nz)}`);
}

/* rangcorrelatie (Spearman) tussen kandidaten, alleen waar beide ingevuld */
const rang = arr => { const idx = arr.map((v,i)=>[v,i]).filter(p=>p[0]!=null).sort((a,b)=>a[0]-b[0]); const r=Array(arr.length).fill(null); idx.forEach((p,k)=>r[p[1]]=k+1); return r; };
const spearman = (a, b) => {
  const ra = rang(a), rb = rang(b);
  const paren = ra.map((x,i)=>[x,rb[i]]).filter(p=>p[0]!=null&&p[1]!=null);
  const n = paren.length; if (n < 8) return null;
  const ma = paren.reduce((s,p)=>s+p[0],0)/n, mb = paren.reduce((s,p)=>s+p[1],0)/n;
  let sab=0, sa=0, sb=0;
  for (const [x,y] of paren){ sab+=(x-ma)*(y-mb); sa+=(x-ma)**2; sb+=(y-mb)**2; }
  return sab/Math.sqrt(sa*sb);
};
const namen = Object.keys(kand);
console.log('\nrangcorrelatie (Spearman) tussen kandidaten:');
console.log('               ' + namen.map(n=>n.slice(0,6).padStart(7)).join(''));
for (const a of namen) {
  console.log('  ' + a.padEnd(13) + namen.map(b => { const s = spearman(waarden[a], waarden[b]); return (s==null?'   .  ':s.toFixed(2)).padStart(7); }).join(''));
}
