/* check-schoollijsten.mjs — vangrail voor het blok "Schools nearby".
 *
 *   node check-schoollijsten.mjs
 *
 * Er hoort in dit blok geen getal meer te staan: geen kwaliteitsoordeel en
 * geen afstand. Wat er wél staat — naam, initialen, schooltype — is
 * plaatselijke kennis, en de bronregel zegt dat.
 */
import { readFile, readdir } from 'node:fs/promises';

const OORDELEN = /^(Excellent|Very good|Good|Adequate|Satisfactory|Poor)$/i;
const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const gebiedSlugs = new Set(Object.values(prijzen.areas).filter(v => v && v.slug).map(v => v.slug));
const files = (await readdir('.')).filter(f => f.endsWith('.html'));

let fout = 0, gecontroleerd = 0, scholen = 0, zonder = 0;
const meld = (f, m) => { console.log(`  FOUT ${f}: ${m}`); fout++; };

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  if (!gebiedSlugs.has(slug)) continue;
  const src = await readFile(f, 'utf8');
  const m = src.match(/(?:var|const) schools\s*=\s*(\[[\s\S]*?\]);/);
  if (!m) { zonder++; continue; }
  gecontroleerd++;

  let rijen;
  try { rijen = Function('return ' + m[1])(); } catch (e) { meld(f, 'schoolarray niet te lezen: ' + e.message); continue; }

  rijen.forEach((r, i) => {
    scholen++;
    if (r.length !== 3) meld(f, `school ${i + 1} heeft ${r.length} velden, verwacht 3 (naam, initialen, type)`);
    for (const veld of r) {
      if (typeof veld !== 'string') { meld(f, `school ${i + 1} heeft een veld dat geen tekst is`); continue; }
      if (OORDELEN.test(veld.trim())) meld(f, `school ${i + 1} draagt nog een kwaliteitsoordeel: "${veld}"`);
      if (/^\s*\d+(\.\d+)?\s*km\s*$/i.test(veld)) meld(f, `school ${i + 1} draagt nog een afstand: "${veld}"`);
    }
  });

  if (/class="rt"/.test(src.match(/schoolList\.innerHTML[^;]*/)?.[0] || '')) meld(f, 'de renderregel tekent nog een oordeelkolom');
  if (/class="dist"/.test(src.match(/schoolList\.innerHTML[^;]*/)?.[0] || '')) meld(f, 'de renderregel tekent nog een afstandkolom');
  if (!src.includes('<!--mk-schoolsrc-->')) meld(f, 'geen bronregel onder het blok');
}

console.log(`\ngecontroleerd: ${gecontroleerd} pagina's, ${scholen} scholen, ${zonder} zonder blok ` +
  `(samen ${gecontroleerd + zonder} van de ${gebiedSlugs.size})`);
console.log(fout ? `${fout} fout(en) gevonden.` : 'Geen fouten.');
process.exit(fout ? 1 : 0);
