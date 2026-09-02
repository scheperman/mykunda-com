/* check-areascores.mjs — vangrail voor het blok "Lifestyle scores".
 *
 *   node check-areascores.mjs
 *
 * Toetst of wat er op de pagina staat nog is wat area-scores.json zegt, en of
 * het blok zich aan zijn eigen regels houdt: alleen maten met een methode, de
 * local strength zonder getal, en een bronregel eronder. Eindigt met code 1
 * als er iets mis is.
 */
import { readFile, readdir } from 'node:fs/promises';

/* De vier maten die een methode hebben én in het rooster passen. Wie er een
   vijfde bij zet zonder die in build-area-scores.mjs uit te rekenen — of zonder
   het rooster te verbreden — loopt hier vast. "Transport points" is op
   02-09-2026 op verzoek verwijderd; hij staat er daarom bewust niet meer bij. */
const TOEGESTAAN = new Set(['Affordability', 'Everyday shopping', 'Places to eat', 'Healthcare']);
const MAX_RINGEN = 4;
const TIJDWOORD = /\b(minutes?|mins?|hours?|hrs?)\b|\b(five|ten|fifteen|twenty|twenty-five|thirty|forty|forty-five|fifty)\s+minutes\b/i;
const TELKEYS = {
  'Everyday shopping': ['shop', 'supermarket', 'market'],
  'Places to eat': ['eat', 'bar'],
  Healthcare: ['health', 'pharmacy'],
};
const data = JSON.parse(await readFile('area-scores.json', 'utf8'));
const perSlug = new Map(Object.values(data.areas).map(g => [g.slug, g]));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const amenPerSlug = new Map(Object.values(amen.areas).map(g => [g.slug, g]));
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
  const heeftBlok = /var scores=/.test(src);

  if (!g) { if (heeftBlok) meld(f, 'heeft een scoreblok maar staat niet in area-scores.json'); else zonderBlok++; continue; }
  if (!heeftBlok) { meld(f, 'staat in area-scores.json maar heeft geen scoreblok'); continue; }
  gecontroleerd++;

  let rijen;
  try { rijen = Function('return ' + src.match(/var scores=(\[[\s\S]*?\]);/)[1])(); }
  catch (e) { meld(f, 'scores niet te lezen: ' + e.message); continue; }

  const verwacht = [...g.measures.map(m => [m.label, m.score, m.desc]), [g.local.label, null, g.local.desc]];
  if (rijen.length !== verwacht.length) meld(f, `${rijen.length} regels op de pagina, ${verwacht.length} in area-scores.json`);
  if (rijen.length - 1 > MAX_RINGEN) meld(f, `${rijen.length - 1} ringen — het rooster houdt er ${MAX_RINGEN} op één regel`);

  rijen.forEach((r, i) => {
    const laatste = i === rijen.length - 1;
    if (laatste) {
      if (r[1] !== null) meld(f, `de local strength "${r[0]}" heeft nog een getal (${r[1]}) — die hoort weg`);
      if (TIJDWOORD.test(r[2] || '')) meld(f, `de local strength "${r[0]}" belooft nog een reistijd: "${r[2]}"`);
      return;
    }
    if (!TOEGESTAAN.has(r[0])) meld(f, `maat "${r[0]}" heeft geen methode en hoort hier niet`);
    if (typeof r[1] !== 'number' || r[1] < 0 || r[1] > 100) meld(f, `maat "${r[0]}" heeft geen geldige score: ${r[1]}`);
    const v = verwacht[i];
    if (v && (v[0] !== r[0] || v[1] !== r[1] || v[2] !== r[2]))
      meld(f, `regel ${i + 1} is "${r[0]} ${r[1]} ${r[2]}" maar area-scores.json zegt "${v[0]} ${v[1]} ${v[2]}"`);
  });

  const mSG = src.match(/var SG=(\{[^}]*\});/);
  if (!mSG) meld(f, 'var SG niet gevonden');
  else {
    const sg = Function('return ' + mSG[1])();
    for (const [k, v] of Object.entries(data.benchmark.scores))
      if (sg[k] !== v) meld(f, `benchmark ${k} is ${sg[k]} maar hoort ${v} te zijn`);
    for (const k of Object.keys(sg))
      if (!TOEGESTAAN.has(k)) meld(f, `benchmark bevat nog "${k}", een maat die niet meer bestaat`);
  }

  /* het getal onder de ring moet hetzelfde zijn als de telling in
     area-amenities.json, anders lopen ring en tegel uiteen */
  const gA = amenPerSlug.get(slug);
  if (gA) for (const r of rijen) {
    const keys = TELKEYS[r[0]];
    if (!keys) continue;
    const n = keys.reduce((s, k) => s + (gA.counts[k] || 0), 0);
    const opPagina = +(String(r[2]).match(/^(\d+)/) || [])[1];
    if (opPagina !== n) meld(f, `"${r[0]}" toont ${opPagina} maar area-amenities.json telt ${n}`);
  }

  if (/ring\(loc\[1\],0\)/.test(src)) meld(f, 'de local strength wordt nog als ring getekend');
  if (/scores\.slice\(0,4\)/.test(src)) meld(f, 'het rooster tekent nog vast vier ringen');
  if (!src.includes('<!--mk-scoresrc-->')) meld(f, 'geen bronregel onder het blok');
  const lead = src.match(/<h2>Lifestyle scores<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  if (!lead) meld(f, 'lead niet gevonden');
  else if (/four measures/i.test(lead[1])) meld(f, 'de lead belooft nog vier maten');
}

console.log(`\ngecontroleerd: ${gecontroleerd} gebiedspagina's met scoreblok, ${zonderBlok} bewust zonder ` +
  `(samen ${gecontroleerd + zonderBlok} van de ${gebiedSlugs.size})`);
if (gecontroleerd + zonderBlok !== gebiedSlugs.size) { console.log('  FOUT: niet elk gebied heeft een pagina'); fout++; }
console.log(fout ? `${fout} fout(en) gevonden.` : 'Geen fouten.');
process.exit(fout ? 1 : 0);
