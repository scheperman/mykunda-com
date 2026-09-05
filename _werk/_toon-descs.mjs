import { readFileSync, readdirSync } from 'node:fs';
const a = JSON.parse(readFileSync('_werk/seo-audit.json', 'utf8'));
const P = a.pages || a;
const L = 'land-for-sale-in-the-gambia.html';
console.log('inkomende links naar de Landpagina volgens de audit:', P[L]?.inboundCount);
console.log('woorden:', P[L]?.words, '| JSON-LD:', JSON.stringify(P[L]?.ldTypes));
/* welke pagina's linken er echt naar, buiten de voettekst om */
const bron = [];
for (const f of readdirSync('deploy').filter(x => x.endsWith('.html'))) {
  const h = readFileSync('deploy/' + f, 'utf8');
  const ftr = h.indexOf('<!--mk-ftr-->');
  const body = ftr > 0 ? h.slice(0, ftr) : h;
  if (body.includes(L) && f !== L) bron.push(f);
}
console.log('\npagina\'s die er BUITEN de voettekst naar linken (' + bron.length + '):');
console.log(bron.join('\n') || '(geen)');
