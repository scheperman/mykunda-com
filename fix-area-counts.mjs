/* fix-area-counts.mjs — eenmalig, maar veilig om opnieuw te draaien.
 *
 *     node fix-area-counts.mjs          toont wat er zou veranderen
 *     node fix-area-counts.mjs --write  past de pagina's aan
 *
 * Waarom: in de zijkolom van elke wijkpagina stond een HARDGECODEERD aantal
 * listings ("48 listings available now" op Kololi, 31 op Bijilo, 38 op Brufut,
 * ...), terwijl /buy zegt dat er nog niets te koop staat. Dat is een tegenspraak
 * op precies het punt waar de site om draait: controleerbaarheid.
 *
 * In supabase.js staat al `countAreaListings(areaName)`, met erboven het
 * commentaar "for area pages sidebar" — maar die functie werd nergens
 * aangeroepen. Het getal was dus voorbeeldtekst die is blijven staan. Dit
 * script koppelt de regel alsnog aan die functie.
 *
 * De regel begint verborgen (`hidden`) en wordt alleen zichtbaar als de telling
 * echt gelukt is. Laadt supabase.js niet, of geeft de query een fout, dan staat
 * er niets — beter geen getal dan een verzonnen getal.
 *
 * Het blokje gaat onderaan de pagina als eigen <script>, los van wat er verder
 * in de pagina staat; alleen kololi.html had een mini-listingscript om op aan te
 * haken, de andere veertig niet.
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');

/* De kop en het getal staan direct na elkaar in de zijkolom; in één greep
   hebben we zowel de gebiedsnaam als het oude getal. */
const CARD = /<h3>Property in ([^<]+)<\/h3>\s*<p>(\d+) listings available now<\/p>/;
const MARK = '<!--mk-areacount-->';

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let patched = 0, already = 0, skipped = 0;

for (const f of files) {
  const src = await readFile(f, 'utf8');
  if (src.includes(MARK)) { already++; continue; }

  const card = src.match(CARD);
  if (!card) continue;
  if (!/<\/body>/i.test(src)) {
    console.log(`  ${f}: geen </body> gevonden — overgeslagen`);
    skipped++;
    continue;
  }

  const area = card[1].trim();
  const oud = card[2];

  const blok = MARK + '\n<script>\n' +
    '/* Live telling in de zijkolom. Zie fix-area-counts.mjs. */\n' +
    '(async function(){\n' +
    "  var el = document.getElementById('areaCount'); if(!el) return;\n" +
    '  try{ await window.__sbReady; }catch(e){}\n' +
    "  if(typeof countAreaListings!=='function') return;\n" +
    "  if(typeof backendReady==='function' && !backendReady()) return;\n" +
    '  var n = null;\n' +
    `  try{ n = await countAreaListings('${area.replace(/'/g, "\\'")}'); }catch(e){}\n` +
    '  if(n===null || n===undefined) return;\n' +
    "  el.textContent = n===0 ? 'No listings here yet — be the first to list'\n" +
    "                 : n===1 ? '1 listing available now'\n" +
    "                 : n + ' listings available now';\n" +
    '  el.hidden = false;\n' +
    '})();\n' +
    '</script>\n';

  const out = src
    .replace(CARD, (m, a) => `<h3>Property in ${a}</h3>\n        <p id="areaCount" hidden></p>`)
    .replace(/<\/body>/i, blok + '</body>');

  console.log(`  ${f}: ${area} — hardgecodeerde ${oud} vervangen door een live telling`);
  if (WRITE) await writeFile(f, out);
  patched++;
}

console.log(
  `\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${patched} pagina(s)` +
  (already ? `, al gedaan: ${already}` : '') +
  (skipped ? `, overgeslagen: ${skipped}` : '')
);
if (!WRITE && patched) console.log('Draai opnieuw met --write om het echt weg te schrijven.');
