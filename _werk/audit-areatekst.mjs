/* audit-areatekst.mjs — hoeveel van de tekst op een gebiedspagina is uniek?
 *
 * Gebruik: node _werk/audit-areatekst.mjs
 *
 * Bondiger schrijven begint met weten wát er staat. Dit script knipt de lopende
 * tekst van elke gebiedspagina in alinea's en vergelijkt ze onderling: een
 * alinea die op tientallen pagina's bijna letterlijk terugkomt is standaardtekst
 * en kan één keer worden ingekort; een alinea die maar op één pagina staat is
 * de eigen inhoud van dat gebied en verdient meer voorzichtigheid.
 */
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

const strip = s => s.replace(/<script[\s\S]*?<\/script>/gi,' ')
                    .replace(/<style[\s\S]*?<\/style>/gi,' ')
                    .replace(/<[^>]+>/g,' ')
                    .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#\d+;|&[a-z]+;/gi,' ')
                    .replace(/\s+/g,' ').trim();

/* Twee alinea's zijn "dezelfde standaardtekst" als ze op de plaatsnaam en de
   getallen na gelijk zijn. Die maskeren we dus weg voor de vergelijking. */
const namen = [];
const paginas = [];
for (const naam of (await readdir(root)).filter(n => n.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(naam) || /areas-in-the-gambia/.test(naam)) continue;
  const html = await readFile(new URL(naam, root), 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const alineas = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => strip(m[1])).filter(t => t.split(' ').length > 6);
  namen.push(naam.replace(/\.html$/,''));
  paginas.push({ naam: naam.replace(/\.html$/,''), alineas });
}
const plaatsnamen = namen.map(n => n.replace(/-/g,'[- ]?')).join('|');
const masker = t => t
  .replace(new RegExp(plaatsnamen, 'gi'), '«plaats»')
  .replace(/D[\d,.]+/g, '«bedrag»')
  .replace(/\d[\d,.]*/g, '«getal»')
  .toLowerCase();

const tel = new Map();
paginas.forEach(p => new Set(p.alineas.map(masker)).forEach(k => tel.set(k, (tel.get(k)||0)+1)));

let totaal = 0, standaard = 0;
paginas.forEach(p => p.alineas.forEach(a => {
  const w = a.split(' ').length; totaal += w;
  if (tel.get(masker(a)) >= 10) standaard += w;
}));

console.log(`${paginas.length} gebiedspagina's, ${totaal} woorden lopende tekst in totaal`);
console.log(`daarvan standaardtekst (zelfde alinea op 10+ pagina's): ${standaard} woorden = ${Math.round(standaard/totaal*100)}%`);
console.log(`gemiddeld per pagina: ${Math.round(totaal/paginas.length)} woorden, waarvan ${Math.round(standaard/paginas.length)} standaard\n`);

console.log('De standaardalinea\'s, van meest naar minst gebruikt:');
console.log('(woorden × pagina\'s = totale ruimte die de tekst inneemt)\n');
[...tel.entries()].filter(([,n]) => n >= 5).sort((a,b) => b[1]-a[1]).forEach(([k,n]) => {
  const vb = paginas.flatMap(p=>p.alineas).find(a => masker(a) === k) || '';
  const w = vb.split(' ').length;
  console.log(`${String(n).padStart(3)} pagina's × ${String(w).padStart(3)} woorden = ${String(n*w).padStart(5)}`);
  console.log(`     ${vb.slice(0,220)}${vb.length>220?'…':''}\n`);
});
