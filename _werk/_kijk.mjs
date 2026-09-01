import { readFile, readdir } from 'node:fs/promises';
const s = await readFile('essau.html', 'utf8');
const i = s.indexOf('var scores=');
console.log('=== scoreblok essau ===');
console.log(s.slice(i, i + 2200));
console.log('\n=== SG in app.js ===');
const app = await readFile('app.js', 'utf8');
const m = app.match(/SG\s*=\s*\{[^}]*\}/);
console.log(m ? m[0] : 'niet in app.js');
console.log('\n=== lead + kop ===');
console.log((s.match(/<h2>Lifestyle scores<\/h2>[\s\S]{0,400}/) || [''])[0]);
console.log('\n=== varianten over alle paginas ===');
const files = (await readdir('.')).filter(f => f.endsWith('.html'));
const vormen = new Map();
for (const f of files) {
  const t = await readFile(f, 'utf8');
  if (!/var scores=|const scores=/.test(t)) continue;
  const k = (t.match(/scoresGrid\.innerHTML\s*=\s*scores\.\w+\([^)]*\)/) || ['?'])[0];
  vormen.set(k, (vormen.get(k) || []).concat(f));
}
for (const [k, v] of vormen) console.log(`[${v.length}] ${k}  -> ${v.slice(0, 2).join(', ')}`);
