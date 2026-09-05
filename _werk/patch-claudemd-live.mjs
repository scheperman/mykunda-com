import { readFileSync, writeFileSync } from 'node:fs';
const P = 'CLAUDE.md';
let t = readFileSync(P, 'utf8');
if (t.includes('Live nagemeten op 05-09-2026')) { console.log('stond er al'); process.exit(0); }
const E = (t.match(/\r\n/g) || []).length > 100 ? '\r\n' : '\n';
const anker = 'Controleren: `node _werk/check-case-redirects.mjs` (bron) en `... deploy` (het';
if (!t.includes(anker)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const extra = [
  'Live nagemeten op 05-09-2026 na de upload met `node _werk/check-case-live.mjs`: acht',
  'van acht goed. `/Bijilo.html` (de URL met 132 vertoningen) geeft nu 301 naar',
  '`/bijilo.html`, net als `/Bakau.html`, een gids met hoofdletter en `/BUY.HTML`; de',
  'kleine-letterversies geven gewoon 200 en een onbekende URL nog steeds een echte 404.',
  '',
  'Ook live nagemeten: het IndexNow-sleutelbestand geeft 200 met de sleutel als inhoud,',
  'en een proefaanmelding van de homepage werd door IndexNow met 202 aangenomen.',
  '',
  anker
].join(E);
t = t.replace(anker, extra);
writeFileSync(P, t);
console.log('CLAUDE.md: live meting toegevoegd');
