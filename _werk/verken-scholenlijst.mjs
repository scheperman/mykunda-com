/* verken-scholenlijst.mjs — spreekt een OSM-schoolteller de genoemde lijst tegen? */
import { readFile, readdir } from 'node:fs/promises';
const j = async p => JSON.parse(await readFile(p, 'utf8'));

const osm = await j('_werk/gambia-amenities.json');
const amen = await j('area-amenities.json');
const R = 6371.0088, rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => 2 * R * Math.asin(Math.sqrt(Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2));
const isSchool = o => ['school', 'college', 'university', 'kindergarten'].includes(o.amenity);
const ruw = osm.items.filter(isSchool).map(o => ({ lat: o.lat, lon: o.lon, naam: (o.name || '').toLowerCase().replace(/\s+/g, ' ').trim() }));
const uniek = [];
for (const p of ruw) if (!uniek.some(q => (p.naam ? q.naam === p.naam : !q.naam) && km(p.lat, p.lon, q.lat, q.lon) <= (p.naam ? 0.25 : 0.04))) uniek.push(p);

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
console.log('gebied              genoemd  OSM<=2km   OSM<=5km');
let tegen = 0, totaal = 0;
for (const g of Object.values(amen.areas)) {
  const src = await readFile(g.slug + '.html', 'utf8');
  /* het schoolblok: verzamel de regels tussen de kop en het einde van de lijst */
  const blok = src.match(/Schools (?:nearby|&amp; campus)|International schools/) ? src : null;
  const m = src.match(/(?:var|const)\s+schools\s*=\s*(\[[\s\S]*?\]);/);
  let genoemd = null;
  if (m) { try { genoemd = eval(m[1]).length; } catch { genoemd = null; } }
  const n2 = uniek.filter(p => km(g.lat, g.lon, p.lat, p.lon) <= 2).length;
  const n5 = uniek.filter(p => km(g.lat, g.lon, p.lat, p.lon) <= 5).length;
  console.log(`  ${g.name.padEnd(18)} ${String(genoemd ?? '?').padStart(4)}   ${String(n2).padStart(6)}   ${String(n5).padStart(8)}`);
  if (genoemd != null) { totaal++; if (genoemd > n2) tegen++; }
}
console.log(`\ngebieden waar de genoemde lijst langer is dan de OSM-telling binnen 2 km: ${tegen} van ${totaal}`);
