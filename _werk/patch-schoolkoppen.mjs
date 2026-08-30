/* patch-schoolkoppen.mjs — één naam voor dezelfde sectie.
 *
 * Gebruik: node _werk/patch-schoolkoppen.mjs [--droog]
 *
 * De scholensectie heette op zes pagina's kaal "Schools" en op zeventien
 * "Schools nearby", terwijl het om precies hetzelfde blok gaat (schoolList).
 * Dat wordt "Schools nearby". De twee koppen die wél iets anders betekenen
 * blijven staan: "International schools" op de kustplaatsen, en "Schools &
 * campus" op Yundum, waar de universiteit staat.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const droog = process.argv.includes('--droog');

let n = 0;
for (const naam of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(naam) || /areas-in-the-gambia/.test(naam)) continue;
  const pad = new URL(naam, root);
  const html = await readFile(pad, 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  if (!/<h2>Schools<\/h2>/.test(html)) continue;
  const nieuw = html.replace('<h2>Schools</h2>', '<h2>Schools nearby</h2>');
  if (!droog) await writeFile(pad, nieuw);
  console.log(`${droog ? 'zou wijzigen' : 'gewijzigd'}  ${naam}`);
  n++;
}
console.log(`\n${n} pagina('s)${droog ? '  (droogloop)' : ''}`);
