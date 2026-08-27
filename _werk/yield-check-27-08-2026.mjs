/* Wat is het bruto huurrendement werkelijk, nu huur en vraagprijs los gemeten zijn?
   Gepaard binnen hetzelfde gebied — dat is de enige manier om te vermijden dat je
   een lokale huur tegen een expat-vraagprijs afzet. */
import { readFile } from 'node:fs/promises';
const DB = JSON.parse(await readFile('area-prices.json', 'utf8'));

const rows = Object.values(DB.areas)
  .filter(a => a.house && a.rent_year)
  .map(a => ({ label: a.label, y: a.rent_year / a.house * 100,
               lo: a.rent_lo / a.house * 100, hi: a.rent_hi / a.house * 100, n: a.rent_n }))
  .sort((a, b) => a.y - b.y);

for (const r of rows) {
  console.log(`${r.label.padEnd(14)} ${r.y.toFixed(2)}%   band ${r.lo.toFixed(1)}-${r.hi.toFixed(1)}%   n=${r.n}`);
}
const med = a => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1;
                   return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const ys = rows.map(r => r.y);
console.log(`\nn=${ys.length}  mediaan ${med(ys).toFixed(2)}%  min ${Math.min(...ys).toFixed(1)}%  max ${Math.max(...ys).toFixed(1)}%`);
console.log(`gewogen naar aantal advertenties: ` +
  (rows.reduce((s, r) => s + r.y * r.n, 0) / rows.reduce((s, r) => s + r.n, 0)).toFixed(2) + '%');
console.log(`mediaan van de onderkanten ${med(rows.map(r => r.lo)).toFixed(2)}%, ` +
            `van de bovenkanten ${med(rows.map(r => r.hi)).toFixed(2)}%`);
