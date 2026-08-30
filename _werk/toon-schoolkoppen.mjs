import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
for (const n of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(n)) continue;
  const html = await readFile(new URL(n, root), 'utf8');
  if (!/Areas in The Gambia/.test(html) || /areas-in-the-gambia/.test(n)) continue;
  const m = html.match(/<h2>([^<]*(?:School|school|facilit)[^<]*)<\/h2>\s*\n\s*<p class="lead">([^<]*)</);
  if (m) console.log(n.replace('.html','').padEnd(16) + '| ' + m[1].padEnd(24) + '| ' + m[2].slice(0,70));
}
