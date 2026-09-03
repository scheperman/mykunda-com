// Eenmalig: vult sitemap-lastmod.json met de datum van de laatste ECHTE inhoudswijziging
// per pagina, gemeten door de git-geschiedenis terug te lopen met dezelfde hash die
// build.mjs gebruikt (zonder stempel, mk-mark, header/footer, css-blok).
// Gebruik: node _werk/seed-sitemap-lastmod.mjs [--write]
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const WRITE = process.argv.includes('--write');
const hash = html => createHash('sha256').update(html
  .replace(/\?v=\d+/g, '')
  .replace(/<!--mk-mark-->[\s\S]*?<!--\/mk-mark-->\n?/, '')
  .replace(/<!--mk-hdr-->[\s\S]*?<!--\/mk-hdr-->/, '')
  .replace(/<!--mk-ftr-->[\s\S]*?<!--\/mk-ftr-->/, '')
  .replace(/<!--mk-css-->[\s\S]*?<!--\/mk-css-->/, '')).digest('hex').slice(0, 16);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });

const sm = readFileSync('sitemap-pages.xml', 'utf8');
const files = [...sm.matchAll(/<loc>https:\/\/mykunda\.com\/([^<]*)<\/loc><lastmod>(\d{4}-\d{2}-\d{2})/g)].map(m => [m[1] || 'index.html', m[2]]);
const ledger = {}; const rows = [];
for (const [f, oldDate] of files) {
  const head = hash(readFileSync(f, 'utf8'));
  const log = git('log', '--format=%H %cs', '--', f).trim().split('\n').filter(Boolean).map(l => l.split(' '));
  let date = new Date().toISOString().slice(0, 10); // ongecommit gewijzigd t.o.v. HEAD
  let dirty = true;
  for (const [sha, d] of log) {
    let h; try { h = hash(git('show', `${sha}:${f}`)); } catch { break; }
    if (h !== head) break;
    date = d; dirty = false;
  }
  ledger[f] = { hash: head, lastmod: date };
  rows.push(`${f.padEnd(60)} ${oldDate} -> ${date}${dirty ? ' (ongecommit)' : ''}`);
}
console.log(rows.join('\n'));
if (WRITE) {
  writeFileSync('sitemap-lastmod.json', JSON.stringify(ledger, null, 1) + '\n');
  console.log(`\nsitemap-lastmod.json geschreven (${files.length} pagina's). Draai nu node build.mjs.`);
} else console.log('\n(proefdraai; --write om te schrijven)');
