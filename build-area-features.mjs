/* build-area-features.mjs — meet de afstand van elk gebied tot de Atlantische
 * kust en tot de Gambia-rivier, voor de tegels in de kopstrook die tot
 * 01-09-2026 een verzonnen looptijd toonden ("Beach 5 min on foot").
 *
 *   node build-area-features.mjs            toont wat eruit komt
 *   node build-area-features.mjs --write    schrijft area-features.json
 *
 * Hemelsbreed, niet over de weg: een strand bereik je niet via een route maar
 * door de straat uit te lopen, en er is geen pad naar "de kust" om te
 * routeren. Dat staat er ook bij op de pagina.
 *
 * Let op de estuariumval: OpenStreetMap laat natural=coastline doorlopen tot
 * ver in de monding, dus Banjul en Barra krijgen een "kust" van 0,35 km die
 * gewoon de rivier is. Daarom bepaalt het opschrift van de tegel welke van de
 * twee maten wordt gebruikt, niet de kleinste.
 */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const k = JSON.parse(await readFile('_werk/kustlijn.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));

const R = 6371.0088, rad = d => d * Math.PI / 180;
const km = (a, b, c, d) => {
  const x = Math.sin(rad(c - a) / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const dichtst = (lat, lon, pts) => {
  let best = Infinity;
  for (const [a, b] of pts) { const d = km(lat, lon, a, b); if (d < best) best = d; }
  return +best.toFixed(2);
};

const gebieden = {};
for (const g of Object.values(amen.areas)) {
  gebieden[g.name.toLowerCase()] = {
    slug: g.slug, name: g.name,
    coast_km: dichtst(g.lat, g.lon, k.coast),
    river_km: dichtst(g.lat, g.lon, k.river),
  };
  console.log(`  ${g.name.padEnd(18)} kust ${String(gebieden[g.name.toLowerCase()].coast_km).padStart(7)} km   ` +
    `rivier ${String(gebieden[g.name.toLowerCase()].river_km).padStart(7)} km`);
}

const uit = {
  about: 'Afstand tot de Atlantische kust en tot de Gambia-rivier, hemelsbreed. Voor de tegels in de kopstrook.',
  built: new Date().toISOString().slice(0, 10),
  method: 'Kortste afstand tot een punt op natural=coastline respectievelijk waterway=river in OpenStreetMap, ' +
    'hemelsbreed vanaf het punt in de JSON-LD van de pagina.',
  source: k.source + ' — opgehaald ' + k.fetched.slice(0, 10),
  areas: gebieden,
};
if (WRITE) { await writeFile('area-features.json', JSON.stringify(uit, null, 1)); console.log('\ngeschreven: area-features.json'); }
else console.log('\nDraai opnieuw met --write om area-features.json te schrijven.');
