/* build-area-scores.mjs — bouwt area-scores.json voor het blok "Lifestyle scores".
 *
 *   node build-area-scores.mjs            toont wat eruit komt
 *   node build-area-scores.mjs --write    schrijft area-scores.json
 *
 * Tot 01-09-2026 stonden hier vijf handgezette getallen per gebied, 205 in
 * totaal, getoond als ringen met een benchmark en een verschil ("▼ 54") — wat
 * leest als een meting. Alleen Affordability had een methode, en die werd
 * nergens uitgevoerd. Wat hier overblijft is wat we kunnen uitrekenen:
 *
 *   Affordability   uit area-prices.json: de vraagprijs voor grond per m² op
 *                   een logschaal, waarbij het goedkoopste gemeten gebied 100
 *                   scoort en het duurste 0. Logaritmisch omdat de spreiding
 *                   dat is: Banjul is dertig keer Soma, niet dertig punten.
 *   Places to eat   uit area-amenities.json: restaurants, cafés en bars binnen
 *                   twee kilometer, ook op een logschaal. Alleen waar er iets
 *                   gekarteerd is; nul betekent hier "niet in kaart gebracht",
 *                   en dat is geen score van 0.
 *
 * Weg, en waarom:
 *   Safety          er bestaat geen Gambiaanse criminaliteitsstatistiek per
 *                   plaats. "70" voor Essau tegenover "66" voor Barra was niet
 *                   te verdedigen, en het is de gevoeligste van de vier.
 *   Transport       elke score zou een weging zijn van afstand, wegtype en
 *                   vervoersknopen, en die weging zouden we zelf verzinnen.
 *                   De reistijden onder "Getting around" beantwoorden dezelfde
 *                   vraag; die verdienen een eigen meting.
 *
 * De vijfde regel, de "local strength", houdt zijn label en omschrijving uit
 * _scores-data.json maar verliest zijn getal: het is een kwalificatie, geen
 * meting, en hoort er niet als ring uit te zien.
 */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const BENCH = 'senegambia';

const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const oud = JSON.parse(await readFile('_scores-data.json', 'utf8'));

/* welke gebieden hebben het blok? die staan in area-amenities.json */
const gebieden = Object.values(amen.areas);
const prijsPerSlug = new Map(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => [a.slug, a]));

const geld = n => 'D' + Math.round(n).toLocaleString('en-GB');

/* ── Affordability ───────────────────────────────────────────────────────── */
const prijzenLijst = gebieden.map(g => prijsPerSlug.get(g.slug)?.gmd_m2).filter(n => n > 0);
const pMin = Math.min(...prijzenLijst), pMax = Math.max(...prijzenLijst);
const betaalbaar = p => Math.round(100 * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin)));

/* ── Places to eat ───────────────────────────────────────────────────────── */
const eetLijst = gebieden.map(g => (g.counts.eat || 0) + (g.counts.bar || 0));
const eMax = Math.max(...eetLijst);
const eten = n => Math.round(100 * Math.log(1 + n) / Math.log(1 + eMax));

const rijen = {};
for (const g of gebieden) {
  const p = prijsPerSlug.get(g.slug);
  const n = (g.counts.eat || 0) + (g.counts.bar || 0);
  const maten = [];

  if (p && p.gmd_m2 > 0) maten.push({
    label: 'Affordability', score: betaalbaar(p.gmd_m2),
    desc: `${geld(p.gmd_m2)} per m² asking`, source: 'area-prices.json',
  });
  if (n > 0) maten.push({
    label: 'Places to eat', score: eten(n),
    desc: `${n} mapped within ${g.radius_km} km`, source: 'OpenStreetMap ' + g.measured_on,
  });

  const oudeRij = oud.areas[g.slug];
  const lokaal = oudeRij && oudeRij[4]
    ? { label: oudeRij[4][0], desc: oudeRij[4][2] }
    : null;

  rijen[g.name.toLowerCase()] = { slug: g.slug, name: g.name, measures: maten, local: lokaal };
}

const b = rijen[Object.keys(rijen).find(k => rijen[k].slug === BENCH)];
const benchmark = {};
for (const m of b.measures) benchmark[m.label] = m.score;

const uit = {
  about: 'Lifestyle scores per gebied. Alleen wat uit te rekenen is; zie build-area-scores.mjs voor wat er weg is en waarom.',
  built: new Date().toISOString().slice(0, 10),
  benchmark: { area: b.name, scores: benchmark },
  method: {
    Affordability: `100 × (ln(${Math.round(pMax)}) − ln(prijs)) / (ln(${Math.round(pMax)}) − ln(${Math.round(pMin)})), ` +
      `met de vraagprijs voor grond per m² uit area-prices.json. Goedkoopste gemeten gebied 100, duurste 0.`,
    'Places to eat': `100 × ln(1+n) / ln(1+${eMax}), met n = restaurants, cafés en bars binnen ` +
      `${amen.radius_km} km uit area-amenities.json. Geen ring waar n = 0: dat betekent niet gekarteerd.`,
    removed: 'Safety en Transport zijn verwijderd — geen bron, en elke score zou een eigen verzinsel zijn.',
  },
  sources: { prices: 'area-prices.json', amenities: amen.sources.osm, local: '_scores-data.json (kwalitatief, geen meting)' },
  areas: rijen,
};

console.log(`prijsbereik: ${geld(pMin)} – ${geld(pMax)} per m²; meeste eetgelegenheden: ${eMax}`);
console.log(`benchmark ${b.name}: ` + Object.entries(benchmark).map(([k, v]) => `${k} ${v}`).join(', ') + '\n');
for (const g of Object.values(rijen)) {
  console.log(`  ${g.name.padEnd(18)} ` +
    g.measures.map(m => `${m.label} ${String(m.score).padStart(3)} (${m.desc})`).join('  |  ') +
    (g.local ? `  |  lokaal: ${g.local.label}` : ''));
}
const zonderEten = Object.values(rijen).filter(g => g.measures.length < 2).length;
console.log(`\ngebieden zonder ring "Places to eat": ${zonderEten} van ${Object.keys(rijen).length}`);
if (WRITE) { await writeFile('area-scores.json', JSON.stringify(uit, null, 1)); console.log('geschreven: area-scores.json'); }
else console.log('Draai opnieuw met --write om area-scores.json te schrijven.');
