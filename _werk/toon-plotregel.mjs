/* Toont de hele regel "Plot of 20 × 20 m" met zijn toelichtingskolom. */
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const strip = s => s.replace(/<[^>]+>/g,' | ').replace(/&nbsp;/g,' ').replace(/&sup2;/g,'²').replace(/&times;/g,'×').replace(/\s*\|\s*(\|\s*)+/g,' | ').replace(/\s+/g,' ').trim();
for (const n of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(n)) continue;
  const html = await readFile(new URL(n, root), 'utf8');
  if (!/Areas in The Gambia/.test(html) || /areas-in-the-gambia/.test(n)) continue;
  const blk = (html.match(/function updateAreaPrices\(\)\{[\s\S]*?\n\}/) || [''])[0];
  const t = new Map([...blk.matchAll(/\["([a-z0-9]+)",\s*(\d+)\]/gi)].map(m => [m[1], +m[2]]));
  const qs0 = t.get('qs0'), qs1 = t.get('qs1');
  if (!qs0 || !qs1) continue;
  const afw = Math.round((qs1 / (qs0 * 400) - 1) * 100);
  if (Math.abs(afw) < 2) continue;
  const rij = (html.match(/<div[^>]*>\s*<span[^>]*>Plot of[\s\S]*?<\/div>/) || [''])[0];
  console.log(n.replace('.html','').padEnd(14) + ' rate×400=' + (qs0*400).toLocaleString('en-US').padStart(10)
    + '  toont ' + qs1.toLocaleString('en-US').padStart(10) + '  (' + (afw>0?'+':'') + afw + '%)');
  console.log('   ' + strip(rij).slice(0, 190) + '\n');
}
