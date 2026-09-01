/* patch-lifestyle-scores.mjs — zet het blok "Lifestyle scores" om van vijf
 * handgezette getallen naar wat er uit te rekenen valt.
 *
 *   node _werk/patch-lifestyle-scores.mjs            alleen het diffrapport
 *   node _werk/patch-lifestyle-scores.mjs --write    past de pagina's aan
 *   node _werk/patch-lifestyle-scores.mjs --terug    zet alles terug
 *
 * Zes ingrepen per pagina:
 *   1  var SG (de benchmark) krijgt de doorgerekende waarden van Senegambia;
 *   2  var scores krijgt de maten uit area-scores.json, met de local strength
 *      als laatste rij en zonder getal;
 *   3  het rooster tekent voortaan alles behalve de laatste rij, in plaats van
 *      precies vier — er zijn nu twee maten, en zes gebieden hebben er één;
 *   4  de local strength verliest zijn ring: het is een kwalificatie, geen meting;
 *   5  de lead belooft geen vier maten meer;
 *   6  er komt een bronregel onder het blok die de formules noemt en zegt wat
 *      er weg is en waarom.
 *
 * Alle 41 pagina's dragen exact dezelfde renderregel; wijkt er één af, dan
 * slaat dit script hem over en zegt het.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-lifestyle-scores';
const MARK = '<!--mk-scoresrc-->';

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden — niets terug te zetten.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`);
  process.exit(0);
}

const data = JSON.parse(await readFile('area-scores.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const datum = new Date(amen.sources.osm.match(/opgehaald (\d{4}-\d{2}-\d{2})/)[1] + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const OUD_LOC = "'<div class=\"score-local\">'+ring(loc[1],0)+'<div class=\"sl-txt\">";
const NIEUW_LOC = "'<div class=\"score-local\"><div class=\"sl-txt\">";

const BRON = 'Affordability is the land asking price per m² on a log scale, where the cheapest area we ' +
  'measure scores 100 and the priciest 0. Places to eat counts restaurants, cafés and bars mapped in ' +
  `OpenStreetMap within ${amen.radius_km} km on ${datum}; where nothing is mapped there is no ring, because ` +
  'that is not a score of zero. Scores for safety and transport used to sit here. Nothing measurable stood ' +
  'behind either, so they are gone.';

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, overgeslagen = 0;
const diff = [`# Diffrapport blok "Lifestyle scores" — ${data.built}`, '',
  `Benchmark: ${data.benchmark.area} — ` + Object.entries(data.benchmark.scores).map(([k, v]) => `${k} ${v}`).join(', '),
  '', 'Methode:', ...Object.entries(data.method).map(([k, v]) => `- **${k}**: ${v}`), '',
  '| gebied | was | wordt |', '|---|---|---|'];

for (const f of files) {
  const g = perSlug.get(f.replace(/\.html$/, ''));
  if (!g) continue;
  const src = await readFile(f, 'utf8');

  const mScores = src.match(/var scores=(\[[\s\S]*?\]);/);
  const mSG = src.match(/var SG=(\{[^}]*\});/);
  if (!mScores || !mSG) { console.log(`  ${f}: var scores of var SG niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
  if (!g.local) { console.log(`  ${f}: geen local strength in area-scores.json — OVERGESLAGEN`); overgeslagen++; continue; }
  if (!src.includes('var loc=scores[4];') || !src.includes('scores.slice(0,4)') || !src.includes(OUD_LOC)) {
    console.log(`  ${f}: renderregel wijkt af — OVERGESLAGEN`); overgeslagen++; continue;
  }

  const rijen = [...g.measures.map(m => [m.label, m.score, m.desc]), [g.local.label, null, g.local.desc]];

  let out = src
    .replace(mSG[1], () => JSON.stringify(data.benchmark.scores))
    .replace(mScores[1], () => JSON.stringify(rijen))
    .replace('var loc=scores[4];', 'var loc=scores[scores.length-1];')
    .replace('scores.slice(0,4)', 'scores.slice(0,-1)')
    .replace(OUD_LOC, NIEUW_LOC);

  const leadRe = /(<h2>Lifestyle scores<\/h2>\s*<p class="lead">)([^<]*)(<\/p>)/;
  if (!leadRe.test(out)) { console.log(`  ${f}: lead niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
  out = out.replace(leadRe, (heel, a, o, b) => a +
    `What we can measure for ${g.name}, scored against ${data.benchmark.area} &mdash; the best-connected, ` +
    'busiest and best-served area on the coast.' + b);

  if (!out.includes(MARK)) {
    const anker = '<div class="scores-grid" id="scoresGrid"></div>';
    if (!out.includes(anker)) { console.log(`  ${f}: scoresGrid niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
    out = out.replace(anker, anker + `\n        ${MARK}<p class="src">${BRON}</p>`);
  }

  const bron = existsSync(`${BACKUP}/${f}`) ? await readFile(`${BACKUP}/${f}`, 'utf8') : src;
  const oud = Function('return ' + bron.match(/var scores=(\[[\s\S]*?\]);/)[1])();
  diff.push(`| **${g.name}** | ${oud.map(r => `${r[0]} ${r[1]}`).join(' · ')} | ` +
    `${rijen.map(r => r[1] === null ? `${r[0]} (geen getal)` : `${r[0]} ${r[1]}`).join(' · ')} |`);

  geraakt++;
  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    if (!existsSync(`${BACKUP}/${f}`)) await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

await writeFile(`_werk/scores-diff-${data.built}.md`, diff.join('\n') + '\n');
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s), overgeslagen ${overgeslagen}`);
console.log(`diffrapport: _werk/scores-diff-${data.built}.md`);
if (geraakt !== 41) console.log(`LET OP: verwacht 41 pagina's, geraakt ${geraakt}.`);
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
