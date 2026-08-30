/* Eenmalig: het nieuwe hoofdstuk over de gebiedspagina's staat per ongeluk
   middenin het List-hoofdstuk, tussen zijn opsomming en zijn eigen subsectie.
   Het verhuist naar een echte hoofdstukgrens, vlak voor "## Pushen na elke sessie". */
import { readFile, writeFile } from 'node:fs/promises';
const pad = new URL('../CLAUDE.md', import.meta.url);
let md = await readFile(pad, 'utf8');

const start = md.indexOf("## De gebiedspagina's: twee generaties");
const eind = md.indexOf('### Wizard: vijf stappen uit dezelfde secties');
if (start < 0 || eind < 0 || eind < start) { console.log('FOUT: grenzen niet gevonden'); process.exit(1); }

const blok = md.slice(start, eind).replace(/\s+$/, '') + '\n\n';
md = md.slice(0, start) + md.slice(eind);

const anker = '## Pushen na elke sessie';
const i = md.indexOf(anker);
if (i < 0) { console.log('FOUT: anker niet gevonden'); process.exit(1); }
md = md.slice(0, i) + blok + md.slice(i);

await writeFile(pad, md);
console.log('verplaatst — ' + blok.split('\n').length + ' regels, nu vlak voor "' + anker + '"');
