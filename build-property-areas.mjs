/* build-property-areas.mjs — bouwt property-areas.json: het gebiedsblok op de
 * advertentiepagina, uit dezelfde bestanden als de gebiedspagina's.
 *
 *   node build-property-areas.mjs            toont wat eruit komt
 *   node build-property-areas.mjs --write    schrijft property-areas.json
 *
 * Waarom dit bestand bestaat: property.html droeg tot 01-09-2026 een eigen
 * HOOD_DATA met dertien handgeschreven gebieden — 70 scores, 56 kerncijfers en
 * dertien introteksten, zonder bron. Twee dingen waren daar echt fout:
 *
 *   1  de prijs stond er ingetypt ('Land, per m²', 6460) terwijl dezelfde
 *      prijs op de gebiedspagina uit area-prices.json wordt gegenereerd. Bij
 *      de eerstvolgende herijking spreken de twee elkaar tegen op het enige
 *      getal waar het om gaat;
 *   2  de terugval voor de 39 gebieden zónder eigen blok zette de grondprijs
 *      op 18,95 per m² — een getal dat nergens vandaan komt — plus vijf
 *      verzonnen scores.
 *
 * Nu komt alles uit area-prices.json, area-amenities.json en area-scores.json,
 * en een gebied dat daar niet in staat krijgt niets in plaats van iets
 * verzonnens.
 */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');

const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const scores = JSON.parse(await readFile('area-scores.json', 'utf8'));

const amenPerSlug = new Map(Object.values(amen.areas).map(g => [g.slug, g]));
const scorePerSlug = new Map(Object.values(scores.areas).map(g => [g.slug, g]));

/* Het bewijs achter het tarief wordt niet hier opnieuw geformuleerd maar
   letterlijk van de gebiedspagina gelezen. Anders staan er twee bewoordingen
   voor hetzelfde bewijs op de site, en dat is precies het probleem dat dit
   bestand oplost. Draai daarom altijd eerst build-area-prices.mjs.
   Vier klassen: observed ("13 local plot listings"), band, derived ("no local
   observations — regional rate") en ref ("Brufut's rate — 7 listings there,
   1 here"). */
async function bewijs(slug) {
  try {
    const t = await readFile(slug + '.html', 'utf8');
    const m = t.match(/Evidence behind the land rate: <strong>([^<]*)<\/strong>/);
    if (m) return m[1].trim();
  } catch {}
  return null;
}

const gebieden = {};
for (const a of Object.values(prijzen.areas)) {
  if (!a || !a.slug || !(a.gmd_m2 > 0)) continue;
  const g = amenPerSlug.get(a.slug);
  const s = scorePerSlug.get(a.slug);
  if (!g || !s) continue;                       // geen blok op de gebiedspagina, dus ook hier niets
  gebieden[a.label] = {
    slug: a.slug,
    gmd_m2: a.gmd_m2,
    price_src: await bewijs(a.slug),
    eat: (g.counts.eat || 0) + (g.counts.bar || 0),
    radius_km: g.radius_km,
    scores: s.measures.map(m => [m.label, m.score]),
  };
}

const uit = {
  about: 'Het gebiedsblok op property.html. Gegenereerd; niet met de hand bijwerken.',
  built: new Date().toISOString().slice(0, 10),
  sources: {
    prices: 'area-prices.json',
    amenities: amen.sources.osm,
    scores: 'area-scores.json',
  },
  areas: gebieden,
};

const n = Object.keys(gebieden).length;
console.log(`gebieden met een blok: ${n} (was 13 met de hand, plus een terugval met verzonnen cijfers)`);
for (const [naam, g] of Object.entries(gebieden)) {
  console.log(`  ${naam.padEnd(18)} D${g.gmd_m2.toLocaleString('en-GB').padStart(7)} /m² (${g.price_src})` +
    `  eten ${String(g.eat).padStart(3)}  ` + g.scores.map(s => `${s[0]} ${s[1]}`).join(', '));
}
if (WRITE) { await writeFile('property-areas.json', JSON.stringify(uit, null, 1)); console.log('\ngeschreven: property-areas.json'); }
else console.log('\nDraai opnieuw met --write om property-areas.json te schrijven.');
