/* build-area-travel.mjs — bouwt area-travel.json voor het blok "Getting around".
 *
 *   node build-area-travel.mjs            toont wat eruit komt
 *   node build-area-travel.mjs --write    schrijft area-travel.json
 *
 * Tot 01-09-2026 stonden hier 200 handgeschreven reistijden over 40 pagina's,
 * in 38 verschillende notaties ("2 hrs", "2 hr", "1 hr 30", "5–6 hrs"), zonder
 * bron. Ze spraken elkaar ook tegen: Bakau zei 45 minuten naar de luchthaven,
 * Kotu 35 en Serrekunda 20, terwijl die drie een paar kilometer uit elkaar
 * liggen.
 *
 * WAT HIER WEL EN NIET GEMETEN WORDT. De afstand over de weg is te meten:
 * OSRM rekent hem uit over het OpenStreetMap-wegennet, inclusief de veerboot
 * Banjul–Barra, die het als aparte stap teruggeeft. De reisTIJD niet: OSRM
 * rijdt de getagde maximumsnelheid zonder verkeer, en komt daardoor op tien
 * minuten voor Serrekunda–Banjul waar de pagina er 25 zei en de praktijk in de
 * spits meer vraagt. En de veerboot krijgt een modelsnelheid van 5 km/u, dus
 * 59 minuten voor een overtocht die zonder wachten 35 duurt — het wachten is
 * juist het punt. Een tijd die we niet kunnen verdedigen is erger dan geen
 * tijd, dus dit blok toont voortaan afstand, en zegt erbij wanneer de route
 * over de veerboot gaat.
 *
 * Bestemmingen worden opgezocht in gambia-places.js en in
 * _werk/travel-landmarks.json (uit OpenStreetMap, met id). Wat daar niet in
 * staat — "Atlantic beach", "River jetty", "Senegal border" — is geen punt en
 * krijgt geen regel. Elke pagina wordt daarna aangevuld tot minstens drie
 * regels met Banjul, de luchthaven en Westfield.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const UA = 'MyKunda area audit/1.0 (admin@mykunda.com)';
const CACHE = '_werk/osrm-cache.json';
const slaap = ms => new Promise(r => setTimeout(r, ms));

/* Handmatig nagelopen treffers uit _werk/travel-landmarks.json. Alles wat daar
   geen eenduidige treffer had staat hier bewust NIET in: "Amdallai" leverde
   Hamdallai in Upper River op (een andere plaats), "Brikama Craft Market" nul
   treffers en "UTG Faraba campus" alleen dorpen die Faraba heten. */
const LANDMARKS = {
  'westfield':            { lat: 13.4451154, lon: -16.6755628, osm: 'way/761858141' },
  'banjul int airport':   { lat: 13.3361095, lon: -16.6505521, osm: 'way/109445333' },
  'banjul international airport': { lat: 13.3361095, lon: -16.6505521, osm: 'way/109445333' },
  'bakau market fish landing':    { lat: 13.4810168, lon: -16.6760725, osm: 'node/12509527077' },
  'wassu stone circles':  { lat: 13.6917733, lon: -14.873088, osm: 'way/421696680' },
  'lamin lodge':          { lat: 13.3936352, lon: -16.6244541, osm: 'node/2076484642' },
  'senegambia bridge':    { lat: 13.5161936, lon: -15.5723622, osm: 'way/539520356' },
  'bansang hospital':     { lat: 13.4449473, lon: -14.6660297, osm: 'way/243107254' },
  'kaolack':              { lat: 14.138815,  lon: -16.076391,  osm: 'node/3329033430' },
};

/* Schrijfwijzen die op de pagina's afwijken van gambia-places.js. */
const ALIAS = { 'mansakonko': 'mansa konko' };

const plaatsSrc = await readFile('gambia-places.js', 'utf8');
const PLAATSEN = new Map();
for (const m of plaatsSrc.matchAll(/\['([^']+)','[^']*',([-\d.]+),([-\d.]+)\]/g))
  PLAATSEN.set(m[1].toLowerCase(), { lat: +m[2], lon: +m[3], osm: 'gambia-places.js', name: m[1] });

const norm = s => s.toLowerCase()
  .replace(/\s*\((.*?)\)\s*/g, ' ')
  .replace(/[^a-z\s/-]/g, ' ').replace(/\s+/g, ' ').trim();

/* Ontdoet een label van de woorden die het tot een detail maken, zodat
   "Barra ferry terminal" bij de plaats Barra uitkomt. */
const kaal = s => norm(s)
  .replace(/\b(ferry terminal|ferry crossing|ferry|beach|market|fish landing|city centre|centre|junction|strip|int airport|international airport|airport|border|highway|road|bolong|jetty|bank|lodge|campus|capital|hospital|stone circles|bridge|craft)\b/g, '')
  .replace(/\s+/g, ' ').trim();

function zoekPunt(label) {
  const n = norm(label);
  if (LANDMARKS[n.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()]) return LANDMARKS[n.replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()];
  const nk = n.replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (LANDMARKS[nk]) return LANDMARKS[nk];
  for (const rauw of n.split('/').map(s => s.trim())) {
    const deel = ALIAS[rauw] || rauw;
    if (PLAATSEN.has(deel)) return PLAATSEN.get(deel);
    const k = kaal(deel);
    if (k && PLAATSEN.has(k)) return PLAATSEN.get(k);
    if (k && LANDMARKS[k]) return LANDMARKS[k];
  }
  return null;
}

/* ── OSRM, met cache ─────────────────────────────────────────────────────── */
let cache = existsSync(CACHE) ? JSON.parse(await readFile(CACHE, 'utf8')) : {};
let nieuw = 0;
async function rijden(a, b) {
  const k = `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
  if (cache[k]) return cache[k];
  const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=true`;
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) {
        const j = await r.json();
        if (j.code !== 'Ok') return null;
        const rt = j.routes[0];
        const stappen = rt.legs.flatMap(l => l.steps);
        const veer = stappen.filter(s => s.mode === 'ferry');
        const uit = {
          km: +(rt.distance / 1000).toFixed(2),
          ferry: veer.length ? (veer[0].name || 'ferry') : null,
          ferry_km: +(veer.reduce((n, s) => n + s.distance, 0) / 1000).toFixed(2),
        };
        cache[k] = uit; nieuw++;
        await slaap(1100);                       // de publieke OSRM-server vraagt om rust
        return uit;
      }
    } catch (e) { /* opnieuw */ }
    await slaap(4000);
  }
  return null;
}

/* ── bouwen ──────────────────────────────────────────────────────────────── */
const dump = JSON.parse(await readFile('_werk/commutes-dump.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const perSlug = new Map(Object.values(amen.areas).map(g => [g.slug, g]));

const STANDAARD = ['Banjul', 'Banjul International Airport', 'Westfield'];
const gebieden = {};
const nietGevonden = new Map();

for (const pag of dump) {
  const slug = pag.file.replace(/\.html$/, '');
  const g = perSlug.get(slug);
  if (!g) continue;
  const start = { lat: g.lat, lon: g.lon };
  const rijen = [];
  const gezien = new Set();

  const labels = pag.rijen.map(r => r[0]);
  for (const label of [...labels, ...STANDAARD]) {
    if (rijen.length >= 5) break;
    const punt = zoekPunt(label);
    if (!punt) { nietGevonden.set(label, (nietGevonden.get(label) || 0) + 1); continue; }
    const sleutel = punt.lat.toFixed(4) + ',' + punt.lon.toFixed(4);
    if (gezien.has(sleutel)) continue;
    if (Math.abs(punt.lat - g.lat) < 1e-4 && Math.abs(punt.lon - g.lon) < 1e-4) continue;  // zichzelf
    const rt = await rijden(start, punt);
    if (!rt) { nietGevonden.set(label + ' (geen route)', (nietGevonden.get(label) || 0) + 1); continue; }
    gezien.add(sleutel);
    const mode = rt.ferry ? (rt.km - rt.ferry_km < 1 ? 'Ferry' : 'Car + ferry')
               : (rt.km <= 1.2 ? 'Walk' : 'Car');
    /* Een label dat de veerboot noemt terwijl de route er geen gebruikt, spreekt
       de moduskolom tegen — "Banjul (ferry)" met "Car" ernaast. Zo'n label wordt
       de naam van het punt zelf. Een veerhaven als bestemming blijft staan: dat
       is een plek, geen route-omschrijving. */
    const noemtVeer = /ferry/i.test(label) && !/ferry (terminal|crossing)/i.test(label);
    const to = (!rt.ferry && noemtVeer && punt.name) ? punt.name : label;
    rijen.push({ to, mode, km: rt.km, ferry: rt.ferry, point: punt.osm, label_was: to === label ? undefined : label });
  }
  gebieden[g.name.toLowerCase()] = { slug, name: g.name, lat: g.lat, lon: g.lon, rows: rijen };
  console.log(`  ${g.name.padEnd(18)} ${rijen.length} regels — ` +
    rijen.map(r => `${r.to} ${r.km} km${r.ferry ? ' (veer)' : ''}`).join(' · '));
}

await writeFile(CACHE, JSON.stringify(cache));
const uit = {
  about: 'Afstand over de weg per gebied voor het blok "Getting around". Geen reistijd: zie de kop van build-area-travel.mjs.',
  built: new Date().toISOString().slice(0, 10),
  method: 'Kortste route over het OpenStreetMap-wegennet (OSRM, profiel car), vanaf het punt in de JSON-LD van de pagina. ' +
    'Een route die de veerboot Banjul–Barra gebruikt wordt als zodanig gemeld.',
  sources: { routing: 'OSRM demo server op het OpenStreetMap-wegennet', points: 'gambia-places.js en OpenStreetMap (_werk/travel-landmarks.json)' },
  areas: gebieden,
};
console.log(`\ngebieden: ${Object.keys(gebieden).length}; nieuwe routeringen deze run: ${nieuw}`);
if (nietGevonden.size) {
  console.log('bestemmingen zonder punt (regel vervalt):');
  console.log('  ' + [...nietGevonden].map(([k, v]) => `${k} (${v}x)`).join(' · '));
}
if (WRITE) { await writeFile('area-travel.json', JSON.stringify(uit, null, 1)); console.log('geschreven: area-travel.json'); }
else console.log('Draai opnieuw met --write om area-travel.json te schrijven.');
