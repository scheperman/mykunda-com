/* Zelfde meting als audit-areatekst.mjs, maar als JSON — voor het rapport. */
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const strip = s => s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#\d+;|&[a-z]+;/gi,' ')
  .replace(/\s+/g,' ').trim();
const namen = [], paginas = [];
for (const n of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(n) || /areas-in-the-gambia/.test(n)) continue;
  const html = await readFile(new URL(n, root), 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const alineas = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => strip(m[1])).filter(t => t.split(' ').length > 6);
  namen.push(n.replace('.html','')); paginas.push({ naam: n.replace('.html',''), alineas, nieuw: /What we have not measured here yet/.test(html) });
}
const re = new RegExp(namen.map(x=>x.replace(/-/g,'[- ]?')).join('|'), 'gi');
const masker = t => t.replace(re,'«p»').replace(/D[\d,.]+/g,'«b»').replace(/\d[\d,.]*/g,'«g»').toLowerCase();
const tel = new Map();
paginas.forEach(p => new Set(p.alineas.map(masker)).forEach(k => tel.set(k,(tel.get(k)||0)+1)));
const uit = paginas.map(p => {
  let st=0, ei=0;
  p.alineas.forEach(a => { const w=a.split(' ').length; (tel.get(masker(a))>=10 ? st+=w : ei+=w); });
  return { naam:p.naam, nieuw:p.nieuw, standaard:st, eigen:ei, totaal:st+ei };
}).sort((a,b)=>a.totaal-b.totaal);
console.log(JSON.stringify(uit));
