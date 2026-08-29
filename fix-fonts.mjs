/* fix-fonts.mjs — eenmalig, maar veilig om opnieuw te draaien.
 *
 *     node fix-fonts.mjs          toont wat er zou veranderen
 *     node fix-fonts.mjs --write  past de pagina's aan
 *
 * De site staat sinds 29-08-2026 volledig in Mulish. Hanken Grotesk wordt
 * nergens meer aangeroepen, maar elke pagina had er nog een <link rel="preload">
 * voor in de head staan. Een preload van een lettertype dat niemand gebruikt is
 * niet onschuldig: de browser haalt het bestand met hoge prioriteit op, vóór de
 * dingen die wél nodig zijn, en waarschuwt er in de console over. Op een 4G-lijn
 * in Gambia is dat 35 kB die niets doet.
 *
 * Dit script haalt die regel uit alle pagina's. De preload van Mulish blijft
 * staan, want die letter is er nu de enige.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');

/* Alleen deze twee: de rest van de head blijft zoals hij is. */
const WEG = [
  /[ \t]*<link rel="preload" href="fonts\/hanken-grotesk-var-latin\.woff2"[^>]*>\n?/g,
  /[ \t]*<link rel="preload" href="fonts\/source-serif-4-var-latin\.woff2"[^>]*>\n?/g,
];

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let aangeraakt = 0, regels = 0;

for (const f of files) {
  const src = await readFile(f, 'utf8');
  let out = src, n = 0;
  for (const re of WEG) {
    out = out.replace(re, () => { n++; return ''; });
  }
  if (!n) continue;
  console.log(`  ${f}: ${n} preload-regel(s) weg`);
  if (WRITE) await writeFile(f, out);
  aangeraakt++; regels += n;
}

console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${aangeraakt} pagina('s), ${regels} regel(s)`);
if (!WRITE && aangeraakt) console.log('Draai opnieuw met --write om het echt weg te schrijven.');
