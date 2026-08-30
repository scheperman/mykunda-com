/* Toont de tekst onder de prijstabel zoals hij er nu staat, voor een paar pagina's. */
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const strip = s => s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&mdash;/g,'—').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
for (const n of (process.argv.slice(2).length ? process.argv.slice(2) : ['bakau','fajara','soma','mamuda'])) {
  const html = await readFile(new URL(n + '.html', root), 'utf8');
  console.log('=== ' + n);
  [...html.matchAll(/<p[^>]*>[\s\S]*?<\/p>/gi)].map(m => m[0])
    .filter(t => /asking<\/em> price|Reliable Gambian market data/.test(t))
    .forEach(t => console.log('   [' + strip(t).split(' ').length + ' w] ' + strip(t) + '\n'));
}
