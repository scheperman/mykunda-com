/* verken-lokaal.mjs — wat staat er nu in scores[] en in de 'local strength'? */
import { readFile } from 'node:fs/promises';
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const TIJD = /\b(minute|minutes|min\b|hour|hours|hr\b|twenty|thirty|forty|fifty|ten|fifteen|five)\b/i;
let metTijd = 0;
for (const g of Object.values(amen.areas)) {
  const src = await readFile(g.slug + '.html', 'utf8');
  const m = src.match(/(?:var|const)\s+scores\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) { console.log(`  ${g.name.padEnd(18)} GEEN scores-array`); continue; }
  let arr; try { arr = eval(m[1]); } catch (e) { console.log(`  ${g.name.padEnd(18)} onleesbaar`); continue; }
  const loc = arr[arr.length - 1];
  const tijd = TIJD.test(loc[2] || '') ? '  <== TIJDWOORD' : '';
  if (tijd) metTijd++;
  console.log(`  ${g.name.padEnd(18)} ringen ${arr.length - 1}  | lokaal: ${String(loc[0]).padEnd(22)} ${loc[2]}${tijd}`);
}
console.log(`\nlokale sterktes met een tijdwoord in de omschrijving: ${metTijd}`);
