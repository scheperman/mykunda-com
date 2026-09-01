/* patch-schoolafstanden.mjs — haalt de afstanden uit het blok "Schools nearby".
 *
 *   node _werk/patch-schoolafstanden.mjs            toont wat er zou veranderen
 *   node _werk/patch-schoolafstanden.mjs --write    past de pagina's aan
 *   node _werk/patch-schoolafstanden.mjs --terug    zet alles terug
 *
 * Vanochtend gingen de kwaliteitsoordelen eruit. Wat overbleef was
 * [naam, initialen, type, afstand], en die afstand is het laatste getal op de
 * gebiedspagina's dat er als meting uitziet zonder er een te zijn.
 *
 * GEMETEN, niet aangenomen: van de 121 genoemde scholen zijn er 75 met naam en
 * niveau terug te vinden in OpenStreetMap. Bij die 75 wijkt de opgegeven
 * afstand mediaan 1,8 km af van de gekarteerde positie, met een uitschieter van
 * 19 km — Banjul zette "Methodist Academy 0,5 km" voor een school die tien
 * kilometer verderop staat. De namen kloppen dus grotendeels; de afstanden niet.
 *
 * Waarom niet gecorrigeerd maar verwijderd: een naamkoppeling die 46 van de 121
 * scholen niet vindt en onderweg "Basse Senior Secondary" aan een WAEC-kantoor
 * knoopt, is geen bron. En de lijst rechtstreeks uit OpenStreetMap halen levert
 * "Play Ground", "Kartong Youth Hall" en een veeteeltonderzoekscentrum op —
 * ook geen scholenlijst. Naam en schooltype blijven staan als wat ze zijn:
 * plaatselijke kennis, met een bronregel die dat zegt.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-schoolafstanden';
const MARK = '<!--mk-schoolsrc-->';

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`); process.exit(0);
}

/* NIET een stukje uit de renderregel knippen — dat is bij de eerste poging
   misgegaan: de weggehaalde tekst bevatte het sluitende aanhalingsteken van de
   ene string en het openende van de volgende, waarna er op 41 pagina's een
   string openstond. De hele opdracht wordt vervangen door één vaste vorm, wat
   meteen de drie schrijfwijzen (dubbele quotes, enkele quotes, template
   literal) tot één terugbrengt. */
const RENDER = /schoolList\.innerHTML\s*=\s*schools\.map\([\s\S]*?\)\.join\((['"`])\1\);/;
const NIEUWE_RENDER = "schoolList.innerHTML = schools.map(function(s){return '<div class=\"school\">" +
  "<div class=\"logo\">'+s[1].slice(0,2)+'</div><div class=\"info\"><div class=\"nm\">'+s[0]+" +
  "'</div><div class=\"meta\">'+s[2]+'</div></div></div>';}).join('');";

const BRON = 'Named from local knowledge; there is no public register of Gambian schools we can cite. ' +
  'A distance used to stand beside each name. Checked against the schools that OpenStreetMap has mapped, ' +
  'half of those distances were more than two kilometres out, so they are gone rather than quietly corrected.';

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, overgeslagen = 0, scholen = 0;
const diff = [`# Diffrapport blok "Schools nearby" — ${new Date().toISOString().slice(0, 10)}`, '',
  'De afstand achter elke schoolnaam is verwijderd. Naam en schooltype blijven.', '',
  '| gebied | scholen | verwijderde afstanden |', '|---|---|---|'];

for (const f of files) {
  const src = await readFile(f, 'utf8');
  const m = src.match(/((?:var|const) schools\s*=\s*)(\[[\s\S]*?\]);/);
  if (!m) continue;

  let rijen;
  try { rijen = Function('return ' + m[2])(); } catch (e) {
    console.log(`  ${f}: schoolarray niet te lezen — OVERGESLAGEN`); overgeslagen++; continue;
  }
  if (!rijen.every(r => Array.isArray(r) && r.length === 4)) {
    console.log(`  ${f}: onverwachte vorm (${rijen[0] && rijen[0].length} velden) — OVERGESLAGEN`); overgeslagen++; continue;
  }
  if (!RENDER.test(src)) { console.log(`  ${f}: renderregel niet herkend — OVERGESLAGEN`); overgeslagen++; continue; }

  let out = src
    .replace(m[2], () => JSON.stringify(rijen.map(r => [r[0], r[1], r[2]])))
    .replace(RENDER, () => NIEUWE_RENDER);

  /* Meteen controleren of het blok nog compileert: één stukgeknipte string
     kost anders 41 pagina's, en dat is vandaag al een keer gebeurd. */
  const script = out.match(/<script>(?:(?!<\/script>)[\s\S])*schoolList\.innerHTML[\s\S]*?<\/script>/);
  if (script) {
    try { new Function(script[0].replace(/^<script>/, '').replace(/<\/script>$/, '')); }
    catch (e) { console.log(`  ${f}: het blok compileert niet meer (${e.message}) — OVERGESLAGEN`); overgeslagen++; continue; }
  }

  if (!out.includes(MARK)) {
    const anker = '<div id="schoolList"></div>';
    if (!out.includes(anker)) { console.log(`  ${f}: schoolList niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
    out = out.replace(anker, anker + `\n        ${MARK}<p class="src">${BRON}</p>`);
  }

  diff.push(`| **${f.replace(/\.html$/, '')}** | ${rijen.map(r => r[0]).join(' · ')} | ${rijen.map(r => r[3]).join(' · ')} |`);
  scholen += rijen.length;
  geraakt++;
  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    if (!existsSync(`${BACKUP}/${f}`)) await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

await writeFile(`_werk/school-diff-${new Date().toISOString().slice(0, 10)}.md`, diff.join('\n') + '\n');
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s), ${scholen} scholen, overgeslagen ${overgeslagen}`);
if (geraakt !== 41) console.log(`LET OP: verwacht 41 pagina's, geraakt ${geraakt}.`);
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
