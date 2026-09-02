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
  'rather than “not there” — that is why some areas show fewer than four. The outer arc is the median of the areas ' +
  'that have that measure, so half of them sit above it and half below; it used to be Senegambia, which is not a ' +
  'middle but an extreme — no area could ever beat its score for places to eat, and almost all of them beat it on ' +
  'price. Scores for safety and for transport used to sit here; nothing measurable stood behind either, so they are gone.';

/* Twaalf pagina's tonen minder dan vier ringen omdat OpenStreetMap in die
   categorie niets binnen 2 km kent. Dat stond alleen in het algemeen in de
   bronregel; nu noemt elke pagina haar eigen gat bij naam. */
const KLEIN = { 'Affordability': 'affordability', 'Everyday shopping': 'everyday shopping',
                'Places to eat': 'places to eat', 'Healthcare': 'healthcare' };
const opsomming = a => a.length === 1 ? a[0] : a.slice(0, -1).join(', ') + ' or ' + a[a.length - 1];
const GATZIN = g => {
  if (!g.missing || !g.missing.length) return '';
  const namen = g.missing.map(l => KLEIN[l] ?? l.toLowerCase());
  return g.missing.length === 1
    ? ` There is no ring for ${namen[0]} on this page: OpenStreetMap has nothing mapped in that category within ` +
      `${scores.radius_km} km of the pin.`
    : ` There are no rings for ${opsomming(namen)} on this page: OpenStreetMap has nothing mapped in those ` +
      `categories within ${scores.radius_km} km of the pin.`;
};

/* De lead boven het blok en het bijschrift onder het rooster. Beide noemden
   Senegambia als ijkpunt; dat is sinds 02-09-2026 de mediaan. */
const LEAD = naam => `What we can measure for ${naam}, set against the median of every area we measure ` +
  '&mdash; half of them score higher, half lower.';
const BENCHKEY = '<div class="bench-key"><i></i> Outer arc = the median of the areas we measure. ' +
  'The figure under each ring is the gap to it.</div>';

const js = s => JSON.stringify(s);
const regelScores = g => {
  const rij = g.measures.map(m => `[${js(m.label)},${m.score},${js(m.desc)}]`);
  if (g.local) rij.push(`[${js(g.local.label)},null,${js(g.local.desc)}]`);
  return `var scores=[${rij.join(',')}];`;
};
const regelSG = () => 'var SG=' + JSON.stringify(scores.benchmark.scores) + ';';

/* Het renderblok. Veertig pagina's dragen één en dezelfde versie; senegambia.html
   had een eigen versie zonder buitenboog en met "The benchmark" in plaats van een
   verschil, omdat het zelf het ijkpunt was. Met een mediaan is Senegambia een
   gebied als alle andere, dus krijgt het hetzelfde blok. Het sjabloon wordt uit
   een bestaande pagina gelezen in plaats van hier overgetypt. */
const SJABLOONBRON = 'pipeline.html';
const RENDERBLOK = /\(function\(\)\{\s*function ring\([\s\S]*?\}\)\(\);/;
const sjabloonSrc = await readFile(SJABLOONBRON, 'utf8');
const sjabloon = (sjabloonSrc.match(RENDERBLOK) || [null])[0];
for (const eis of ['function ring(', 'scoresGrid.innerHTML', 'scores.slice(0,-1)', 'bench-key']) {
  if (!sjabloon || !sjabloon.includes(eis)) {
    console.log(`FOUT: het renderblok in ${SJABLOONBRON} mist "${eis}" — niets geschreven.`);
    process.exit(1);
  }
}
const RENDER = sjabloon.replace(/<div class="bench-key">[\s\S]*?<\/div>/, BENCHKEY);
if (RENDER.includes('Senegambia')) { console.log('FOUT: het sjabloon noemt Senegambia nog.'); process.exit(1); }

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
  const mRender = bron.match(RENDERBLOK);
  const mLead = bron.match(/(<h2>Lifestyle scores<\/h2>\s*<p class="lead">)([^<]*)(<\/p>)/);
  if (!mScores || !mBron || !mRender || !mLead) {
    mislukt.push(`${bestand}: ${!mScores ? 'geen scores[] ' : ''}${!mBron ? 'geen bronregel ' : ''}` +
      `${!mRender ? 'geen renderblok ' : ''}${!mLead ? 'geen lead' : ''}`);
    continue;
  }

  /* vervangen met een functie, zodat $-tekens in de nieuwe tekst niet als
     $&-verwijzing worden gelezen */
  const zet = (tekst, oud, nieuwStuk) => tekst.replace(oud, () => nieuwStuk);
  let nieuw = zet(bron, mScores[0], (mSG ? '' : regelSG() + '\n') + regelScores(g));
  nieuw = zet(nieuw, mRender[0], RENDER);
  nieuw = zet(nieuw, mLead[0], mLead[1] + LEAD(g.name) + mLead[3]);
  nieuw = zet(nieuw, mBron[0], `<!--mk-scoresrc--><p class="src">${BRONREGEL}${GATZIN(g)}</p>`);
  if (mSG) nieuw = zet(nieuw, mSG[0], regelSG());

  /* Kololi draagt een eigen kopie van areas.css ín de pagina; een wijziging in
     areas.css alleen laat Kololi achter. Het rooster staat weer op vier vaste
     kolommen: vijf ringen pasten op een smaller scherm niet op één regel. */
  nieuw = nieuw.replace(/\.scores-grid\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(150px,1fr\)\);gap:16px\}/g,
    '.scores-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}');

  try { blokkenTotaal += compileerAlles(nieuw, bestand); }
  catch (e) { mislukt.push(`${bestand}: NIET GESCHREVEN — ${e.message}`); continue; }

  const oudAantal = (mScores[0].match(/\],\[/g) || []).length + 1 - (g.local ? 1 : 0);
  console.log(`  ${g.name.padEnd(18)} ${oudAantal} → ${g.measures.length} ringen` +
    (g.missing?.length ? `   gatzin: mist ${g.missing.join(', ')}` : ''));
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
