/* check-areatravel.mjs — vangrail voor het blok "Getting around".
 *
 *   node check-areatravel.mjs
 *
 * Toetst of de regels op de pagina nog zijn wat area-travel.json zegt, of er
 * geen tijd is teruggeslopen, en of het veerbooticoon werkt.
 */
import { readFile, readdir } from 'node:fs/promises';

const data = JSON.parse(await readFile('area-travel.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));
const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const gebiedSlugs = new Set(Object.values(prijzen.areas).filter(v => v && v.slug).map(v => v.slug));
const files = (await readdir('.')).filter(f => f.endsWith('.html'));
const afstand = km => km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';

let fout = 0, gecontroleerd = 0, zonder = 0, veerRegels = 0;
const meld = (f, m) => { console.log(`  FOUT ${f}: ${m}`); fout++; };

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  if (!gebiedSlugs.has(slug)) continue;
  const src = await readFile(f, 'utf8');
  const g = perSlug.get(slug);
  const heeft = /(?:var|const) commutes\s*=/.test(src);
  if (!g) { if (heeft) meld(f, 'heeft een reisblok maar staat niet in area-travel.json'); else zonder++; continue; }
  if (!heeft) { meld(f, 'staat in area-travel.json maar heeft geen reisblok'); continue; }
  gecontroleerd++;

  let rijen;
  try {
    rijen = Function('return ' + src.match(/(?:var|const) commutes\s*=\s*(\[[\s\S]*?\]);/)[1]
      .replace(/,\s*(walk|car|ferry)\s*,/g, ','))();
  } catch (e) { meld(f, 'commutes niet te lezen: ' + e.message); continue; }

  if (rijen.length !== g.rows.length) meld(f, `${rijen.length} regels op de pagina, ${g.rows.length} in area-travel.json`);
  rijen.forEach((r, i) => {
    const waarde = r[r.length - 1], modus = r[r.length - 2], doel = r[0];
    if (!/^\d+(\.\d)? km$/.test(waarde)) meld(f, `regel ${i + 1} toont "${waarde}" — dat is geen gemeten afstand`);
    const v = g.rows[i];
    if (!v) return;
    if (v.to !== doel) meld(f, `regel ${i + 1} gaat naar "${doel}" maar area-travel.json zegt "${v.to}"`);
    if (afstand(v.km) !== waarde) meld(f, `regel ${i + 1} toont ${waarde} maar area-travel.json zegt ${afstand(v.km)}`);
    if (v.mode !== modus) meld(f, `regel ${i + 1} heeft modus "${modus}" maar hoort "${v.mode}"`);
    if (v.ferry) veerRegels++;
  });

  if (g.rows.some(r => /erry/.test(r.mode)) && !/erry/.test(src.match(/modeIc[\s\S]{0,900}/)?.[0] || ''))
    meld(f, 'heeft een veerregel maar modeIc kent geen veerboot');
  if (!src.includes('<!--mk-travelsrc-->')) meld(f, 'geen bronregel onder het blok');
  const lead = src.match(/<h2>Getting around<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  if (!lead) meld(f, 'lead niet gevonden');
  else if (/typical times/i.test(lead[1])) meld(f, 'de lead belooft nog reistijden');
}

console.log(`\ngecontroleerd: ${gecontroleerd} pagina's, ${veerRegels} regels over de veerboot, ${zonder} bewust zonder blok ` +
  `(samen ${gecontroleerd + zonder} van de ${gebiedSlugs.size})`);
console.log(fout ? `${fout} fout(en) gevonden.` : 'Geen fouten.');
process.exit(fout ? 1 : 0);
