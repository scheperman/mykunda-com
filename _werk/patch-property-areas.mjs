/* patch-property-areas.mjs — zet het gebiedsblok op property.html om naar
 * property-areas.json.
 *
 *   node _werk/patch-property-areas.mjs            toont wat er zou veranderen
 *   node _werk/patch-property-areas.mjs --write    past property.html aan
 *   node _werk/patch-property-areas.mjs --terug    zet het terug
 *
 * Vier ingrepen:
 *   1  HOOD_DATA komt uit property-areas.json: 41 gebieden in plaats van 13,
 *      met de prijs en het bewijs uit dezelfde bron als de gebiedspagina;
 *   2  de terugval met verzonnen cijfers verdwijnt — een gebied dat we niet
 *      hebben gemeten krijgt geen blok. Die terugval zette de grondprijs op
 *      18,95 per m² en gaf vijf scores die nergens vandaan kwamen;
 *   3  Safety, Beach access, Connectivity en Investment demand gaan eruit; wat
 *      overblijft zijn de twee doorgerekende maten van de gebiedspagina;
 *   4  de link "Explore full neighborhood guide" wees op élke advertentie naar
 *      kololi.html. Die wijst nu naar het gebied van de advertentie zelf.
 */
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-property-areas';
const DOEL = 'property.html';

if (TERUG) {
  if (!existsSync(`${BACKUP}/${DOEL}`)) { console.log('Geen backup gevonden.'); process.exit(0); }
  await copyFile(`${BACKUP}/${DOEL}`, DOEL);
  console.log('teruggezet: ' + DOEL);
  process.exit(0);
}

const data = JSON.parse(await readFile('property-areas.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const datum = new Date(amen.sources.osm.match(/opgehaald (\d{4}-\d{2}-\d{2})/)[1] + 'T00:00:00Z')
  .toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const src = await readFile(DOEL, 'utf8');
let out = src;
const stap = [];

/* 1 + 2 + 3 — data en render ------------------------------------------------ */
const mData = out.match(/\/\/ neighborhood[^\n]*\n\s*const town = [^\n]*\n\s*const HOOD_DATA = \{[\s\S]*?\n\};/);
if (!mData) { console.error('HOOD_DATA niet gevonden — niets gedaan.'); process.exit(1); }

const compact = {};
for (const [naam, g] of Object.entries(data.areas)) {
  compact[naam] = { slug: g.slug, p: g.gmd_m2, e: g.price_src, n: g.eat, r: g.radius_km, s: g.scores };
}
const nieuweData =
  '// neighborhood — gegenereerd uit property-areas.json (build-property-areas.mjs).\n' +
  '// Niet met de hand bijwerken: de prijs hieronder komt uit dezelfde bron als de\n' +
  '// gebiedspagina, en twee kopieën van hetzelfde getal lopen altijd uit elkaar.\n' +
  '  const town = P.area.split(\'· \')[0].trim();\n' +
  '  const HOOD_DATA = ' + JSON.stringify(compact) + ';';
out = out.replace(mData[0], () => nieuweData);
stap.push('HOOD_DATA vervangen: ' + Object.keys(compact).length + ' gebieden');

const mRender = out.match(/\/\/ find matching hood data[\s\S]*?scorebars\.innerHTML = hood\.scores\.map\([\s\S]*?\.join\(''\);/);
if (!mRender) { console.error('renderblok niet gevonden — niets gedaan.'); process.exit(1); }

const nieuweRender = `// zoek het gebied van deze advertentie: eerst precies, anders een naam die
  // met een sleutel begint ("Brufut Heights" hoort bij Brufut). Langste sleutel
  // eerst, zodat een specifieker gebied wint zodra het er een krijgt.
  var hoodKey = Object.keys(HOOD_DATA).find(function(k){ return k.toLowerCase() === town.toLowerCase(); });
  if(!hoodKey){
    var lc = town.toLowerCase();
    hoodKey = Object.keys(HOOD_DATA).sort(function(a,b){ return b.length - a.length; })
      .find(function(k){ return lc.indexOf(k.toLowerCase() + ' ') === 0; });
  }
  var hood = hoodKey ? HOOD_DATA[hoodKey] : null;

  // Geen meting voor dit gebied? Dan geen blok. Hier stond tot 01-09-2026 een
  // terugval die de grondprijs op 18,95 per m² zette en vijf scores verzon.
  if(!hood){
    if(typeof hoodBlock!=='undefined' && hoodBlock) hoodBlock.hidden = true;
  } else {
    hoodIntro.textContent = 'What we have measured for ' + hoodKey + ' is on the area page: prices with their evidence, what is mapped nearby, and the schools.';
    var kaarten = '<div class="hstat-card"><div class="lab">Land, per m²</div><div class="num">' + fmtAreaPrice(hood.p) + '</div><div class="meta">' + hood.e + '</div></div>';
    if(hood.n > 0) kaarten += '<div class="hstat-card"><div class="lab">Places to eat</div><div class="num">' + hood.n + '</div><div class="meta">mapped within ' + hood.r + ' km</div></div>';
    hoodStats.innerHTML = kaarten;
    scorebars.innerHTML = hood.s.map(function(s){ return '<div class="scorebar"><span class="l">' + s[0] + '</span><div class="track"><div class="fill" style="width:' + s[1] + '%"></div></div><span class="sc">' + (s[1]/10).toFixed(1) + '</span></div>'; }).join('');
    if(typeof hoodLink!=='undefined' && hoodLink) hoodLink.href = hood.slug + '.html';
    if(typeof hoodLinkTxt!=='undefined' && hoodLinkTxt) hoodLinkTxt.textContent = 'Explore the ' + hoodKey + ' area guide';
  }`;
out = out.replace(mRender[0], () => nieuweRender);
stap.push('renderblok vervangen, terugval met verzonnen cijfers verwijderd');

/* 4 — markup ---------------------------------------------------------------- */
const oudBlok = '<div class="block">\n        <h2>The neighborhood</h2>';
if (!out.includes(oudBlok) && !out.includes('id="hoodBlock"')) {
  console.error('het blok "The neighborhood" niet gevonden — niets gedaan.'); process.exit(1);
}
if (!out.includes('id="hoodBlock"')) {
  out = out.replace(oudBlok, '<div class="block" id="hoodBlock">\n        <h2>The neighborhood</h2>');
  stap.push('id="hoodBlock" toegevoegd');
}

const oudeLink = '<a class="link-arrow" href="kololi.html" style="margin-top:20px;display:inline-flex">Explore full neighborhood guide <span id="hoodArr"></span></a>';
if (out.includes(oudeLink)) {
  out = out.replace(oudeLink,
    '<a class="link-arrow" id="hoodLink" href="areas-in-the-gambia.html" style="margin-top:20px;display:inline-flex">' +
    '<span id="hoodLinkTxt">Explore the area guide</span> <span id="hoodArr"></span></a>' +
    `\n        <p class="src">Land rate and the evidence beside it come from the same measurement as the area pages. ` +
    `Places to eat are counted in OpenStreetMap within ${amen.radius_km} km, on ${datum}. ` +
    `<a href="how-we-measure-prices.html">How we measure prices</a>.</p>`);
  stap.push('link wees naar kololi.html — nu naar het gebied zelf, met bronregel');
}

console.log(stap.map(s => '  ' + s).join('\n'));
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${DOEL} (${src.length} → ${out.length} tekens)`);
if (WRITE) {
  await mkdir(BACKUP, { recursive: true });
  if (!existsSync(`${BACKUP}/${DOEL}`)) await copyFile(DOEL, `${BACKUP}/${DOEL}`);
  await writeFile(DOEL, out);
} else {
  console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
}
