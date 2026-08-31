/* Tintinto en Tranquil bijzetten in GM_AREAS en AREA_COORDS in app.js,
   pal achter Madiana, met dezelfde waarden als gambia-places.js.
   31-08-2026. Draai daarna _werk/check-plaatsen.mjs. */
import { readFile, writeFile } from 'node:fs/promises';

const NIEUW = [
  ['Tintinto', 13.29556, -16.78861],
  ['Tranquil', 13.40306, -16.73806],
];

const f = 'app.js';
let src = await readFile(f, 'utf8');
const voor = src;

const anker1 = "['Madiana',13.3533,-16.7631]";
const anker2 = "'Madiana':[13.3533,-16.7631]";
const fouten = [];

for (const [a, naam] of [[anker1, 'GM_AREAS'], [anker2, 'AREA_COORDS']]) {
  const n = src.split(a).length - 1;
  if (n !== 1) fouten.push(naam + ': anker ' + n + 'x gevonden, verwacht 1');
}
if (fouten.length) { console.error(fouten.join('\n')); process.exit(1); }

const staart1 = NIEUW.map(([n, la, lo]) => `,['${n}',${la},${lo}]`).join('');
const staart2 = NIEUW.map(([n, la, lo]) => `,'${n}':[${la},${lo}]`).join('');

for (const [n] of NIEUW) {
  if (src.includes(`['${n}',`) || src.includes(`'${n}':[`)) {
    console.log(n + ' staat er al — niets gedaan'); process.exit(0);
  }
}

src = src.replace(anker1, anker1 + staart1).replace(anker2, anker2 + staart2);

if (src === voor) { console.error('niets vervangen'); process.exit(1); }
if (process.argv.includes('--write')) { await writeFile(f, src); console.log('app.js geschreven'); }
else console.log('proefdraai ok — voeg --write toe');
