/* Zes nieuwe gebieden in area-prices.json — 31-08-2026.
   Eenmalig. Draait alleen als de zes er nog niet in staan.
   Geen bedrag wordt hier verzonnen: een bandgebied neemt het bandtarief
   letterlijk over, een ref-gebied het tarief van de genoemde buurplaats.
   Kavel en woning volgen de formule die in "assumptions" staat. */
import { readFile, writeFile } from 'node:fs/promises';

const f = 'area-prices.json';
const DB = JSON.parse(await readFile(f, 'utf8'));
const A = DB.areas, B = DB.bands, FX = DB.fx;
const BOUW = DB.assumptions.floor * DB.assumptions.build_eur * FX.eur; // 120 m2 x EUR300

const r1 = (x, s) => Math.round(x / s) * s;

function basis(label, slug, zone) {
  return { label, slug, zone };
}
function afmaken(r) {
  r.plot400 = r1(r.gmd_m2 * DB.assumptions.plot, 1000);
  r.plot_src = 'derived';
  r.house = r1(r.plot400 + BOUW, 10000);
  r.house_src = 'derived';
  r.rent_year = null; r.rent_src = 'none';
  r.usd_m2 = Math.round(r.gmd_m2 / FX.usd * 10) / 10;
  r.eur_m2 = Math.round(r.gmd_m2 / FX.eur * 10) / 10;
  r.yield = null; r.rent_lo = null; r.rent_hi = null; r.rent_month = null; r.rent_n = 0;
  return r;
}
function bandGebied(label, slug, zone, band) {
  const b = B[band];
  return afmaken(Object.assign(basis(label, slug, zone),
    { gmd_m2: b.gmd_m2, lo: b.lo, hi: b.hi, n: 0, src: 'band', band }));
}
function refGebied(label, slug, zone, ref, ref_km, ref_note) {
  const R = A[ref];
  return afmaken(Object.assign(basis(label, slug, zone),
    { gmd_m2: R.gmd_m2, lo: R.lo, hi: R.hi, n: 0, src: 'ref', ref, ref_km, ref_note }));
}

const nieuw = {
  'ghana-town': refGebied('Ghana Town', 'ghana-town', 'coast', 'brufut', 2.1,
    'Ghana Town is also hemmed in: it cannot expand seaward, because that land is Tourism Development Area, and the families who own the land around it do not allocate more. Very little changes hands here at all.'),
  'jambur': bandGebied('Jambur', 'jambur', 'kombo', 'kombo_inland'),
  'madiana': refGebied('Madiana', 'madiana', 'coast', 'brufut', 3.4,
    'Read that figure as Brufut’s. Brufut is a coastal town with a resort strip behind it; Madiana is farmland several kilometres inland, on a road that was only tarred in May 2026.'),
  'old-yundum': bandGebied('Old Yundum', 'old-yundum', 'kombo', 'kombo'),
  'tintinto': bandGebied('Tintinto', 'tintinto', 'coast', 'tanji_tujereng'),
  'tranquil': refGebied('Tranquil', 'tranquil', 'kombo', 'brusubi', 0.9,
    'Brusubi’s own figure rests on four priced listings — itself below our bar of five — so this is the thinnest kind of land rate anywhere on this site. Treat it as an order of magnitude, not a price.'),
};

let toegevoegd = 0;
for (const [k, v] of Object.entries(nieuw)) {
  if (A[k]) { console.log('bestaat al, ongemoeid: ' + k); continue; }
  A[k] = v; toegevoegd++;
  console.log(k.padEnd(12) + ' D' + v.gmd_m2 + '/m²  ' + v.src + (v.band ? ' ' + v.band : '') + (v.ref ? ' -> ' + v.ref + ' (' + v.ref_km + ' km)' : ''));
}
if (!toegevoegd) { console.log('niets toe te voegen'); process.exit(0); }

const gesorteerd = {};
for (const k of Object.keys(A).sort()) gesorteerd[k] = A[k];
DB.areas = gesorteerd;
DB.generated = new Date().toISOString().slice(0, 10);

if (process.argv.includes('--write')) {
  await writeFile(f, JSON.stringify(DB, null, 2) + '\n');
  console.log('\ngeschreven: ' + toegevoegd + ' gebied(en), ' + Object.keys(A).length + ' in totaal');
} else {
  console.log('\nproefdraai — ' + toegevoegd + ' gebied(en), ' + Object.keys(A).length + ' in totaal. Voeg --write toe.');
}
