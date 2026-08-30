/* audit-areapaginas.mjs — wat staat er wél en niet op elke gebiedspagina?
 *
 * Gebruik: node _werk/audit-areapaginas.mjs [--csv]
 *
 * Leest elke pagina die de kruimel "Areas in The Gambia" draagt, en zet per
 * pagina op een rij: welke secties er staan, of er een kaart in zit, hoeveel
 * woorden de lopende tekst telt en hoe lang de langste alinea is. Zo is in één
 * blik te zien welke pagina's uit de pas lopen.
 */
import { readdir, readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);

const bestanden = (await readdir(root)).filter(n => n.endsWith('.html'));
const rijen = [];

const striptTags = s => s.replace(/<script[\s\S]*?<\/script>/gi,' ')
                         .replace(/<style[\s\S]*?<\/style>/gi,' ')
                         .replace(/<[^>]+>/g,' ')
                         .replace(/&[a-z]+;|&#\d+;/gi,' ')
                         .replace(/\s+/g,' ').trim();

for (const naam of bestanden) {
  const html = await readFile(new URL(naam, root), 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  if (/areas-in-the-gambia\.html$/.test(naam)) continue;
  if (/^(SEO-|Instructie-|_)/.test(naam)) continue;      /* interne documenten */

  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  const koppen = [...main.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(m => striptTags(m[1]));

  /* De kaart: de container, de aanroep die hem vult, en Leaflet zelf. De
     gebiedspagina's laden Leaflet pas als de kaart in beeld komt, dus alle drie
     moeten aanwezig zijn — een container zonder initAreaMap blijft leeg. */
  const kaartDiv = /id="hoodMap"/.test(html);
  const kaartJs  = /mkAreaMap\(/.test(html);
  const leaflet  = /vendor\/leaflet/.test(html);

  /* Alleen de lopende tekst: alinea's in main, zonder tabellen en kaarten. */
  const alineas = [...main.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => striptTags(m[1])).filter(t => t.split(' ').length > 6);
  const woorden = alineas.reduce((n,t) => n + t.split(' ').length, 0);
  const langste = alineas.reduce((n,t) => Math.max(n, t.split(' ').length), 0);

  rijen.push({
    pagina: naam.replace(/\.html$/,''),
    kb: Math.round(html.length/1024),
    koppen: koppen.length,
    kaart: kaartDiv && kaartJs && leaflet,
    kaartDiv, kaartJs, leaflet,
    woorden, alineas: alineas.length, langste,
    secties: koppen
  });
}

rijen.sort((a,b) => a.woorden - b.woorden);

if (process.argv.includes('--csv')) {
  console.log('pagina;kb;kaart;koppen;alineas;woorden;langste alinea');
  rijen.forEach(r => console.log([r.pagina,r.kb,r.kaart?'ja':'NEE',r.koppen,r.alineas,r.woorden,r.langste].join(';')));
} else {
  console.log('pagina'.padEnd(24), 'kaart', 'kop', 'al', 'woorden', 'langste');
  rijen.forEach(r => console.log(
    r.pagina.padEnd(24),
    (r.kaart?'ja   ':'NEE  '),
    String(r.koppen).padStart(3),
    String(r.alineas).padStart(3),
    String(r.woorden).padStart(7),
    String(r.langste).padStart(7)));
  console.log('\n' + rijen.length + ' gebiedspagina\'s');
  const zonder = rijen.filter(r => !r.kaart);
  console.log('zonder werkende kaart: ' + (zonder.length ? zonder.map(r=>r.pagina).join(', ') : 'geen'));

  /* Welke secties komen waar voor? Een sectie die op de meeste pagina's staat
     en op een enkele niet, is waarschijnlijk een gat en geen keuze. */
  const telling = new Map();
  rijen.forEach(r => new Set(r.secties).forEach(s => telling.set(s, (telling.get(s)||0)+1)));
  console.log('\nsecties, hoe vaak van de ' + rijen.length + ':');
  [...telling.entries()].sort((a,b)=>b[1]-a[1]).forEach(([s,n]) => {
    if (n === rijen.length) return;                    // overal aanwezig: geen nieuws
    const mist = rijen.filter(r => !r.secties.includes(s)).map(r=>r.pagina);
    console.log(String(n).padStart(3) + 'x  ' + s.slice(0,60) + (mist.length<=8 ? '   mist: ' + mist.join(', ') : ''));
  });
  console.log('\noveral aanwezig:');
  [...telling.entries()].filter(([,n])=>n===rijen.length).forEach(([s]) => console.log('     ' + s.slice(0,70)));
}
