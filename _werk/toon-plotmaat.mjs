import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const strip = s => s.replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&sup2;/g,'²').replace(/\s+/g,' ').trim();
for (const n of process.argv.slice(2)) {
  const html = await readFile(new URL(n + '.html', root), 'utf8');
  const blk = (html.match(/function updateAreaPrices\(\)\{[\s\S]*?\n\}/) || [''])[0];
  const t = new Map([...blk.matchAll(/\["([a-z0-9]+)",\s*(\d+)\]/gi)].map(m => [m[1], +m[2]]));
  console.log('=== ' + n + '   qs0=' + t.get('qs0') + '  qs1=' + t.get('qs1') + '  qs2=' + t.get('qs2'));
  [...html.matchAll(/<span[^>]*>([^<]*(?:m²|m&sup2;|plot|Plot|Land|House|Rent)[^<]*)<\/span>/g)]
    .map(m => strip(m[1])).filter(Boolean).slice(0,10).forEach(x => console.log('    ' + x));
  console.log();
}
