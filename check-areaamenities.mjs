/* check-areaamenities.mjs — vangrail voor het blok "What's nearby".
 *
 *   node check-areaamenities.mjs
 *
 * Naar model van check-areaprices.mjs: toetst of wat er op de gebiedspagina
 * staat nog is wat area-amenities.json zegt, en of het blok zich aan zijn
 * eigen regels houdt. Eindigt met code 1 als er iets mis is, zodat het in een
 * keten kan meelopen.
 */
import { readFile, readdir } from 'node:fs/promises';

const TOEGESTAAN = new Set(['Clinics & hospitals', 'Clinic or hospital', 'Pharmacy', 'Pharmacies',
  'Market', 'Markets', 'Supermarket', 'Supermarkets', 'Shop', 'Shops & bitiks', 'Bank', 'Banks',
  'ATM', 'ATMs', 'Money transfer', 'Fuel station', 'Fuel stations', 'Ferry terminal',
  'Ferry terminals', 'Bus or taxi rank', 'Bus & taxi ranks', 'Mosque', 'Mosques', 'Church',
  'Churches', 'Place of worship', 'Places of worship', 'Restaurant or café', 'Restaurants & cafés',
  'Bar', 'Bars', 'Hotel or guesthouse', 'Hotels & guesthouses', 'Police station', 'Police stations',
  'Post office', 'Post offices', 'Government office', 'Government offices', 'Library', 'Libraries',
  'Nature reserve', 'Nature reserves',
  /* labels die uit het register mogen komen */
  'District hospital', 'District hospitals', 'Health centre', 'Health centres']);

const data = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));

/* Welke bestanden zijn gebiedspagina's? Niet aan de JSON-LD herkennen: de elf
   pagina's van augustus 2026 hebben een ander schema en vallen dan stil buiten
   de controle. area-prices.json is de lijst die alle 52 gebieden kent. */
const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const gebiedSlugs = new Set(Object.values(prijzen.areas).filter(v => v && v.slug).map(v => v.slug));
const files = (await readdir('.')).filter(f => f.endsWith('.html'));

let fout = 0, gecontroleerd = 0, zonderBlok = 0;
const meld = (f, m) => { console.log(`  FOUT ${f}: ${m}`); fout++; };

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  if (!gebiedSlugs.has(slug)) continue;
  const src = await readFile(f, 'utf8');
  const g = perSlug.get(slug);
  const heeftBlok = /var amenData=/.test(src) || /const amen=/.test(src);

  if (!g) {
    if (heeftBlok) meld(f, 'heeft een tegelarray maar staat niet in area-amenities.json');
    else zonderBlok++;
    continue;
  }
  if (!heeftBlok) { meld(f, 'staat in area-amenities.json maar heeft geen tegelarray'); continue; }
  gecontroleerd++;

  const m = src.match(/var amenData=(\[.*?\]);/s) || src.match(/const amen=(\[.*?\]);/s);
  let rijen;
  try {
    rijen = Function('return ' + m[1].replace(/,\s*[A-Za-z_$][\w$]*\s*\]/g, ']'))();
  } catch (e) { meld(f, 'tegelarray niet te lezen: ' + e.message); continue; }

  if (rijen.length > 6) meld(f, `${rijen.length} tegels — het rooster houdt er zes`);
  if (rijen.length !== g.tiles.length) meld(f, `${rijen.length} tegels op de pagina, ${g.tiles.length} in area-amenities.json`);

  rijen.forEach((r, i) => {
    const label = String(r[1]).replace(/&amp;/g, '&');
    const n = String(r[0]);
    if (!/^\d+$/.test(n)) meld(f, `tegel ${i + 1} telt niet maar schat: "${n}"`);
    else if (+n === 0) meld(f, `tegel ${i + 1} toont een nul — die hoort weg te vallen`);
    if (!TOEGESTAAN.has(label)) meld(f, `tegel ${i + 1} heeft een onbekend opschrift: "${label}"`);
    const bron = g.tiles[i];
    if (bron && (String(bron.n) !== n || bron.label !== label))
      meld(f, `tegel ${i + 1} is "${n} ${label}" maar area-amenities.json zegt "${bron.n} ${bron.label}"`);
  });

  if (!/<p class="src">Counted in OpenStreetMap on /.test(src)) meld(f, 'geen bronregel onder het rooster');
  const lead = src.match(/<h2>What['’]s nearby<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  const verwacht = `What is mapped within ${g.radius_km} km of ${g.name}.`;
  if (!lead) meld(f, 'lead onder de kop niet gevonden');
  else if (lead[1] !== verwacht) meld(f, `lead is "${lead[1]}" maar hoort "${verwacht}" te zijn`);

  const geo = src.match(/"latitude":([-\d.]+),"longitude":([-\d.]+)/);
  if (!geo) meld(f, 'geen JSON-LD-coördinaat');
  else if (Math.abs(+geo[1] - g.lat) > 1e-6 || Math.abs(+geo[2] - g.lon) > 1e-6)
    meld(f, `het meetpunt (${g.lat}, ${g.lon}) is niet meer het punt in de JSON-LD (${geo[1]}, ${geo[2]}) — opnieuw bouwen`);

  if (g.register.length && !/Ministry of Health regional register/.test(src))
    meld(f, 'gebruikt een registerregel maar noemt het register niet in de bronregel');
}

console.log(`\ngecontroleerd: ${gecontroleerd} gebiedspagina's met blok, ${zonderBlok} bewust zonder blok ` +
  `(samen ${gecontroleerd + zonderBlok} van de ${gebiedSlugs.size} gebieden in area-prices.json)`);
if (gecontroleerd + zonderBlok !== gebiedSlugs.size) {
  console.log('  FOUT: niet elk gebied uit area-prices.json heeft een pagina op schijf'); fout++;
}
console.log(fout ? `${fout} fout(en) gevonden.` : 'Geen fouten.');
process.exit(fout ? 1 : 0);
