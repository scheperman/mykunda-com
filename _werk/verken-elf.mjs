/* verken-elf.mjs — wat zouden de elf pagina's zonder blok krijgen?
   Zelfde categorieregels, straal en ontdubbeling als build-area-amenities.mjs. */
import { readFile } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const osm = await j('_werk/gambia-amenities.json');
const amen = await j('area-amenities.json');
const prijzen = await j('area-prices.json');
const R = 6371.0088, rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));

function categorieen(o) {
  const a = o.amenity, s = o.shop, h = o.healthcare, t = o.tourism, l = o.leisure, of = o.office, uit = new Set();
  if (a === 'hospital' || h === 'hospital' || a === 'clinic' || a === 'doctors' || h === 'clinic' || h === 'doctor' || h === 'centre') uit.add('health');
  if (a === 'pharmacy' || h === 'pharmacy' || s === 'chemist') uit.add('pharmacy');
  if (a === 'marketplace') uit.add('market');
  if (s === 'supermarket') uit.add('supermarket');
  if (s && s !== 'supermarket' && s !== 'chemist') uit.add('shop');
  if (a === 'restaurant' || a === 'fast_food' || a === 'cafe' || a === 'ice_cream') uit.add('eat');
  if (a === 'bar' || a === 'pub' || a === 'nightclub') uit.add('bar');
  return uit;
}
const ruw = osm.items.map(o => ({ lat: o.lat, lon: o.lon, naam: (o.name || '').toLowerCase().replace(/\s+/g, ' ').trim(), cats: categorieen(o) })).filter(p => p.cats.size);
const punten = [];
const perCat = new Map();
for (const p of ruw) for (const c of p.cats) {
  const lijst = perCat.get(c) || [];
  const grens = p.naam ? 0.25 : 0.04;
  if (lijst.some(q => (p.naam ? q.naam === p.naam : !q.naam) && km(p.lat, p.lon, q.lat, q.lon) <= grens)) continue;
  lijst.push({ naam: p.naam, lat: p.lat, lon: p.lon }); perCat.set(c, lijst);
  punten.push({ cat: c, lat: p.lat, lon: p.lon });
}

const metBlok = new Set(Object.values(amen.areas).map(g => g.slug));
const zonder = Object.values(prijzen.areas).filter(a => a && a.slug && !metBlok.has(a.slug));
const GROEP = { 'Everyday shopping': ['shop', 'supermarket', 'market'], 'Places to eat': ['eat', 'bar'], Healthcare: ['health', 'pharmacy'] };

console.log('gebied           lat/lon uit de pagina        shops  eat  zorg   nauwkeurigheid van de pin');
for (const a of zonder) {
  const src = await readFile(a.slug + '.html', 'utf8');
  const geo = src.match(/"latitude":\s*([-\d.]+),\s*"longitude":\s*([-\d.]+)/);
  if (!geo) { console.log(`  ${a.slug.padEnd(15)} GEEN COORDINAAT`); continue; }
  const lat = +geo[1], lon = +geo[2];
  const tel = {};
  for (const p of punten) { if (km(lat, lon, p.lat, p.lon) <= 2) tel[p.cat] = (tel[p.cat] || 0) + 1; }
  const n = Object.fromEntries(Object.entries(GROEP).map(([k, ks]) => [k, ks.reduce((s, x) => s + (tel[x] || 0), 0)]));
  /* wat zegt de pagina zelf over de nauwkeurigheid van haar pin? */
  const pin = src.match(/(within|about|roughly|±|approximate[^.]{0,80})[^.]{0,90}(m\b|metres|km)[^.]{0,40}\./i);
  console.log(`  ${a.slug.padEnd(15)} ${String(lat).padStart(8)}, ${String(lon).padStart(9)}   ` +
    `${String(n['Everyday shopping']).padStart(5)} ${String(n['Places to eat']).padStart(4)} ${String(n.Healthcare).padStart(5)}   ` +
    (pin ? pin[0].slice(0, 90) : '-'));
}
