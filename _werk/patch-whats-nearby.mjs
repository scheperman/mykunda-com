/* patch-whats-nearby.mjs — zet het blok "What's nearby" om van ingetypte
 * tekst naar de gemeten cijfers uit area-amenities.json.
 *
 *   node _werk/patch-whats-nearby.mjs            schrijft alleen het diffrapport
 *   node _werk/patch-whats-nearby.mjs --write    past de pagina's aan
 *   node _werk/patch-whats-nearby.mjs --terug    zet alles terug
 *
 * Vier ingrepen per pagina:
 *   1  de tegelarray krijgt de gemeten waarden;
 *   2  elke tegel krijgt het icoon van zijn eigen categorie (ze werden op
 *      volgorde uitgedeeld, waardoor "3 Mosques" een mes en vork kreeg);
 *   3  de lead onder de kop zegt wat er gemeten is, niet "key amenities";
 *   4  er komt een bronregel onder het rooster, in de stijl van de prijstabel.
 *
 * Twee codevormen. Veertig pagina's: `var amenData=[["16","Shops & bitiks"]]`
 * met een losse `var amenIc=[...]`. kololi.html: `const amen=[['40','..',fork]]`
 * met de icoonvariabele ín de rij. Wie alleen op amenData zoekt, slaat de
 * drukste gebiedspagina van de site over — dat is bij de audit één keer
 * gebeurd, en pas bij de tweede telling opgemerkt.
 *
 * De backup wordt alleen geschreven als hij er nog niet is, zodat een tweede
 * --write de originelen niet overschrijft met al gepatchte bestanden.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { ICONEN } from './amen-iconen.mjs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-whats-nearby';
const MARK = '<!--mk-amensrc-->';

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden — niets terug te zetten.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`);
  process.exit(0);
}

const data = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));
const datum = new Date(data.sources.osm.match(/opgehaald (\d{4}-\d{2}-\d{2})/)[1] + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const esc = s => s.replace(/&/g, '&amp;');
const icoon = cat => ICONEN[cat] || ICONEN.worship;

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, overgeslagen = 0;
const diff = [`# Diffrapport blok "What's nearby" — ${data.built}`, '',
  `Bron: ${data.sources.osm}`, `Register: ${data.sources.register}`,
  `Straal: ${data.radius_km} km hemelsbreed vanaf het punt in de JSON-LD van elke pagina.`,
  '', 'Wat eruit gaat is met de hand ingetypt en heeft geen bron; wat erin komt is geteld.',
  '', '| gebied | was | wordt |', '|---|---|---|'];

for (const f of files) {
  const g = perSlug.get(f.replace(/\.html$/, ''));
  if (!g) continue;
  const src = await readFile(f, 'utf8');

  const mVar = src.match(/var amenData=(\[.*?\]);/s);
  const mConst = src.match(/const amen=(\[.*?\]);/s);
  if (!mVar && !mConst) { console.log(`  ${f}: geen tegelarray gevonden — OVERGESLAGEN`); overgeslagen++; continue; }

  let out = src;
  if (mVar) {
    const arr = '[' + g.tiles.map(t => `["${t.n}","${esc(t.label)}"]`).join(',') + ']';
    const ic = '[' + g.tiles.map(t => JSON.stringify(icoon(t.cat))).join(',') + ']';
    const mIc = out.match(/var amenIc=(\[.*?\]);/s);
    if (!mIc) { console.log(`  ${f}: var amenIc niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
    out = out.replace(mVar[1], () => arr).replace(mIc[1], () => ic);
  } else {
    const arr = '[' + g.tiles.map(t =>
      `['${t.n}','${esc(t.label)}',${JSON.stringify(icoon(t.cat))}]`).join(',') + ']';
    out = out.replace(mConst[1], () => arr);
  }

  const leadRe = /(<h2>What['’]s nearby<\/h2>\s*<p class="lead">)([^<]*)(<\/p>)/;
  if (!leadRe.test(out)) { console.log(`  ${f}: lead onder de kop niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
  out = out.replace(leadRe, (heel, a, oud, b) => a + `What is mapped within ${g.radius_km} km of ${g.name}.` + b);

  if (!out.includes(MARK)) {
    const anker = '<div class="amen-map" id="hoodMap"></div>\n        </div>';
    if (!out.includes(anker)) { console.log(`  ${f}: kaartanker niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
    const reg = g.register.length ? ' Health facilities also from the Ministry of Health regional register.' : '';
    out = out.replace(anker, anker + `\n        ${MARK}<p class="src">Counted in OpenStreetMap on ${datum}, ` +
      `within ${g.radius_km} km of the point on the map.${reg} What is not mapped is not shown — that means ` +
      `no one has recorded it, not that it is not there.</p>`);
  }

  /* "was" komt uit de backup als die er is: na een eerdere --write staat op de
     pagina zelf al de nieuwe tegel, en dan zou het rapport zichzelf vergelijken */
  const bron = existsSync(`${BACKUP}/${f}`) ? await readFile(`${BACKUP}/${f}`, 'utf8') : src;
  const mOud = bron.match(/var amenData=(\[.*?\]);/s) || bron.match(/const amen=(\[.*?\]);/s);
  const oud = Function('return ' + mOud[1].replace(/,\s*[A-Za-z_$][\w$]*\s*\]/g, ']'))();
  diff.push(`| **${g.name}** | ${oud.map(r => `${r[0]} ${r[1]}`).join(' · ')} | ` +
    `${g.tiles.map(t => `${t.n} ${t.label}`).join(' · ')} |`);

  geraakt++;
  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    if (!existsSync(`${BACKUP}/${f}`)) await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

await writeFile(`_werk/amen-diff-${data.built}.md`, diff.join('\n') + '\n');
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s), overgeslagen ${overgeslagen}`);
console.log(`diffrapport: _werk/amen-diff-${data.built}.md`);
if (geraakt !== 41) console.log(`LET OP: verwacht 41 pagina's, geraakt ${geraakt} — kijk hierboven welke ontbreekt.`);
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
