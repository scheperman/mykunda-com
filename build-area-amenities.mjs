/* build-area-amenities.mjs — bouwt area-amenities.json uit de OSM-meting en
 * het register van het ministerie van Volksgezondheid.
 *
 *   node build-area-amenities.mjs            toont wat eruit komt
 *   node build-area-amenities.mjs --write    schrijft area-amenities.json
 *
 * Invoer:
 *   _werk/gambia-amenities.json          alle voorzieningen van Gambia uit OSM
 *                                        (_werk/osm-amenities-ophalen.mjs)
 *   _werk/moh-register-2026-09-01.json   zorgvoorzieningen uit het register
 *   de gebiedspagina's zelf              voor het meetpunt (JSON-LD) en de naam
 *
 * Zelfde afspraken als area-prices.json: sleutel met een spatie ('cape point'),
 * streepje in `slug`, en per gebied een bewijsklasse — `osm`, `osm+register`
 * of `none`.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const STRAAL_KM = 2;

/* ── categorieën ───────────────────────────────────────────────────────────
   `groep` bepaalt de voorrang: uit health en daily komt de hoogste categorie
   altijd in het rooster, ook als hij op aantal afvalt.
   Scholen staan hier bewust NIET in: die hebben een eigen blok op de pagina
   ("Schools nearby"), en de tegel sprak dat blok op zestien pagina's tegen. */
const CATS = [
  ['health',      'health', 'Clinic or hospital',  'Clinics & hospitals'],
  ['pharmacy',    'health', 'Pharmacy',            'Pharmacies'],
  ['market',      'daily',  'Market',              'Markets'],
  ['supermarket', 'daily',  'Supermarket',         'Supermarkets'],
  ['shop',        'daily',  'Shop',                'Shops & bitiks'],
  ['bank',        'money',  'Bank',                'Banks'],
  ['atm',         'money',  'ATM',                 'ATMs'],
  ['money',       'money',  'Money transfer',      'Money transfer'],
  ['fuel',        'move',   'Fuel station',        'Fuel stations'],
  ['ferry',       'move',   'Ferry terminal',      'Ferry terminals'],
  ['transport',   'move',   'Bus or taxi rank',    'Bus & taxi ranks'],
  ['mosque',      'faith',  'Mosque',              'Mosques'],
  ['church',      'faith',  'Church',              'Churches'],
  ['worship',     'faith',  'Place of worship',    'Places of worship'],
  ['eat',         'out',    'Restaurant or café',  'Restaurants & cafés'],
  ['bar',         'out',    'Bar',                 'Bars'],
  ['stay',        'out',    'Hotel or guesthouse', 'Hotels & guesthouses'],
  ['police',      'civic',  'Police station',      'Police stations'],
  ['post',        'civic',  'Post office',         'Post offices'],
  ['gov',         'civic',  'Government office',   'Government offices'],
  ['library',     'civic',  'Library',             'Libraries'],
  ['reserve',     'civic',  'Nature reserve',      'Nature reserves'],
];
const CAT = new Map(CATS.map(c => [c[0], { groep: c[1], een: c[2], meer: c[3] }]));

/* ── telregels ────────────────────────────────────────────────────────────
   Vijf regels, elk omdat de ruwe telling er anders naast zat:
   1  chalet en apartment tellen niet als logies — 28 losse chalets van één
      resort maakten er in Bakoteh 41 van;
   2  shop=yes telt als winkel, nooit als supermarkt;
   3  leisure=pitch valt buiten het rooster (een voetbalveldje is geen voorziening);
   4  een gebedshuis zonder religie-tag wordt geen moskee maar 'place of worship';
   5  ziekenhuis en kliniek gaan op één hoop. In Gambia draagt in OSM van
      alles amenity=hospital — "Basse health centre", "mbowen clinic",
      "Lamtoro Clinic". Vijf ziekenhuizen in Basse beweren is onjuist;
      "5 Clinics & hospitals" klopt wel. */
function categorieen(o) {
  const a = o.amenity, s = o.shop, h = o.healthcare, t = o.tourism,
        l = o.leisure, of = o.office, uit = new Set();
  if (a === 'hospital' || h === 'hospital' || a === 'clinic' || a === 'doctors' ||
      h === 'clinic' || h === 'doctor' || h === 'centre') uit.add('health');
  if (a === 'pharmacy' || h === 'pharmacy' || s === 'chemist') uit.add('pharmacy');
  if (a === 'marketplace') uit.add('market');
  if (s === 'supermarket') uit.add('supermarket');
  if (s && s !== 'supermarket' && s !== 'chemist') uit.add('shop');
  if (a === 'bank') uit.add('bank');
  if (a === 'atm') uit.add('atm');
  if (a === 'money_transfer' || a === 'bureau_de_change' || of === 'financial') uit.add('money');
  if (a === 'fuel') uit.add('fuel');
  if (a === 'ferry_terminal') uit.add('ferry');
  if (a === 'bus_station' || a === 'taxi') uit.add('transport');
  if (a === 'place_of_worship') {
    uit.add(o.religion === 'muslim' ? 'mosque' : o.religion === 'christian' ? 'church' : 'worship');
  }
  if (a === 'restaurant' || a === 'fast_food' || a === 'cafe' || a === 'ice_cream') uit.add('eat');
  if (a === 'bar' || a === 'pub' || a === 'nightclub') uit.add('bar');
  if (t === 'hotel' || t === 'guest_house' || t === 'hostel' || t === 'motel') uit.add('stay');
  if (a === 'police') uit.add('police');
  if (a === 'post_office') uit.add('post');
  if (a === 'townhall' || of === 'government') uit.add('gov');
  if (a === 'library') uit.add('library');
  if (l === 'nature_reserve') uit.add('reserve');
  return uit;
}

const R = 6371.0088;
const rad = d => d * Math.PI / 180;
function km(a, b, c, d) {
  const x = Math.sin(rad(c - a) / 2) ** 2 +
            Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(rad(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* ── dubbeltellingen eruit ────────────────────────────────────────────────
   Een voorziening staat in OSM vaak twee keer: een punt binnenin én het
   gebouw eromheen. Ze hebben verschillende ids, dus id-ontdubbelen helpt
   niet. Zelfde categorie + zelfde naam binnen 250 m is één voorziening;
   zonder naam is de grens 40 m, want dan is naamgelijkheid geen bewijs. */
function ontdubbel(punten) {
  const uit = [];
  const perCat = new Map();
  for (const p of punten) {
    for (const c of p.cats) {
      const naam = (p.naam || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const lijst = perCat.get(c) || [];
      const grens = naam ? 0.25 : 0.04;
      const dubbel = lijst.some(q =>
        (naam ? q.naam === naam : !q.naam) && km(p.lat, p.lon, q.lat, q.lon) <= grens);
      if (dubbel) continue;
      lijst.push({ naam, lat: p.lat, lon: p.lon });
      perCat.set(c, lijst);
      uit.push({ cat: c, lat: p.lat, lon: p.lon, naam });
    }
  }
  return uit;
}

/* ── invoer ── */
const osm = JSON.parse(await readFile('_werk/gambia-amenities.json', 'utf8'));
const reg = JSON.parse(await readFile('_werk/moh-register-2026-09-01.json', 'utf8'));
const ruw = osm.items.map(o => ({ lat: o.lat, lon: o.lon, naam: o.name, cats: categorieen(o) }))
                     .filter(p => p.cats.size);
const punten = ontdubbel(ruw);
console.log(`OSM: ${osm.items.length} objecten, ${ruw.reduce((n, p) => n + p.cats.size, 0)} categorie-treffers, ` +
            `na ontdubbelen ${punten.length}`);

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
const gebieden = {};
let zonderBlok = 0;

for (const f of files) {
  const src = await readFile(f, 'utf8');
  const naam = src.match(/"@type":"Place","name":"([^",]+), The Gambia"/);
  if (!naam) continue;
  if (!/var amenData=/.test(src) && !/const amen=/.test(src)) { zonderBlok++; continue; }
  const geo = src.match(/"latitude":([-\d.]+),"longitude":([-\d.]+)/);
  if (!geo) { console.log(`  ${f}: geen JSON-LD-coördinaat — OVERGESLAGEN`); continue; }
  const lat = +geo[1], lon = +geo[2];

  const telling = {};
  for (const p of punten) {
    if (Math.abs(p.lat - lat) > 0.05 || Math.abs(p.lon - lon) > 0.05) continue;
    if (km(lat, lon, p.lat, p.lon) > STRAAL_KM) continue;
    telling[p.cat] = (telling[p.cat] || 0) + 1;
  }

  /* register: alleen invullen waar OSM nul zorgobjecten kent, zodat niets
     dubbel telt. De regel houdt zijn eigen naam ("District hospital"). */
  const registers = [];
  for (const r of reg.facilities.filter(x => x.area === naam[1])) {
    if ((telling.health || 0) > 0) continue;
    registers.push(r);
    telling.health = (telling.health || 0) + 1;
  }

  /* gelijk aantal? dan wint de categorie die hoger in CATS staat — anders
     hangt het van de toevallige volgorde van de telling af */
  const rang = c => CATS.findIndex(x => x[0] === c);
  const kandidaten = Object.entries(telling)
    .filter(([c, n]) => n > 0 && CAT.has(c))
    .sort((a, b) => b[1] - a[1] || rang(a[0]) - rang(b[0]));
  const gekozen = [];
  for (const groep of ['health', 'daily']) {
    const beste = kandidaten.find(([c]) => CAT.get(c).groep === groep);
    if (beste && !gekozen.includes(beste)) gekozen.push(beste);
  }
  for (const k of kandidaten) { if (gekozen.length >= 6) break; if (!gekozen.includes(k)) gekozen.push(k); }
  gekozen.sort((a, b) => b[1] - a[1] || rang(a[0]) - rang(b[0]));

  gebieden[naam[1].toLowerCase()] = {
    slug: f.replace(/\.html$/, ''),
    name: naam[1],
    lat, lon,
    radius_km: STRAAL_KM,
    measured_on: osm.fetched.slice(0, 10),
    counts: telling,
    tiles: gekozen.map(([c, n]) => {
      const uitReg = c === 'health' && registers.length && n === registers.length;
      return {
        cat: c, n,
        label: uitReg ? (n === 1 ? registers[0].label_one : registers[0].label_many)
                      : (n === 1 ? CAT.get(c).een : CAT.get(c).meer),
        evidence: uitReg ? 'register' : 'osm',
      };
    }),
    register: registers.map(r => ({ name: r.name, type: r.type, region: r.region, source: reg.sources[r.region] })),
    evidence: gekozen.length === 0 ? 'none' : (registers.length ? 'osm+register' : 'osm'),
  };
}

const uit = {
  about: 'Voorzieningen per gebied voor het blok "What’s nearby". Gebouwd door build-area-amenities.mjs.',
  built: new Date().toISOString().slice(0, 10),
  radius_km: STRAAL_KM,
  sources: {
    osm: osm.source + ' — opgehaald ' + osm.fetched.slice(0, 10),
    register: 'Ministry of Health, Republic of The Gambia — regionale directoraten, uitgelezen 2026-09-01',
  },
  areas: gebieden,
};

console.log(`gebieden met blok: ${Object.keys(gebieden).length} — zonder blok overgeslagen: ${zonderBlok}\n`);
for (const g of Object.values(gebieden)) {
  console.log(`  ${g.name.padEnd(18)} ${g.evidence.padEnd(12)} ` + g.tiles.map(t => `${t.n} ${t.label}`).join(' | '));
}
if (WRITE) { await writeFile('area-amenities.json', JSON.stringify(uit, null, 1)); console.log('\ngeschreven: area-amenities.json'); }
else console.log('\nDraai opnieuw met --write om area-amenities.json te schrijven.');
