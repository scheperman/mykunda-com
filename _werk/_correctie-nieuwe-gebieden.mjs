/* Correctie 31-08-2026, na de zelftest van valuation.js.
   Drie dingen die bij de eerste ronde misgingen of ontbraken:

   1. SLEUTELS. area-prices.json gebruikt voor gebieden van twee woorden een
      SPATIE ('cape point', 'kerr serign'), niet een streepje. Het model zoekt
      met genormaliseerde plaatsnamen, dus 'ghana-town' en 'old-yundum' zouden
      daar nooit gevonden zijn en zouden stilletjes op de oude tabel uitkomen.

   2. WAARNEMINGEN DIE ER WEL ZIJN. LAND_HALF in valuation.js bevatte de
      metingen van 26-08-2026 voor drie van deze plaatsen, omdat ze toen nog
      geen pagina hadden: Jambur 4 advertenties (mediaan D1.612), Madiana 1
      (D1.333) en Ghana Town 1 (D2.500). Die horen nu in area-prices.json en
      moeten uit LAND_HALF: twee bronnen voor hetzelfde getal is precies wat
      hier eerder is opgeruimd.

   3. MADIANA GAAT VAN 'ref' NAAR DE BAND. De ene advertentie die we in Madiana
      kennen vraagt D1.333 per m². Dat ligt binnen de middelste helft van de
      band voor de landinwaartse Kombo-dorpen (D1.190-2.080) en ver onder het
      tarief van Brufut (D2.282), waar de pagina eerst naar verwees. Met een
      waarneming in de hand is de band de beter onderbouwde keuze.           */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const f = 'area-prices.json';
const DB = JSON.parse(await readFile(f, 'utf8'));
const A = DB.areas, B = DB.bands, FX = DB.fx;
const BOUW = DB.assumptions.floor * DB.assumptions.build_eur * FX.eur;
const r1 = (x, s) => Math.round(x / s) * s;

function herbereken(r) {
  r.plot400 = r1(r.gmd_m2 * DB.assumptions.plot, 1000);
  r.house = r1(r.plot400 + BOUW, 10000);
  r.usd_m2 = Math.round(r.gmd_m2 / FX.usd * 10) / 10;
  r.eur_m2 = Math.round(r.gmd_m2 / FX.eur * 10) / 10;
}

/* 1 — sleutels met een spatie */
for (const [oud, nieuw] of [['ghana-town', 'ghana town'], ['old-yundum', 'old yundum']]) {
  if (A[oud] && !A[nieuw]) { A[nieuw] = A[oud]; delete A[oud]; console.log('sleutel ' + oud + ' -> ' + nieuw); }
}

/* 2 — de waarnemingen van 26-08-2026 erbij */
const METING = { 'jambur': [4, 1612], 'madiana': [1, 1333], 'ghana town': [1, 2500] };
for (const [k, [n, med]] of Object.entries(METING)) {
  if (!A[k]) { console.error('onbekend gebied: ' + k); process.exit(1); }
  A[k].n = n; A[k].own_med = med;
  console.log(k + ': n=' + n + ', eigen mediaan D' + med);
}

/* 3 — Madiana naar de band voor de landinwaartse Kombo-dorpen */
{
  const r = A['madiana'];
  if (r.src === 'ref') {
    delete r.ref; delete r.ref_km; delete r.ref_note;
    r.src = 'band'; r.band = 'kombo_inland';
    r.gmd_m2 = B.kombo_inland.gmd_m2; r.lo = B.kombo_inland.lo; r.hi = B.kombo_inland.hi;
    herbereken(r);
    console.log('madiana: ref(brufut) -> band kombo_inland, D' + r.gmd_m2 + '/m²');
  }
}

DB.generated = new Date().toISOString().slice(0, 10);
const gesorteerd = {};
for (const k of Object.keys(A).sort()) gesorteerd[k] = A[k];
DB.areas = gesorteerd;

/* 4 — de drie uit LAND_HALF halen */
let vjs = await readFile('valuation.js', 'utf8');
const vvoor = vjs;
for (const k of ['ghana town', 'jambur', 'madiana']) {
  const re = new RegExp("\\n\\s*'" + k + "':\\s*\\{[^}]*\\},?", '');
  if (re.test(vjs)) { vjs = vjs.replace(re, ''); console.log('LAND_HALF: ' + k + ' verwijderd'); }
}
vjs = vjs.replace(/(var LAND_HALF = \{[\s\S]*?)\,(\s*\n\};)/, '$1$2');

if (WRITE) {
  await writeFile(f, JSON.stringify(DB, null, 2) + '\n');
  if (vjs !== vvoor) await writeFile('valuation.js', vjs);
  console.log('\ngeschreven. Draai nu: node build-area-prices.mjs --write && node build.mjs');
} else {
  console.log('\nproefdraai — voeg --write toe');
}
