/* Staat er nog een placeholder van het bouwscript in de zes nieuwe pagina's
   of in de twee overzichten? Zo ja, dan heeft build-area-prices.mjs iets
   niet vervangen en klopt er een bedrag niet.
   ("value":0 achter "Local plot listings" is géén rest: dat is een echt
   aantal van nul waarnemingen.) */
import { readFile } from 'node:fs/promises';
const bestanden = ['madiana.html', 'jambur.html', 'ghana-town.html', 'tintinto.html',
  'tranquil.html', 'old-yundum.html', 'areas-in-the-gambia.html', 'gambia-property-prices.html'];
const patronen = [/build-area-prices\.mjs/, />D0</, /\[\s*'[A-Za-z ]+'\s*,\s*0\s*\]/,
                  /"name":"Land asking price per m²","value":0/];
let fout = 0;
for (const f of bestanden) {
  const s = await readFile(f, 'utf8');
  for (const p of patronen) if (p.test(s)) { console.log('REST: ' + f + '  ' + p); fout++; }
  const m = s.match(/"name":"Land asking price per m²","value":(\d+)/);
  if (bestanden.indexOf(f) < 6) console.log(f.padEnd(20) + 'structured data: D' + (m ? m[1] : 'ONTBREEKT'));
}
console.log(fout ? '\n' + fout + ' resthaakje(s) — FOUT' : '\ngeen resthaakjes — ok');
