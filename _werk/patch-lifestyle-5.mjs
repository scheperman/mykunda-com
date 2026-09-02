/* patch-lifestyle-5.mjs — zet de vijf gemeten maten uit area-scores.json op de
 * gebiedspagina's, in plaats van de twee die er sinds 01-09-2026 stonden.
 *
 *   node _werk/patch-lifestyle-5.mjs            toont het verschil, schrijft niets
 *   node _werk/patch-lifestyle-5.mjs --write    schrijft, met kopie in de backupmap
 *   node _werk/patch-lifestyle-5.mjs --terug    zet de kopieen terug
 *
 * Twee regels uit de fout van 01-09-2026:
 *   1  vervang de HELE opdracht (var scores=[...];), knip nooit een fragment
 *      uit een regel — zo verdween er toen een sluitend aanhalingsteken;
 *   2  compileer elk scriptblok in dit script zelf voordat er geschreven wordt.
 */
import { readFile, writeFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import vm from 'node:vm';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-lifestyle-5';

const scores = JSON.parse(await readFile('area-scores.json', 'utf8'));
const gebieden = Object.values(scores.areas);

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backupmap — niets terug te zetten.'); process.exit(1); }
  const f = await readdir(BACKUP);
  for (const n of f) await copyFile(`${BACKUP}/${n}`, n);
  console.log(`${f.length} bestand(en) teruggezet uit ${BACKUP}.`);
  process.exit(0);
}

/* De bronregel onder het blok. Zij moet exact zeggen wat er gemeten is en
   waarom een pagina soms minder dan vijf ringen toont. */
const BRONREGEL = 'Four measures, each one counted rather than judged. Affordability is the land asking price ' +
  'per m² on a log scale, where the cheapest area we measure scores 100 and the priciest 0. Everyday shopping, ' +
  'places to eat and healthcare count what OpenStreetMap has mapped within ' + scores.radius_km +
  ' km of the pin — the same measurement and the same radius as the tiles under “What’s nearby”, except that a ring ' +
  'adds up categories the tiles list one by one; the healthcare count is topped up from the Ministry of Health ' +
  'register where OpenStreetMap has none. Where a count is zero there is no ring, because in The Gambia zero almost always means “not mapped” ' +
  'rather than “not there” — that is why some areas show fewer than four. Scores for safety and for transport used ' +
  'to sit here; nothing measurable stood behind either, so they are gone.';

const js = s => JSON.stringify(s);
const regelScores = g => {
  const rij = g.measures.map(m => `[${js(m.label)},${m.score},${js(m.desc)}]`);
  if (g.local) rij.push(`[${js(g.local.label)},null,${js(g.local.desc)}]`);
  return `var scores=[${rij.join(',')}];`;
};
const regelSG = () => 'var SG=' + JSON.stringify(scores.benchmark.scores) + ';';

/* compileert elk <script>-blok van de pagina; gooit bij een fout */
function compileerAlles(bron, bestand) {
  const blokken = [...bron.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
  let n = 0;
  for (const b of blokken) {
    const code = b[1].trim();
    if (!code || /application\/ld\+json/i.test(b[0])) continue;
    new vm.Script(code, { filename: bestand });
    n++;
  }
  if (!n) throw new Error(`${bestand}: geen enkel scriptblok gecontroleerd`);
  return n;
}

if (WRITE) await mkdir(BACKUP, { recursive: true });

let geraakt = 0, ringenTotaal = 0, blokkenTotaal = 0;
const mislukt = [];

for (const g of gebieden) {
  const bestand = g.slug + '.html';
  const bron = await readFile(bestand, 'utf8');

  const mScores = bron.match(/(?:var|const)\s+scores\s*=\s*\[.*?\];/s);
  const mSG = bron.match(/(?:var|const)\s+SG\s*=\s*\{.*?\};/s);
  const mBron = bron.match(/<!--mk-scoresrc--><p class="src">[\s\S]*?<\/p>/);
  if (!mScores || !mSG || !mBron) {
    mislukt.push(`${bestand}: ${!mScores ? 'geen scores[] ' : ''}${!mSG ? 'geen SG{} ' : ''}${!mBron ? 'geen bronregel' : ''}`);
    continue;
  }

  let nieuw = bron
    .replace(mSG[0], regelSG())
    .replace(mScores[0], regelScores(g))
    .replace(mBron[0], `<!--mk-scoresrc--><p class="src">${BRONREGEL}</p>`);

  /* Kololi draagt een eigen kopie van areas.css ín de pagina; een wijziging in
     areas.css alleen laat Kololi achter. Het rooster staat weer op vier vaste
     kolommen: vijf ringen pasten op een smaller scherm niet op één regel. */
  nieuw = nieuw.replace(/\.scores-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\);gap:16px\}/g,
    '.scores-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}');

  try { blokkenTotaal += compileerAlles(nieuw, bestand); }
  catch (e) { mislukt.push(`${bestand}: NIET GESCHREVEN — ${e.message}`); continue; }

  const oudAantal = (mScores[0].match(/\],\[/g) || []).length + 1 - (g.local ? 1 : 0);
  console.log(`  ${g.name.padEnd(18)} ${oudAantal} → ${g.measures.length} ringen` +
    (g.local ? `   lokaal: ${g.local.desc}` : ''));
  ringenTotaal += g.measures.length;

  if (WRITE) { await copyFile(bestand, `${BACKUP}/${bestand}`); await writeFile(bestand, nieuw); }
  geraakt++;
}

console.log(`\n${geraakt} van ${gebieden.length} pagina's; ${ringenTotaal} ringen in totaal ` +
  `(${(ringenTotaal / geraakt).toFixed(1)} gemiddeld); ${blokkenTotaal} scriptblokken gecompileerd.`);
if (mislukt.length) { console.log('\nNIET VERWERKT:'); for (const m of mislukt) console.log('  ' + m); }
if (geraakt !== 41) { console.log(`\nFOUT: 41 pagina's verwacht, ${geraakt} verwerkt.`); process.exit(1); }
if (WRITE) console.log(`\nGeschreven. Terugdraaien kan met --terug (kopieen in ${BACKUP}).`);
else console.log('\nNiets geschreven. Draai opnieuw met --write.');
