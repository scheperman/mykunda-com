/* dump-commutes.mjs — leest de bestaande reisregels van alle gebiedspagina's.
 * Twee vormen: veertig pagina's met [bestemming, modus, waarde] en kololi.html
 * met [bestemming, icoonvariabele, modus, waarde]. Wie alleen de eerste pakt,
 * mist de drukste pagina van de site.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
const files = (await readdir('.')).filter(f => f.endsWith('.html'));
const alles = [];
for (const f of files) {
  const t = await readFile(f, 'utf8');
  const m = t.match(/(?:var|const) commutes\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) continue;
  const schoon = m[1].replace(/,\s*(walk|car|ferry)\s*,/g, ',');   // icoonvariabele eruit
  let rijen;
  try { rijen = Function('return ' + schoon)(); }
  catch (e) { console.log(`  ${f}: onleesbaar — ${e.message}`); continue; }
  alles.push({ file: f, rijen });
}
await writeFile('_werk/commutes-dump.json', JSON.stringify(alles, null, 1));
console.log(`paginas: ${alles.length}, regels: ${alles.reduce((n, a) => n + a.rijen.length, 0)}`);
