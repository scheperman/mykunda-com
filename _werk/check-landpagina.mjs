/* Controle op de Landpagina — draai na build-area-prices.mjs en na build.mjs.
 *
 *   node _werk/check-landpagina.mjs              de bron in de root
 *   node _werk/check-landpagina.mjs deploy       het gebouwde resultaat
 *
 * Bewaakt wat er stil kapot kan gaan: de generator die de FAQ-bedragen of het
 * FAQPage-blok niet meer kan schrijven, een tweede px-stamp, een aanbodsectie
 * die niet meer verborgen start, en de blokken die deze pagina nodig heeft.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIR = process.argv[2] || '.';
const FILE = join(DIR, 'land-for-sale-in-the-gambia.html');
const src = await readFile(FILE, 'utf8');

const fouten = [];
const ok = [];
const eis = (naam, voorwaarde, uitleg) =>
  voorwaarde ? ok.push(naam) : fouten.push(naam + (uitleg ? ' — ' + uitleg : ''));

/* 1. de tabel en de meetregel: eigendom van build-area-prices.mjs */
const rijen = (src.match(/<tr><td><a href="[a-z-]+\.html">/g) || []).length;
eis(`prijstabel: ${rijen} rijen`, rijen >= 15, 'te weinig rijen — herkende de generator ze nog?');
const stamps = (src.match(/<p class="px-stamp">/g) || []).length;
eis('precies een px-stamp', stamps === 1, `er zijn er ${stamps}`);
eis('kop van de tabel', /<th>Typical plot asking price<\/th>/.test(src));

/* 2. de FAQ: bedragen gevuld en structured data gelijk aan de zichtbare tekst */
const a1 = src.match(/<div class="a" id="faqA1">([\s\S]*?)<\/div>/);
eis('faqA1 aanwezig', !!a1);
if (a1) {
  const kaal = a1[1].replace(/<[^>]+>/g, '');
  eis('faqA1 heeft bedragen', /D[\d,.]+[kM]?/.test(kaal), 'geen enkel bedrag — de generator heeft hem niet gevuld');
  eis('faqA1 zonder lege plek', !/<b>\s*<\/b>/.test(a1[1]));
}
const vragen = [...src.matchAll(
  /<details[^>]*>\s*<summary>([\s\S]*?)<\/summary>\s*<div class="a"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/g)];
eis(`${vragen.length} FAQ-blokken`, vragen.length >= 5, 'minder dan vijf vragen gevonden');

const ld = src.match(/<script type="application\/ld\+json" id="mkFaqLd">\s*([\s\S]*?)\s*<\/script>/);
eis('mkFaqLd aanwezig', !!ld);
if (ld) {
  let j = null;
  try { j = JSON.parse(ld[1]); } catch (e) { fouten.push('mkFaqLd is geen geldige JSON — ' + e.message); }
  if (j) {
    eis('mkFaqLd is een FAQPage', j['@type'] === 'FAQPage');
    const n = (j.mainEntity || []).length;
    eis(`mkFaqLd telt ${n} vragen`, n === vragen.length,
      `de pagina toont er ${vragen.length} — structured data en zichtbare tekst lopen uiteen`);
    const kaal = s => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
    const mis = (j.mainEntity || []).filter((q, i) =>
      vragen[i] && (kaal(vragen[i][1]) !== q.name || kaal(vragen[i][2]) !== q.acceptedAnswer.text));
    eis('vragen en antwoorden gelijk aan de pagina', mis.length === 0,
      `${mis.length} wijken af, o.a.: ${mis[0] ? mis[0].name : ''}`);
  }
}

/* 3. de nieuwe blokken */
eis('aanbodsectie start verborgen', /<section class="px-band" id="landPlots" hidden/.test(src),
  'zonder hidden flitst er een lege sectie voordat het script hem uitzet');
eis('aanbodraster aanwezig', /id="landGrid"/.test(src));
eis('script gebruikt fetchLandListings', /fetchLandListings\(/.test(src));
eis('verkopersband', /class="sellband"/.test(src));
eis('leadband', /class="landband"/.test(src));
eis('anker #prices', /id="prices"/.test(src) && /href="#prices"/.test(src));
eis('link naar de diaspora-checklist', /diaspora-land-buying-checklist\.html/.test(src));
eis('link naar de waardebepaling', /href="sell\.html#value"/.test(src));

/* 4. structuur */
const open = (src.match(/<div\b/g) || []).length, dicht = (src.match(/<\/div>/g) || []).length;
eis(`divs in balans (${open}/${dicht})`, open === dicht);
const det = (src.match(/<details\b/g) || []).length, detD = (src.match(/<\/details>/g) || []).length;
eis(`details in balans (${det}/${detD})`, det === detD);

for (const r of ok) console.log('  ok   ' + r);
for (const f of fouten) console.log('  FOUT ' + f);
console.log(`\n${FILE}: ${ok.length} goed, ${fouten.length} fout`);
process.exit(fouten.length ? 1 : 0);
