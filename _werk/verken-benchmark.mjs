/* verken-benchmark.mjs — wat doet Senegambia als ijkpunt, en wat zou de mediaan doen? */
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('area-scores.json', 'utf8'));
const gebieden = Object.values(data.areas);
const MATEN = ['Affordability', 'Everyday shopping', 'Places to eat', 'Healthcare'];

const scoreVan = (g, label) => g.measures.find(m => m.label === label)?.score ?? null;
const mediaan = a => { const s = [...a].sort((x, y) => x - y); const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2); };
const gemiddelde = a => Math.round(a.reduce((s, x) => s + x, 0) / a.length);

const sen = Object.fromEntries(MATEN.map(m => [m, data.benchmark.scores[m]]));
console.log('ijkpunten per maat:\n');
console.log('maat                 Senegambia  mediaan  gemiddelde   laagste  hoogste   n');
const med = {}, gem = {};
for (const m of MATEN) {
  const v = gebieden.map(g => scoreVan(g, m)).filter(x => x != null);
  med[m] = mediaan(v); gem[m] = gemiddelde(v);
  console.log(`  ${m.padEnd(20)} ${String(sen[m]).padStart(6)} ${String(med[m]).padStart(8)} ${String(gem[m]).padStart(10)} ` +
    `${String(Math.min(...v)).padStart(9)} ${String(Math.max(...v)).padStart(8)} ${String(v.length).padStart(3)}`);
}

/* de pagina noemt een verschil van meer dan 3 punten "boven" of "onder" */
const verdeling = (ijk) => {
  console.log('\n     maat                boven   gelijk   onder');
  for (const m of MATEN) {
    const v = gebieden.map(g => scoreVan(g, m)).filter(x => x != null);
    const b = v.filter(x => x - ijk[m] > 3).length;
    const o = v.filter(x => x - ijk[m] < -3).length;
    console.log(`       ${m.padEnd(20)} ${String(b).padStart(4)} ${String(v.length - b - o).padStart(8)} ${String(o).padStart(7)}`);
  }
};
console.log('\nMET SENEGAMBIA ALS IJKPUNT'); verdeling(sen);
console.log('\nMET DE MEDIAAN ALS IJKPUNT'); verdeling(med);
console.log('\nMET HET GEMIDDELDE ALS IJKPUNT'); verdeling(gem);

/* hoeveel gebieden staan op ALLE maten onder het ijkpunt? */
const allesOnder = ijk => gebieden.filter(g => {
  const eigen = MATEN.filter(m => scoreVan(g, m) != null);
  return eigen.length >= 2 && eigen.every(m => scoreVan(g, m) - ijk[m] < -3);
}).length;
console.log(`\ngebieden die op elke gemeten maat onder het ijkpunt staan:`);
console.log(`  Senegambia ${allesOnder(sen)} van 41   mediaan ${allesOnder(med)}   gemiddelde ${allesOnder(gem)}`);
