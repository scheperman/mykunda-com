/* patch-getting-around.mjs — zet het blok "Getting around" om van 200
 * handgeschreven reistijden naar gemeten afstand over de weg.
 *
 *   node _werk/patch-getting-around.mjs            alleen het diffrapport
 *   node _werk/patch-getting-around.mjs --write    past de pagina's aan
 *   node _werk/patch-getting-around.mjs --terug    zet alles terug
 *
 * Vier ingrepen:
 *   1  de regels komen uit area-travel.json: afstand in plaats van tijd;
 *   2  modeIc krijgt een veerbooticoon, want een route over de Banjul–Barra
 *      ferry met een auto-icoontje ernaast klopt niet;
 *   3  de lead zegt wat er staat: afstand over de weg, niet "typical times";
 *   4  een bronregel onder het blok die zegt waarom er géén tijd staat.
 *
 * Twee codevormen, alweer: veertig pagina's met `var commutes=[[a,b,c]]` en
 * kololi.html met `const commutes=[[a,icoon,b,c]]`. En modeIc bestaat in twee
 * aanhalingstekenvarianten.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-getting-around';
const MARK = '<!--mk-travelsrc-->';

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`); process.exit(0);
}

const data = JSON.parse(await readFile('area-travel.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));

const svg = d => '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';
const FERRY_SVG = svg('<path d="M3 18c2 1 3 1 5 0s3-1 5 0 3 1 5 0M5 18l-1-5h16l-1 5M8 13V8h8v5M12 8V5"/>');

const afstand = km => km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, overgeslagen = 0;
const diff = [`# Diffrapport blok "Getting around" — ${data.built}`, '',
  data.method, '',
  'Er staat voortaan afstand in plaats van tijd. Waarom: OSRM rijdt de getagde',
  'maximumsnelheid zonder verkeer (Serrekunda–Banjul in tien minuten, waar de',
  'pagina 25 zei), en geeft de veerboot een modelsnelheid van 5 km/u — 59',
  'minuten voor een overtocht van 35, terwijl juist het wachten telt.', '',
  '| gebied | was | wordt |', '|---|---|---|'];

for (const f of files) {
  const g = perSlug.get(f.replace(/\.html$/, ''));
  if (!g) continue;
  const src = await readFile(f, 'utf8');
  let out = src;

  const mC = out.match(/((?:var|const) commutes\s*=\s*)(\[[\s\S]*?\]);/);
  if (!mC) { console.log(`  ${f}: commutes niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
  const kololiVorm = /,\s*(walk|car|ferry)\s*,/.test(mC[2]);

  const rijen = g.rows.map(r => kololiVorm
    ? `['${r.to.replace(/'/g, "\\'")}',${r.mode === 'Walk' ? 'walk' : 'car'},'${r.mode}','${afstand(r.km)}']`
    : `["${r.to.replace(/"/g, '\\"')}","${r.mode}","${afstand(r.km)}"]`);
  out = out.replace(mC[2], () => '[' + rijen.join(',') + ']');

  /* modeIc: veerboot erbij. Kololi heeft geen modeIc en geen veerregel. */
  const mIc = out.match(/((?:var|const) modeIc\s*=\s*function\(m\)\{return m===(['"])Walk\2\?)(['"])([\s\S]*?)\3(:)(['"])([\s\S]*?)\6(;\};)/);
  if (mIc) {
    const q = mIc[3], walkSvg = mIc[4], carSvg = mIc[7];
    const nieuw = `${mIc[1].replace(/\?$/, '')}? ${q}${walkSvg}${q} : (m.indexOf('erry')>-1 ? ` +
      `${q}${FERRY_SVG.replace(/"/g, q === '"' ? '\\"' : '"')}${q} : ${q}${carSvg}${q});};`;
    out = out.replace(mIc[0], () => nieuw);
  } else if (!kololiVorm && !/m\.indexOf\('erry'\)/.test(out)) {
    console.log(`  ${f}: modeIc niet herkend — OVERGESLAGEN`); overgeslagen++; continue;
  }
  /* modeIc al eerder omgebouwd? Dan is er niets te doen, en dat is geen fout —
     anders slaat een tweede run alles over en blijft de data half bijgewerkt. */

  const leadRe = /(<h2>Getting around<\/h2>\s*<p class="lead">)([^<]*)(<\/p>)/;
  if (!leadRe.test(out)) { console.log(`  ${f}: lead niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
  out = out.replace(leadRe, (h, a, o, b) => a + `Distance by road from ${g.name}.` + b);

  if (!out.includes(MARK)) {
    const anker = '<div class="commute-list" id="commuteList"></div>';
    if (!out.includes(anker)) { console.log(`  ${f}: commuteList niet gevonden — OVERGESLAGEN`); overgeslagen++; continue; }
    const veer = g.rows.some(r => r.ferry);
    out = out.replace(anker, anker + `\n        ${MARK}<p class="src">Shortest route on the OpenStreetMap road ` +
      `network, measured with OSRM.${veer ? ' Routes marked as ferry cross on the Banjul–Barra ferry.' : ''} ` +
      `We do not publish travel times: the road model drives the posted speed with no traffic, and it gives the ` +
      `ferry a fixed speed rather than the wait that actually decides your morning.</p>`);
  }

  const bron = existsSync(`${BACKUP}/${f}`) ? await readFile(`${BACKUP}/${f}`, 'utf8') : src;
  const mOud = bron.match(/(?:var|const) commutes\s*=\s*(\[[\s\S]*?\]);/);
  const oud = Function('return ' + mOud[1].replace(/,\s*(walk|car|ferry)\s*,/g, ','))();
  diff.push(`| **${g.name}** | ${oud.map(r => `${r[0]} ${r[r.length - 1]}`).join(' · ')} | ` +
    `${g.rows.map(r => `${r.to} ${afstand(r.km)}${r.ferry ? ' (ferry)' : ''}`).join(' · ')} |`);

  geraakt++;
  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    if (!existsSync(`${BACKUP}/${f}`)) await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

await writeFile(`_werk/travel-diff-${data.built}.md`, diff.join('\n') + '\n');
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s), overgeslagen ${overgeslagen}`);
console.log(`diffrapport: _werk/travel-diff-${data.built}.md`);
if (geraakt !== 41) console.log(`LET OP: verwacht 41 pagina's, geraakt ${geraakt}.`);
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
