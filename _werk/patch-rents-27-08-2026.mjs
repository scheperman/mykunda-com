/* Eenmalige herijking van de huurcijfers in area-prices.json — 27-08-2026.
 *
 * Waarom: rent_year was op bijna elke pagina 2,0% van de vraagprijs van de
 * woning. Dat is een aanname, geen meting, en het bruto rendement van 2% dat
 * we publiceerden was diezelfde aanname die er weer uit kwam.
 *
 * Nu: mediaan van lokale advertenties voor een woning van 2+ slaapkamers,
 * met p25-p75 als band. Advertenties zonder leesbare periode zijn weggelaten,
 * niet geraden. Gebieden zonder bruikbaar huurbewijs krijgen geen huurcijfer.
 *
 *   node patch-rents.mjs           tonen wat er verandert
 *   node patch-rents.mjs --write   schrijven
 *
 * Dit script is eenmalig. Na de run mag het weg.
 */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const DB = JSON.parse(await readFile('area-prices.json', 'utf8'));

/* mid = mediaan van de waarnemingen, lo/hi = p25/p75 (bij n<=2 een brede band
   rond de enige waarneming). n telt de advertenties achter het cijfer. */
const RENT = {
  'bakau':       { lo:  60000, mid:  85000, hi: 120000, n: 1, src: 'thin' },
  'bakoteh':     { lo: 200000, mid: 340000, hi: 480000, n: 3, src: 'thin' },
  'bijilo':      { lo: 105000, mid: 125000, hi: 170000, n: 7, src: 'observed' },
  'brufut':      { lo:  85000, mid: 120000, hi: 140000, n: 3, src: 'thin' },
  'brusubi':     { lo: 135000, mid: 170000, hi: 210000, n: 4, src: 'thin' },
  'busumbala':   { lo:  70000, mid:  95000, hi: 135000, n: 1, src: 'thin' },
  'fajara':      { lo: 230000, mid: 325000, hi: 410000, n: 4, src: 'thin' },
  'kerr serign': { lo: 170000, mid: 190000, hi: 210000, n: 8, src: 'observed' },
  'kololi':      { lo: 200000, mid: 350000, hi: 450000, n: 3, src: 'thin' },
  'kotu':        { lo: 180000, mid: 230000, hi: 260000, n: 3, src: 'thin' },
  'lamin':       { lo:  70000, mid: 100000, hi: 140000, n: 1, src: 'thin' },
  'senegambia':  { lo: 215000, mid: 300000, hi: 425000, n: 1, src: 'thin' },
  'sukuta':      { lo: 120000, mid: 150000, hi: 250000, n: 9, src: 'observed' }
};

/* Niet opgenomen, met reden — dit hoort opgeschreven te staan, niet stilletjes:
 *   cape point, batokunku  enige waarneming is gemeubileerd; dat is de andere markt
 *   yundum                 enige waarneming is een compound van 4 slaapkamers en
 *                          geeft 11,8% rendement, tegen 1,5-4,7% overal elders
 *   jabang                 3 waarnemingen die 17x uit elkaar liggen
 *   banjul, brikama, gunjur, kartong, manjai kunda, nema kunku, pipeline,
 *   sanyang, serrekunda, sinchu alagie, tanji, tujereng
 *                          geen advertentie met een leesbare periode gevonden
 */

/* Kololi-grond: twee Songhai-kavels met opgegeven maat (20x20 m voor D4,0M en
   20x23 m voor D3,5M) komen op D10.000 en D7.609 per m2 uit, allebei boven de
   oude bovengrens van D9.160. Samen met de twee eerdere waarnemingen. */
const LAND = {
  'kololi': { gmd_m2: 8800, lo: 5900, hi: 13000, n: 4, src: 'thin' }
};

const changes = [];

for (const [key, r] of Object.entries(DB.areas)) {
  const was = r.rent_year;

  if (LAND[key]) {
    const L = LAND[key];
    changes.push(`${key.padEnd(14)} grond   D${r.gmd_m2} -> D${L.gmd_m2}/m2  (n=${r.n} -> ${L.n})`);
    Object.assign(r, { gmd_m2: L.gmd_m2, lo: L.lo, hi: L.hi, n: L.n, src: L.src });
    r.plot400  = Math.round(L.gmd_m2 * 400);
    r.usd_m2   = +(L.gmd_m2 / DB.fx.usd).toFixed(1);
    r.eur_m2   = +(L.gmd_m2 / DB.fx.eur).toFixed(1);
  }

  const R = RENT[key];
  if (R) {
    r.rent_year  = R.mid;
    r.rent_lo    = R.lo;
    r.rent_hi    = R.hi;
    r.rent_month = Math.round(R.mid / 12 / 500) * 500;
    r.rent_n     = R.n;
    r.rent_src   = R.src;
  } else {
    r.rent_year  = null;
    r.rent_lo    = null;
    r.rent_hi    = null;
    r.rent_month = null;
    r.rent_n     = 0;
    r.rent_src   = 'none';
  }

  /* Rendement is voortaan een uitkomst, nooit een invoer. */
  r.yield = (r.house && r.rent_year) ? +(r.rent_year / r.house * 100).toFixed(1) : null;

  if (was !== r.rent_year) {
    changes.push(`${key.padEnd(14)} huur    ${was === null ? '—' : 'D' + was} -> ` +
      `${r.rent_year === null ? '—' : 'D' + r.rent_year}   ${r.rent_src}` +
      `${r.rent_n ? ' n=' + r.rent_n : ''}` +
      `${r.yield ? '   rendement ' + r.yield + '%' : ''}`);
  }
}

/* De aanname die dit hele probleem veroorzaakte, hoort niet meer in het bestand. */
delete DB.assumptions.yield;

DB.method =
  'Vraagprijzen. Grond: mediaan van lokale kavelaanbiedingen in dalasi met opgegeven maat ' +
  '(Facebook Marketplace 25-08-2026, plus Songhai Properties, AccessGambia, Holprop, GamRealty). ' +
  'Woning: mediaan van lokale advertenties waar n>=3, anders afgeleid uit grondwaarde plus ' +
  'bouwkosten (valuation.js: EUR 300/m2, 120 m2 vloer, 400 m2 kavel). ' +
  'Huur: mediaan van lokale advertenties voor een woning van twee of meer slaapkamers, ' +
  'onmeubileerd, met p25-p75 als band; herijkt 27-08-2026. Advertenties zonder leesbare ' +
  'periode zijn weggelaten en niet geraden, losse kamers en studios tellen niet mee, en een ' +
  'gebied zonder bruikbaar huurbewijs krijgt geen huurcijfer. Huur wordt nooit uit de ' +
  'vraagprijs afgeleid. Upcountry: alleen grond.';

DB.sources.rent_obs = 45;
DB.generated = '2026-08-27';

console.log(changes.join('\n'));

/* Vangnet: een rendement buiten 1-8% betekent dat huur en vraagprijs uit twee
   verschillende markten komen. Dat was precies de fout die we aan het herstellen
   zijn, dus hij moet opvallen en niet stil blijven staan. */
for (const [k, r] of Object.entries(DB.areas)) {
  if (r.yield && (r.yield < 1 || r.yield > 8)) {
    console.log(`LET OP  ${k}: rendement ${r.yield}% ligt buiten 1-8% — controleer huur en vraagprijs.`);
  }
}

const withRent = Object.values(DB.areas).filter(a => a.rent_year).length;
console.log(`\n${withRent} gebieden met een huurcijfer, ` +
            `${Object.values(DB.areas).filter(a => a.rent_src === 'none').length} zonder.`);

/* Zelfde vorm terugschrijven als hij had: één regel per gebied, anders is elke
   volgende diff onleesbaar en zie je niet meer welk bedrag er veranderd is. */
function serialise(db) {
  const areas = db.areas;
  const rest = { ...db }; delete rest.areas;
  const head = Object.entries(rest)
    .map(([k, v]) => '  ' + JSON.stringify(k) + ': ' + JSON.stringify(v) + ',')
    .join('\n');
  const body = Object.entries(areas)
    .map(([k, v]) => '    ' + JSON.stringify(k) + ': ' + JSON.stringify(v))
    .join(',\n');
  return '{\n' + head + '\n  "areas": {\n' + body + '\n  }\n}\n';
}

if (WRITE) {
  const out = serialise(DB);
  JSON.parse(out);                       // nooit een kapot bestand wegschrijven
  await writeFile('area-prices.json', out);
  console.log('area-prices.json geschreven.');
} else {
  console.log('Proefdraai. Voeg --write toe om te schrijven.');
}
