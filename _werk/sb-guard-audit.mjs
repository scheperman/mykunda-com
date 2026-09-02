/* Zoekt blokken die een functie uit supabase.js aanroepen achter een
   typeof-hek, zonder dat er eerder in dezelfde <script>-tag op window.__sbReady
   is gewacht. Dat hek faalt dan stil, want supabase.js wordt asynchroon geladen. */
import { readFileSync } from 'node:fs';

const sbSrc = readFileSync('supabase.js', 'utf8');
const names = new Set();
for (const m of sbSrc.matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)) names.add(m[1]);

const pages = process.argv.slice(2);
let found = 0;
for (const p of pages) {
  const lines = readFileSync(p, 'utf8').split(/\r?\n/);
  let lastAwait = -1;
  const hits = [];
  lines.forEach((ln, i) => {
    if (/__sbReady/.test(ln)) lastAwait = i;
    const m = ln.match(/typeof\s+([A-Za-z_$][\w$]*)\s*===?\s*'function'/);
    if (m && names.has(m[1])) {
      // hoe ver terug lag de laatste __sbReady?
      hits.push({ line: i + 1, fn: m[1], gap: lastAwait < 0 ? Infinity : i - lastAwait });
    }
  });
  const bad = hits.filter(h => h.gap > 40);   // ruime marge: zelfde blok of vlak ervoor
  console.log('== ' + p + '  (' + hits.length + ' heks, ' + bad.length + ' zonder wachten in de buurt)');
  for (const h of bad) { console.log('   regel ' + h.line + ': ' + h.fn + (h.gap === Infinity ? '  (nergens gewacht)' : '  (laatste __sbReady ' + h.gap + ' regels eerder)')); found++; }
}
console.log(found === 0 ? '\nGeen onbewaakte blokken gevonden.' : '\n' + found + ' blok(ken) om na te lopen.');
