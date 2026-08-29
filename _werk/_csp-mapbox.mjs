// Eenmalig: api.mapbox.com naast api.maptiler.com in de drie CSP-bestanden.
import { readFileSync, writeFileSync } from 'node:fs';
const files = ['_headers', '.htaccess', 'vercel.json'];
for (const f of files) {
  const t = readFileSync(f, 'utf8');
  if (t.includes('api.mapbox.com')) { console.log(f, 'al gedaan'); continue; }
  const n = t.replaceAll('https://api.maptiler.com', 'https://api.maptiler.com https://api.mapbox.com');
  writeFileSync(f, n);
  console.log(f, 'aangepast,', (n.match(/api\.mapbox\.com/g) || []).length, 'vermeldingen');
}
