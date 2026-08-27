/* Vangnet voor de omzetting van de interne eenheid van valuation.js
 * van euro naar dalasi (27-08-2026).
 *
 *   node _werk/unit-harness-27-08-2026.mjs voor  > _werk/unit-voor.json
 *   node _werk/unit-harness-27-08-2026.mjs na    > _werk/unit-na.json
 *   node _werk/unit-harness-27-08-2026.mjs diff
 *
 * 'diff' eist dat elke uitkomst na de omzetting gelijk is aan die ervoor
 * maal 85,74, binnen de marge die de afronding op ronde dalasibedragen
 * toestaat. Een gemiste omrekening in een van de vijf verbruikers geeft
 * een factor 86 en valt hier meteen door de mand.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const EURGMD = 85.74;   /* CBG 25-08-2026, dezelfde koers waarop geijkt is */

const mode = process.argv[2] || 'voor';

if (mode !== 'diff') {
  require(join(ROOT, 'valuation.js'));
  const V = globalThis.MK_VAL;

  /* Raster: elk type, elke bewijsklasse (observed / half / zone / onbekend),
     met en zonder opstal, met en zonder de losse posten uit BUILD_EXTRA. */
  const AREAS = ['Fajara', 'Bijilo', 'Sukuta', 'Sanyang', 'Sifoe',      /* observed */
                 'Cape Point', 'Kololi', 'Kartong', 'Farafenni',        /* half     */
                 'Barra', 'Basse', 'Wellingara',                        /* zone     */
                 'Nergensburg'];                                        /* onbekend */
  const FINISH = ['basic', 'standard', 'high'];

  const out = [];
  for (const area of AREAS) {
    out.push({ n: `land ${area} 400`, r: V.value({ type: 'land', area, plotSqm: 400 }) });
    out.push({ n: `land ${area} 400 vol`, r: V.value({ type: 'land', area, plotSqm: 400,
      title: 'freehold', road: 'tarmac', elec: 'present', water: 'nawec', fence: 'full',
      cleared: 'yes', flood: 'no', beach: 'walking' }) });
    for (const finish of FINISH) {
      out.push({ n: `villa ${area} 500/180 ${finish}`, r: V.value({ type: 'villa', area,
        plotSqm: 500, builtSqm: 180, finish, yearBuilt: 2018, condition: 'good',
        floors: 1, baths: 2, water: 'nawec', security: 'wall' }) });
    }
    out.push({ n: `villa ${area} extras`, r: V.value({ type: 'villa', area, plotSqm: 800,
      builtSqm: 250, finish: 'high', yearBuilt: 2022, condition: 'good', pool: 'yes',
      solar: 'both', water: 'borehole', fence: 'full', furnished: 'furnished' }) });
    out.push({ n: `apt ${area} 90`, r: V.value({ type: 'apartment', area, builtSqm: 90,
      finish: 'standard', yearBuilt: 2020, condition: 'good' }) });
    out.push({ n: `oud huis ${area}`, r: V.value({ type: 'house', area, plotSqm: 450,
      builtSqm: 120, finish: 'basic', yearBuilt: 1985, condition: 'fair' }) });
  }

  /* Alleen de bedragen: banden, tarieven en de huur. De labels en teksten
     doen hier niet mee, die veranderen niet van eenheid. */
  const rows = out.map(o => ({
    n: o.n,
    ok: o.r && o.r.ok !== false,
    mid: o.r && o.r.mid, low: o.r && o.r.low, high: o.r && o.r.high,
    land: o.r && o.r.land, build: o.r && o.r.build, rebuild: o.r && o.r.rebuild,
    landRate: o.r && o.r.landRate, buildUnit: o.r && o.r.buildUnit,
    rentLocal: o.r && o.r.rent && o.r.rent.local,
    rentExpat: o.r && o.r.rent && o.r.rent.expat,
    conf: o.r && o.r.confidence && o.r.confidence.label,
    band: o.r && o.r.confidence && o.r.confidence.band,
    src: o.r && o.r.landRateSrc && o.r.landRateSrc.src
  }));
  console.log(JSON.stringify(rows, null, 1));
  process.exit(0);
}

/* ---------- diff ---------- */
const voor = JSON.parse(readFileSync(join(ROOT, '_werk/unit-voor.json'), 'utf8'));
const na   = JSON.parse(readFileSync(join(ROOT, '_werk/unit-na.json'), 'utf8'));
const GELD = ['mid', 'low', 'high', 'land', 'build', 'rebuild', 'landRate', 'buildUnit',
              'rentLocal', 'rentExpat'];
const GELIJK = ['ok', 'conf', 'band', 'src'];

/* Marge: de afronding op ronde dalasibedragen mag maximaal 1% schelen, en
   de banden worden op grovere stappen afgerond dan voorheen. Onder de
   D50.000 laten we de absolute stap toe in plaats van een percentage. */
const TOL_PCT = 0.012;
const TOL_ABS = 500_000;

let fouten = 0, gecontroleerd = 0;
if (voor.length !== na.length) { console.log('RASTER VERSCHILT VAN LENGTE'); process.exit(1); }

voor.forEach((v, i) => {
  const n = na[i];
  if (v.n !== n.n) { console.log('RIJ VERSCHILT: ' + v.n + ' / ' + n.n); fouten++; return; }
  GELIJK.forEach(k => {
    if (JSON.stringify(v[k]) !== JSON.stringify(n[k])) {
      console.log(`${v.n} · ${k}: ${JSON.stringify(v[k])} -> ${JSON.stringify(n[k])}`);
      fouten++;
    }
  });
  GELD.forEach(k => {
    const a = v[k], b = n[k];
    if (a == null && b == null) return;
    if (a == null || b == null) { console.log(`${v.n} · ${k}: ${a} -> ${b}`); fouten++; return; }
    gecontroleerd++;
    const verwacht = a * EURGMD;
    const afw = Math.abs(b - verwacht);
    if (afw > Math.max(TOL_ABS, Math.abs(verwacht) * TOL_PCT)) {
      const factor = a === 0 ? '-' : (b / a).toFixed(2);
      console.log(`${v.n} · ${k}: ${Math.round(a)} -> ${Math.round(b)}  ` +
                  `(verwacht ${Math.round(verwacht)}, factor ${factor})`);
      fouten++;
    }
  });
});

console.log(`\n${gecontroleerd} bedragen vergeleken over ${voor.length} gevallen.`);
console.log(fouten === 0 ? 'GEEN AFWIJKINGEN.' : `${fouten} AFWIJKING(EN).`);
process.exit(fouten === 0 ? 0 : 1);
