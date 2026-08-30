import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
for (const n of ['mamuda','latriya','jambanjelly','salagi','farato']) {
  const html = await readFile(new URL(n + '.html', root), 'utf8');
  const strip = s => s.replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&mdash;/g,'—').replace(/&ndash;/g,'–').replace(/\s+/g,' ').trim();
  console.log('=== ' + n);
  [...html.matchAll(/<(p|li)[^>]*>([\s\S]*?)<\/\1>/gi)].map(m => strip(m[2]))
    .filter(t => /\bpin\b/i.test(t))
    .forEach(t => console.log('   ' + t));
  console.log();
}
