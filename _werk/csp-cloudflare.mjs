/* Voegt de twee Cloudflare-Web-Analytics-bronnen toe aan elke CSP in het
   project: static.cloudflareinsights.com voor het laden van beacon.min.js en
   cloudflareinsights.com voor de POST naar /cdn-cgi/rum. Beide zijn nodig;
   alleen script-src uitbreiden levert een stillere fout op.

   Exacte tekstvervanging, geen regex over de hele regel, zodat een gewijzigde
   CSP hier hard stukloopt in plaats van stil iets anders te doen. */
import { readFileSync, writeFileSync } from 'node:fs';

const PAREN = [
  [ "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
    "script-src 'self' 'unsafe-inline' https://connect.facebook.net https://static.cloudflareinsights.com" ],
  [ "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com https://api.mapbox.com https://api.modempay.com https://www.facebook.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.maptiler.com https://api.mapbox.com https://api.modempay.com https://www.facebook.com https://cloudflareinsights.com" ],
];

let totaal = 0;
for (const f of ['.htaccess', '_headers', 'vercel.json']) {
  let txt = readFileSync(f, 'utf8');
  let n = 0;
  for (const [oud, nieuw] of PAREN) {
    if (txt.includes(nieuw)) { console.log('   ' + f + ': stond er al'); continue; }
    const treffers = txt.split(oud).length - 1;
    if (treffers === 0) { console.log('   ' + f + ': FRAGMENT NIET GEVONDEN — niets gewijzigd'); continue; }
    txt = txt.split(oud).join(nieuw);
    n += treffers;
  }
  if (n) { writeFileSync(f, txt); console.log('== ' + f + ': ' + n + ' vervanging(en)'); totaal += n; }
  else   { console.log('== ' + f + ': ongewijzigd'); }
}
console.log('\nTotaal ' + totaal + ' vervangingen.');
