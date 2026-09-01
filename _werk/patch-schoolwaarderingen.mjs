/* patch-schoolwaarderingen.mjs — haalt de kwaliteitsoordelen uit het blok
 * "Schools nearby" / "International schools" op de gebiedspagina's.
 *
 *   node _werk/patch-schoolwaarderingen.mjs            toont wat er zou veranderen
 *   node _werk/patch-schoolwaarderingen.mjs --write    past de pagina's aan
 *   node _werk/patch-schoolwaarderingen.mjs --terug    zet alles terug
 *
 * Waarom: bij 121 met naam genoemde scholen stond een oordeel — "Good",
 * "Very good", "Excellent", "Adequate", "Satisfactory" — zonder enige bron.
 * Op dezelfde pagina staat onder de prijstabel dat een getal dat we niet
 * kunnen verdedigen erger is dan geen getal. Een oordeel over een bestaande
 * school is een zwaardere bewering dan een getal. Naam, schooltype en afstand
 * blijven staan; het oordeel en het sterretje gaan eruit.
 *
 * Elke schoolregel is [naam, initialen, type, OORDEEL, afstand]; element 3
 * gaat eruit en de renderregel schuift mee. Er zijn DRIE codevormen in de
 * pagina's — string-concat met dubbele aanhalingstekens, string-concat met
 * enkele, en een template literal in kololi.html. Wie er maar één pakt, mist
 * de helft; daarom staan de aanhalingstekens hieronder als capture group.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-schoolwaarderingen';

const CONCAT = /<div class="rt">(['"])\+ICON\.star\+(['"]) \2\+s\[3\]\+(['"])<\/div><div class="dist">(['"])\+s\[4\]\+(['"])/;
const LITERAL = /<div class="rt">\$\{ICON\.star\} \$\{s\[3\]\}<\/div><div class="dist">\$\{s\[4\]\}/;

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden — niets terug te zetten.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`);
  process.exit(0);
}

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, scholen = 0, overgeslagen = 0;
const oordelen = new Map();
const rapport = [];

for (const f of files) {
  const src = await readFile(f, 'utf8');
  const m = src.match(/(var|const) schools\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) continue;

  let rijen;
  try { rijen = Function('return ' + m[2])(); } catch (e) {
    console.log(`  ${f}: schoolarray niet te lezen — OVERGESLAGEN (${e.message})`); overgeslagen++; continue;
  }
  if (!Array.isArray(rijen) || !rijen.length) continue;
  if (!rijen.every(r => Array.isArray(r) && r.length === 5)) {
    console.log(`  ${f}: onverwachte vorm (geen 5 velden per school) — OVERGESLAGEN`); overgeslagen++; continue;
  }

  const isConcat = CONCAT.test(src), isLiteral = LITERAL.test(src);
  if (!isConcat && !isLiteral) { console.log(`  ${f}: renderregel niet herkend — OVERGESLAGEN`); overgeslagen++; continue; }

  let out = src.replace(m[2], () => JSON.stringify(rijen.map(r => [r[0], r[1], r[2], r[4]])));
  out = isConcat
    ? out.replace(CONCAT, (heel, q1, q2, q3, q4, q5) => '<div class="dist">' + q4 + '+s[3]+' + q5)
    : out.replace(LITERAL, () => '<div class="dist">' + '${s[3]}');

  for (const r of rijen) oordelen.set(r[3], (oordelen.get(r[3]) || 0) + 1);
  scholen += rijen.length;
  rapport.push(`  ${f}: ${rijen.length} scholen — ${rijen.map(r => r[3]).join(', ')}`);
  geraakt++;

  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

console.log(rapport.join('\n'));
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s), ${scholen} schoolregels, overgeslagen ${overgeslagen}`);
console.log('oordelen die verdwijnen:', [...oordelen].map(([k, v]) => `${k} ${v}x`).join(', '));
if (overgeslagen) console.log('LET OP: er is minstens één pagina niet geraakt — kijk hierboven welke.');
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
