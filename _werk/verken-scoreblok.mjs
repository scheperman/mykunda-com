/* verken-scoreblok.mjs — hoeveel varianten van het renderblok zijn er? */
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const varianten = new Map(), leads = new Map(), keys = new Map();
for (const g of Object.values(amen.areas)) {
  const src = await readFile(g.slug + '.html', 'utf8');
  const m = src.match(/\(function\(\)\{\s*function ring\([\s\S]*?\}\)\(\);/);
  const h = m ? createHash('sha1').update(m[0]).digest('hex').slice(0, 8) : 'GEEN';
  (varianten.get(h) || varianten.set(h, []).get(h)).push(g.slug);
  const l = src.match(/<h2>Lifestyle scores<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  const lt = l ? l[1].replace(g.name, '{gebied}') : 'GEEN';
  (leads.get(lt) || leads.set(lt, []).get(lt)).push(g.slug);
  const k = src.match(/<div class="bench-key">([\s\S]*?)<\/div>/);
  const kt = k ? k[1].replace(/<[^>]*>/g, '').trim() : 'GEEN';
  (keys.get(kt) || keys.set(kt, []).get(kt)).push(g.slug);
}
console.log('renderblokken:');
for (const [h, v] of varianten) console.log(`  ${h}  ${v.length} pagina's` + (v.length < 4 ? '  -> ' + v.join(', ') : ''));
console.log('\nleads:');
for (const [t, v] of leads) console.log(`  ${v.length}x  ${t.slice(0, 130)}` + (v.length < 4 ? '\n        -> ' + v.join(', ') : ''));
console.log('\nbench-key:');
for (const [t, v] of keys) console.log(`  ${v.length}x  ${t.slice(0, 130)}` + (v.length < 4 ? '  -> ' + v.join(', ') : ''));
