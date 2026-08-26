/* Drie reparaties na de eerste browsertest van de omgebouwde sell.html.
   Draaien vanuit de projectmap. */
import { readFileSync, writeFileSync } from 'node:fs';
const uit = [];

/* 1 - NAAMSBOTSING. app.js gebruikt de globale naam MK_AREAS al voor het
       gebiedenmenu van de hele site (AREA_REGIONS). Onze tarieventabel
       gebruikte diezelfde naam. Omdat app.min.js als laatste laadt won die,
       en waren onze tarieven weg. Was de volgorde andersom geweest, dan was
       het menu op elke pagina kapot geweest. Wij wijken uit naar MK_RATES. */
for (const f of ['_extract-areas.mjs', 'valuation-areas.js']) {
  let s = readFileSync(f, 'utf8');
  if (s.includes('MK_AREAS')) {
    writeFileSync(f, s.split('MK_AREAS').join('MK_RATES'));
    uit.push(f + ': MK_AREAS -> MK_RATES');
  }
}
let s = readFileSync('sell.html', 'utf8');
const voor = s;

if (s.includes('window.MK_AREAS || {LAND:{},LABELS:{}}')) {
  s = s.replace('window.MK_AREAS || {LAND:{},LABELS:{}}', 'window.MK_RATES || {LAND:{},LABELS:{}}');
  uit.push('sell.html: de flow leest nu MK_RATES');
}

/* 2 - CASCADEFOUT. De regel die de inhoud van een afgeronde stap opvouwt
       miste de .done-kwalificatie, waardoor elke stap leeg bleef. */
const a2 = '.mkv-step.done>h3,.mkv-step.done>.mkv-hint,.mkv-step .mkv-body{display:none}';
if (s.includes(a2)) {
  s = s.replace(a2, '.mkv-step.done>h3,.mkv-step.done>.mkv-hint,.mkv-step.done .mkv-body{display:none}');
  uit.push('sell.html: .mkv-body wordt alleen nog verborgen bij een afgeronde stap');
}

/* 3 - De datalist en de gebiedsherkenning hangen aan dezelfde tabel. */
if (s.includes('var AREAS = window.MK_RATES')) uit.push('sell.html: gebiedentabel gekoppeld');

if (s !== voor) writeFileSync('sell.html', s);
console.log(uit.map(x => '  - ' + x).join('\n') || '  (niets te doen)');
