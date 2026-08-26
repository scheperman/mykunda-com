/* De werkbestanden van de ombouw uit de root halen.
   build.mjs leest alleen de root, dus alles in _werk/ bestaat voor de build
   niet meer en verdwijnt bij de volgende bouw ook uit deploy/. Weggooien doe
   ik ze niet: de backup van sell.html en de migratiescripts zijn het bewijs
   van wat er is gebeurd. */
import { mkdir, rename, readdir } from 'node:fs/promises';

const VERHUIZEN = [
  '_afronden.mjs', '_blokA.html', '_blokB.js', '_check.mjs', '_check2.mjs',
  '_extract-areas.mjs', '_herstel.mjs', '_migratie.mjs',
  '_valuation-flow-prototype.html', '_sell.html.voor-waardemodel'
];

await mkdir('_werk', { recursive: true });
const aanwezig = new Set(await readdir('.'));
const gedaan = [];
for (const f of VERHUIZEN) {
  if (!aanwezig.has(f)) continue;
  await rename(f, '_werk/' + f);
  gedaan.push(f);
}
console.log('Verplaatst naar _werk/:');
gedaan.forEach(f => console.log('   ' + f));
console.log('\nIn de root blijven alleen de bestanden die de site nodig heeft.');
