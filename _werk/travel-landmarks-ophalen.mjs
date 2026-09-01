/* travel-landmarks-ophalen.mjs — zoekt de bestemmingen op die geen plaats zijn
 * (Westfield, de grens bij Amdallai, de stenencirkels van Wassu…) in
 * OpenStreetMap, zodat elk punt een id en een bron heeft in plaats van een
 * coördinaat uit het hoofd.
 *
 *   node _werk/travel-landmarks-ophalen.mjs   → _werk/travel-landmarks.json
 */
import { writeFile } from 'node:fs/promises';

const UA = 'MyKunda area audit/1.0 (admin@mykunda.com)';
const BBOX = '12.90,-17.20,14.30,-13.70';        // Gambia plus een rand Senegal
const slaap = ms => new Promise(r => setTimeout(r, ms));

const ZOEK = [
  ['Westfield',              'nwr[name~"Westfield",i]'],
  ['Banjul Int. Airport',    'nwr[aeroway=aerodrome]'],
  ['Brikama Craft Market',   'nwr[name~"craft",i][name~"brikama",i]'],
  ['Bakau market',           'nwr[amenity=marketplace][name~"bakau",i]'],
  ['Amdallai',               'nwr[name~"amdallai",i]'],
  ['Wassu stone circles',    'nwr[name~"wassu",i]'],
  ['Lamin Lodge',            'nwr[name~"lamin lodge",i]'],
  ['Senegambia bridge',      'nwr[name~"senegambia",i][bridge]'],
  ['UTG Faraba campus',      'nwr[name~"faraba",i]'],
  ['Bansang Hospital',       'nwr[name~"bansang",i][amenity~"hospital|clinic"]'],
  ['Kaolack',                'nwr[name="Kaolack"][place]'],
];

async function overpass(q) {
  const body = `[out:json][timeout:90];${q}(${BBOX});out tags center 12;`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(body),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
      if (r.ok) return (await r.json()).elements;
      console.log('   HTTP ' + r.status);
    } catch (e) { console.log('   ' + e.message); }
    await slaap(20000);
  }
  return [];
}

const uit = {};
for (const [naam, q] of ZOEK) {
  const els = await overpass(q);
  console.log(`${naam}: ${els.length} treffer(s)`);
  const kandidaten = els.map(e => ({
    osm: e.type + '/' + e.id,
    name: e.tags?.name || '(zonder naam)',
    lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon,
    tags: Object.fromEntries(Object.entries(e.tags || {}).filter(([k]) =>
      ['name', 'place', 'amenity', 'aeroway', 'barrier', 'historic', 'tourism', 'highway', 'bridge'].includes(k))),
  })).filter(k => k.lat != null);
  for (const k of kandidaten.slice(0, 6)) console.log('   ', k.osm, k.name, k.lat, k.lon, JSON.stringify(k.tags));
  uit[naam] = kandidaten;
  await slaap(4000);
}
await writeFile('_werk/travel-landmarks.json', JSON.stringify({
  source: 'OpenStreetMap contributors (ODbL 1.0), Overpass API',
  fetched: new Date().toISOString(), bbox: BBOX, results: uit }, null, 1));
console.log('\ngeschreven: _werk/travel-landmarks.json');
