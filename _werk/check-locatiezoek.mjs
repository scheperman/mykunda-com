/* check-locatiezoek.mjs — controleert het locatiezoeken van de List-pagina.
 *
 * Waarom: op 30-08-2026 bleek dat een verkoper die "Palma Rima Road" intikte
 * geen suggestie kreeg en een kaart die bleef staan. Mapbox kent Gambia niet op
 * straatniveau; sindsdien staat het eigen register (gambia-osm.json) voorop.
 * Dit script draait de zoeklogica uit app.js op dat bestand, zonder browser en
 * zonder netwerk, zodat een volgende bouw niet stil terugvalt.
 *
 *   node _werk/check-locatiezoek.mjs
 */
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('gambia-osm.json', root), 'utf8'));
const appSrc = await readFile(new URL('app.js', root), 'utf8');
const appMin = await readFile(new URL('app.min.js', root), 'utf8');

let fouten = 0;
const eis = (ok, wat) => { console.log((ok ? '  ok   ' : '  FOUT ') + wat); if (!ok) fouten++; };

/* 1. Het bestand zelf */
eis(data.format === 1, 'gambia-osm.json heeft format 1');
eis(Array.isArray(data.items) && data.items.length > 2000,
    `register bevat ${data.items ? data.items.length : 0} namen (verwacht > 2000)`);
eis(/OpenStreetMap/i.test(data.source || ''), 'bronvermelding OpenStreetMap staat erin');
const foutRegel = data.items.find(a => typeof a[0] !== 'string' || typeof a[1] !== 'number' ||
                                       typeof a[2] !== 'number' || !data.kinds[a[3]]);
eis(!foutRegel, 'elke regel is [naam, lat, lng, soort]' + (foutRegel ? ' — mis: ' + JSON.stringify(foutRegel) : ''));
const buiten = data.items.filter(a => a[1] < 12.9 || a[1] > 14.0 || a[2] < -17.2 || a[2] > -13.6);
eis(buiten.length === 0, 'alle coördinaten liggen in Gambia' + (buiten.length ? ` — ${buiten.length} erbuiten` : ''));

/* 2. De code die het gebruikt, staat er nog — ook geminificeerd */
for (const naam of ['mkOsmIndex', 'mkLocalGeocode', 'mkRemoteGeocode', 'mkGeocode']) {
  eis(appSrc.includes('window.' + naam), `app.js definieert ${naam}`);
  eis(appMin.includes(naam), `app.min.js bevat ${naam} (build gedraaid?)`);
}
eis(/window\.mkGeocode[\s\S]{0,400}mkLocalGeocode/.test(appSrc),
    'mkGeocode zet het eigen register vóór de kaartleverancier');

/* 3. De zoeklogica, letterlijk dezelfde volgorde als in app.js */
const rows = data.items.map(a => ({ n: a[0], lc: String(a[0]).toLowerCase(), lat: a[1], lng: a[2], k: data.kinds[a[3]] }));
const KIND_W = { street: 0, place: 1, poi: 2 };
function rank(lc, q) {
  if (lc === q) return 0;
  if (lc.indexOf(q) === 0) return 1;
  if (lc.indexOf(' ' + q) > -1) return 2;
  if (lc.indexOf(q) > -1) return 3;
  return -1;
}
function zoek(q) {
  q = q.trim().toLowerCase();
  let hits = [];
  rows.forEach(r => { const s = rank(r.lc, q); if (s > -1) hits.push({ r, s }); });
  if (!hits.length) {
    const words = q.split(/\s+/).filter(w => w.length > 1);
    if (words.length > 1) rows.forEach(r => { if (words.every(w => r.lc.indexOf(w) > -1)) hits.push({ r, s: 4 }); });
  }
  hits.sort((a, b) => (a.s - b.s) || ((KIND_W[a.r.k] ?? 3) - (KIND_W[b.r.k] ?? 3)) || (a.r.n.length - b.r.n.length));
  return hits.map(h => h.r);
}

/* De gemeten gevallen van 30-08-2026: dit gaf Mapbox nul of iets 45 km verderop. */
const KM = (a, b) => {
  const R = 6371, d = Math.PI / 180;
  const x = (b.lat - a.lat) * d, y = (b.lng - a.lng) * d * Math.cos((a.lat + b.lat) / 2 * d);
  return Math.sqrt(x * x + y * y) * R;
};
const GEVALLEN = [
  ['Palma Rima Road',        13.4536, -16.7142],
  ['palma rima',             13.4536, -16.7142],
  ['Kairaba Avenue',         13.4493, -16.6784],
  ['Bertil Harding Highway', 13.4619, -16.6857],
  ['Coco Ocean',             13.4246, -16.7326],
  ['Senegambia',             13.4431, -16.7198],
  ['Turntable',              13.4066, -16.7300],
  ['Denton Bridge',          13.4679, -16.6281],
  ['Serrekunda Market',      13.4409, -16.6822],
  ['Bijilo',                 13.4219, -16.7328]
];
console.log('\n  zoekopdrachten die de kaart moeten verplaatsen:');
for (const [q, lat, lng] of GEVALLEN) {
  const top = zoek(q)[0];
  const afstand = top ? KM({ lat, lng }, top) : Infinity;
  eis(!!top && afstand < 2,
      `"${q}" -> ${top ? top.n + ' (' + afstand.toFixed(2) + ' km van verwacht)' : 'GEEN TREFFER'}`);
}

/* Onzin hoort geen treffer op te leveren: dan blijft de melding "not on our map"
   staan en dat is precies de bedoeling. */
console.log('\n  zoekopdrachten die niets mogen opleveren:');
for (const q of ['zzzqqxx', 'asdfghjkl straat']) eis(zoek(q).length === 0, `"${q}" -> geen treffer`);

/* 4. De vangnetten in list.html */
const list = await readFile(new URL('list.html', root), 'utf8');
console.log('\n  list.html:');
eis(/if\(geoHits\.length\)\{ useGeoHit\(geoHits\[0\]\); return; \}/.test(list),
    'Enter/blur neemt de klaarstaande treffer over');
eis(/mkGeocode\(val,\{limit:1\}\)/.test(list), 'Enter/blur zoekt alsnog als er niets klaarstond');
eis(/let locAdopted=''/.test(list) && /locInput\.value=label; locAdopted=label;/.test(list),
    'een aangeklikte suggestie wordt door de blur niet meer overschreven');

console.log(fouten ? `\n${fouten} FOUT(EN)\n` : '\nalles in orde\n');
process.exit(fouten ? 1 : 0);
