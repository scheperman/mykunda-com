/* Toont de exacte HTML-varianten van de twee alinea's die worden ingekort. */
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const zoek = process.argv[2] === '2' ? 'These figures are as honest' : 'is an <em>asking</em> price';
const varianten = new Map();
for (const n of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(n) || /areas-in-the-gambia/.test(n)) continue;
  const html = await readFile(new URL(n, root), 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  const m = [...html.matchAll(/<p[^>]*>[\s\S]*?<\/p>/gi)].filter(x => x[0].includes(zoek));
  if (!m.length) { console.log('GEEN TREFFER: ' + n); continue; }
  if (m.length > 1) console.log('LET OP ' + n + ': ' + m.length + ' treffers');
  const key = m[0][0];
  if (!varianten.has(key)) varianten.set(key, []);
  varianten.get(key).push(n.replace('.html',''));
}
console.log('\n' + varianten.size + ' varianten\n');
let i = 0;
for (const [tekst, paginas] of varianten) {
  console.log('--- variant ' + (++i) + '  (' + paginas.length + ' pagina\'s: ' + paginas.join(', ') + ')');
  console.log(tekst);
  console.log();
}
