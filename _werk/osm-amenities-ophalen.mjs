/* osm-amenities-ophalen.mjs — haalt alle voorzieningen van Gambia uit OpenStreetMap
 * via Overpass en schrijft ze plat weg als _werk/gambia-amenities.json.
 *   node _werk/osm-amenities-ophalen.mjs
 * Per tag-sleutel een aparte vraag (de hele set in een keer loopt op een timeout),
 * met een cache per sleutel in _werk/osm-cache/ zodat een herstart niet alles
 * opnieuw ophaalt. Een sleutel die blijft weigeren wordt overgeslagen en gemeld.
 * Alleen lezen; raakt geen sitepagina aan.
 */
import { writeFile, readFile, mkdir } from 'node:fs/promises';

const BBOX = '13.00,-17.10,13.90,-13.70';
const KEYS = ['amenity', 'shop', 'healthcare', 'tourism', 'leisure', 'office', 'craft'];
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const UA = 'MyKunda area audit/1.0 (admin@mykunda.com)';
const slaap = ms => new Promise(r => setTimeout(r, ms));
await mkdir('_werk/osm-cache', { recursive: true });

async function haal(key) {
  const cache = `_werk/osm-cache/${key}.json`;
  try { const c = JSON.parse(await readFile(cache, 'utf8')); console.log(`  ${key}: ${c.length} uit cache`); return c; } catch {}
  const q = `[out:json][timeout:180];nwr[${key}](${BBOX});out tags center;`;
  for (let poging = 0; poging < 9; poging++) {
    const url = MIRRORS[poging % MIRRORS.length];
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
      if (r.ok) {
        const j = await r.json();
        await writeFile(cache, JSON.stringify(j.elements));
        console.log(`  ${key}: ${j.elements.length} via ${new URL(url).host}`);
        return j.elements;
      }
      console.log(`  ${key}: HTTP ${r.status} bij ${new URL(url).host}`);
    } catch (e) { console.log(`  ${key}: ${e.message}`); }
    await slaap(25000);
  }
  console.log(`  ${key}: OVERGESLAGEN — geen server gaf antwoord`);
  return null;
}

const TAGS = ['name', 'name:en', 'amenity', 'shop', 'healthcare', 'tourism', 'leisure', 'office',
  'craft', 'religion', 'denomination', 'isced:level', 'school', 'operator', 'brand', 'atm',
  'opening_hours', 'emergency', 'government', 'man_made', 'building', 'cuisine'];

const gezien = new Set(); const items = []; const gelukt = []; const mislukt = [];
for (const k of KEYS) {
  const els = await haal(k);
  if (!els) { mislukt.push(k); continue; }
  gelukt.push(k);
  for (const e of els) {
    const sleutel = e.type + e.id; if (gezien.has(sleutel)) continue; gezien.add(sleutel);
    const t = e.tags || {};
    const o = { t: e.type[0], id: e.id, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon };
    for (const tag of TAGS) if (t[tag] != null) o[tag.replace(':', '_')] = t[tag];
    if (o.lat != null) items.push(o);
  }
  await slaap(3000);
}

await writeFile('_werk/gambia-amenities.json', JSON.stringify({
  source: 'OpenStreetMap contributors (ODbL 1.0), Overpass API',
  fetched: new Date().toISOString(), bbox: BBOX, keys: gelukt, keys_failed: mislukt,
  count: items.length, items,
}));
console.log('weggeschreven: _werk/gambia-amenities.json —', items.length, 'objecten');
if (mislukt.length) console.log('niet opgehaald:', mislukt.join(', '));
