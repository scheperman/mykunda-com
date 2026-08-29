/* MyKunda — plaatsen-consistentiecheck
 *   node _werk/check-plaatsen.mjs   (vanuit de projectmap)
 *
 * Sinds de plaatscontrole van 30-08-2026 geldt: gambia-places.js is de enige
 * bron; GM_AREAS en AREA_COORDS in app.js horen daar exact mee samen te
 * vallen (zelfde namen, zelfde coordinaten). Deze check bewaakt dat — de
 * scheefgroei die tot 30-08-2026 bestond (39 plaatsen met onderling tot 40 km
 * verschil) kan dan nooit stil terugkomen. Faalt hij, dan is er in een van de
 * tabellen los gewijzigd: neem de wijziging over in gambia-places.js en
 * genereer de twee blokken in app.js opnieuw (zelfde waarden).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const gp = readFileSync(join(ROOT, 'gambia-places.js'), 'utf8');
const app = readFileSync(join(ROOT, 'app.js'), 'utf8');
let m;
const places = {};
const reGP = /\['([^']+)','([^']+)',(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g;
while ((m = reGP.exec(gp))) places[m[1]] = [+m[3], +m[4]];
const gmB = app.match(/const GM_AREAS=\[([\s\S]*?)\n\];/)[1];
const gm = {};
const reGM = /\['([^']+)',(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g;
let dupes = 0, missing = 0, diff = 0;
while ((m = reGM.exec(gmB))) { if (gm[m[1]]) { console.log('DUBBEL in GM_AREAS: ' + m[1]); dupes++; } gm[m[1]] = [+m[2], +m[3]]; }
const acB = app.match(/const AREA_COORDS = \{([\s\S]*?)\n\};/)[1];
const ac = {};
const reAC = /'([^']+)':\[(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\]/g;
while ((m = reAC.exec(acB))) { if (ac[m[1]]) { console.log('DUBBEL in AREA_COORDS: ' + m[1]); dupes++; } ac[m[1]] = [+m[2], +m[3]]; }
for (const n in places) {
  for (const [t, tab] of [['GM_AREAS', gm], ['AREA_COORDS', ac]]) {
    if (!tab[n]) { console.log('ONTBREEKT in ' + t + ': ' + n); missing++; continue; }
    const km = Math.hypot(places[n][0] - tab[n][0], (places[n][1] - tab[n][1]) * 0.973) * 111;
    if (km > 0.05) { console.log('VERSCHIL ' + t + ' ' + n + ': ' + km.toFixed(2) + ' km'); diff++; }
  }
}
for (const n in gm) if (!places[n]) { console.log('GM_AREAS-naam niet in gambia-places.js: ' + n); missing++; }
for (const n in ac) if (!places[n] && n !== 'Cape Point, Bakau') { console.log('AREA_COORDS-naam niet in gambia-places.js: ' + n); missing++; }
const bad = dupes + missing + diff;
console.log(`${Object.keys(places).length} plaatsen; dubbel ${dupes}, ontbrekend ${missing}, verschillend ${diff} — ${bad === 0 ? 'ok' : 'FOUT'}`);
process.exit(bad === 0 ? 0 : 1);
