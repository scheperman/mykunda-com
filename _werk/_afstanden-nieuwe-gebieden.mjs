/* Afstanden voor de zes nieuwe gebiedspagina's — 31-08-2026.
   Leest de coordinaten uit gambia-places.js en de gebiedenlijst uit
   area-prices.json, zodat er geen afstand met de hand wordt getypt. */
import { readFile } from 'node:fs/promises';

const NIEUW = {
  'Madiana':    [13.3533,  -16.7631],
  'Jambur':     [13.3146,  -16.7008],
  'Ghana Town': [13.38444, -16.77111],
  'Tintinto':   [13.29556, -16.78861],
  'Tranquil':   [13.40306, -16.73806],
  'Old Yundum': [13.3625,  -16.68611],
};

const placesSrc = await readFile('gambia-places.js', 'utf8');
const PL = {};
for (const m of placesSrc.matchAll(/\['([^']+)','([^']+)',(-?[\d.]+),(-?[\d.]+)\]/g))
  PL[m[1]] = [Number(m[3]), Number(m[4])];

const DB = JSON.parse(await readFile('area-prices.json', 'utf8'));

function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const s = Math.sin(dLat / 2) ** 2 +
            Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

for (const [naam, punt] of Object.entries(NIEUW)) {
  const rijen = [];
  for (const k of Object.keys(DB.areas)) {
    const r = DB.areas[k];
    const p = PL[r.label] || PL[r.label.replace(' Santa Su', '')];
    if (!p) { rijen.push([r.label, NaN, k]); continue; }
    rijen.push([r.label, km(punt, p), r.slug]);
  }
  for (const [n2, p2] of Object.entries(NIEUW))
    if (n2 !== naam) rijen.push([n2 + ' (nieuw)', km(punt, p2), '-']);
  rijen.sort((a, b) => a[1] - b[1]);
  console.log('\n== ' + naam + ' ' + JSON.stringify(punt));
  for (const [l, d, s] of rijen.slice(0, 9))
    console.log('   ' + l.padEnd(22) + (isNaN(d) ? 'geen coordinaat' : d.toFixed(2) + ' km  ' + s));
}
