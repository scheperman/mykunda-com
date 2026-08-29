// Eenmalig: de preconnect-hint in alle pagina's van api.maptiler.com naar
// api.mapbox.com. De hint moet wijzen naar de host die de tegels echt levert,
// anders warmt de browser de verkeerde verbinding op.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
const OLD = '<link rel="preconnect" href="https://api.maptiler.com" crossorigin>';
const NEW = '<link rel="preconnect" href="https://api.mapbox.com" crossorigin>';
let n = 0;
for (const f of readdirSync('.')) {
  if (!f.endsWith('.html')) continue;
  const t = readFileSync(f, 'utf8');
  if (!t.includes(OLD)) continue;
  writeFileSync(f, t.replaceAll(OLD, NEW));
  n++;
}
console.log(n, 'pagina\'s aangepast');
