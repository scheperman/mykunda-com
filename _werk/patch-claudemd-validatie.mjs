import { readFileSync, writeFileSync } from 'node:fs';
const P = 'CLAUDE.md';
let t = readFileSync(P, 'utf8');
if (t.includes('Validatie gestart op 05-09-2026')) { console.log('stond er al'); process.exit(0); }
const E = (t.match(/\r\n/g) || []).length > 100 ? '\r\n' : '\n';
const anker = 'Ook live nagemeten: het IndexNow-sleutelbestand geeft 200 met de sleutel als inhoud,';
if (!t.includes(anker)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const extra = [
  'Validatie gestart op 05-09-2026 in Search Console (Pagina-indexering > Niet gevonden',
  '(404) > DETAILS WEERGEVEN > NIEUWE VALIDATIE STARTEN): 11 in behandeling, 0 mislukt.',
  'De vorige poging liep van 08-08 tot 11-08 en strandde op 10 in behandeling en 1',
  'mislukt. De elf URL\'s waren allemaal hoofdletter-varianten uit een oudere build:',
  '`/Bijilo.html`, `/Legal.html` (kaal en met `?doc=terms` / `?doc=cookies`),',
  '`/Search.html` (kaal, `?q=Brufut`, `?q=Cape%20Point` en `?q={search_term_string}` -',
  'die laatste komt uit de SearchAction in de JSON-LD), `/About.html` en',
  '`/Guide.html?slug=…` voor twee gidsen. Vóór het starten alle elf nagemeten met',
  '`node _werk/check-gsc-404.mjs`: ze komen alle elf op een 200 uit, de twee',
  '`Guide.html?slug=`-URL\'s via twee sprongen. Alleen deze categorie is gevalideerd;',
  '"Pagina met omleiding" (13) en "Soft 404" (1) blijven op Niet gestart staan, want daar',
  'is een 301 het bedoelde gedrag.',
  '',
  anker
].join(E);
t = t.replace(anker, extra);
writeFileSync(P, t);
console.log('CLAUDE.md: validatie vastgelegd');
