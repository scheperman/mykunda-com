/* check-csp.mjs — de drie CSP-bestanden moeten dezelfde regel dragen.
 *
 * Waarom: .htaccess, _headers en vercel.json liepen op 25-08-2026 al eens
 * uiteen, waardoor de OpenStreetMap-terugval live geblokkeerd zou zijn geweest.
 * Dit script vergelijkt ze letterlijk en toetst daarnaast of de hosts die de
 * site echt gebruikt erin staan.
 *
 *   node _werk/check-csp.mjs
 */
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const lees = async n => readFile(new URL(n, root), 'utf8');

let fouten = 0;
const eis = (ok, wat) => { console.log((ok ? '  ok   ' : '  FOUT ') + wat); if (!ok) fouten++; };
const normaliseer = s => s.replace(/\s+/g, ' ').trim();

const ht = await lees('.htaccess');
const hd = await lees('_headers');
const vc = await lees('vercel.json');

const uitHt = (ht.match(/^\s*Header set Content-Security-Policy "(.+)"\s*$/m) || [])[1];
const uitHd = (hd.match(/^\s*Content-Security-Policy:\s*(.+)$/m) || [])[1];
const uitVc = (JSON.parse(vc).headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy') || {}).value;

eis(!!uitHt, '.htaccess draagt een CSP');
eis(!!uitHd, '_headers draagt een CSP');
eis(!!uitVc, 'vercel.json draagt een CSP');
eis(normaliseer(uitHt || '') === normaliseer(uitHd || ''), '.htaccess en _headers zijn gelijk');
eis(normaliseer(uitHt || '') === normaliseer(uitVc || ''), '.htaccess en vercel.json zijn gelijk');

/* De report-only-regel in .htaccess is een reserveregel; hij moet meebewegen,
   anders zet je bij twijfel een verouderd beleid aan. */
const ro = (ht.match(/#\s*Header set Content-Security-Policy-Report-Only "(.+)"\s*$/m) || [])[1];
eis(!!ro && normaliseer(ro) === normaliseer(uitHt || ''), 'de report-only-reserveregel loopt gelijk');

/* Hosts die de site echt aanroept. Ontbreekt er een, dan is de functie stil
   kapot — precies wat er met de Meta Pixel gebeurde tot 30-08-2026. */
const richtlijn = (naam) => (normaliseer(uitHt || '').match(new RegExp(naam + ' ([^;]+)')) || [])[1] || '';
const VEREIST = [
  ['script-src',  'https://connect.facebook.net', 'Meta Pixel — het scriptbestand'],
  ['img-src',     'https://www.facebook.com',     'Meta Pixel — het baken /tr/'],
  ['connect-src', 'https://www.facebook.com',     'Meta Pixel — het baken via fetch'],
  ['img-src',     'https://api.mapbox.com',       'Mapbox-tegels'],
  ['connect-src', 'https://api.mapbox.com',       'Mapbox geocoding'],
  ['connect-src', 'https://*.supabase.co',        'Supabase'],
  ['img-src',     'https://tile.openstreetmap.org','OSM-terugval'],
];
console.log('\n  hosts die de site echt gebruikt:');
for (const [d, host, waarvoor] of VEREIST) eis(richtlijn(d).includes(host), `${d} bevat ${host} (${waarvoor})`);

/* Bewust NIET toegestaan. Staat het er toch, dan is dat een besluit dat
   iemand moet kunnen uitleggen. */
console.log('\n  bewust geweerd:');
eis(!normaliseer(uitHt || '').includes('cloudflareinsights'),
    "Cloudflare Insights staat er niet in (zou vóór de cookiekeuze draaien)");
eis(!normaliseer(uitHt || '').includes("'unsafe-eval'"), "'unsafe-eval' staat er niet in");

console.log(fouten ? `\n${fouten} FOUT(EN)\n` : '\nalles in orde\n');
process.exit(fouten ? 1 : 0);
