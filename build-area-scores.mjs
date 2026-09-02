/* build-area-scores.mjs — bouwt area-scores.json voor het blok "Lifestyle scores".
 *
 *   node build-area-scores.mjs            toont wat eruit komt
 *   node build-area-scores.mjs --write    schrijft area-scores.json
 *
 * Tot 01-09-2026 stonden hier vijf handgezette getallen per gebied, 205 in
 * totaal. Die zijn die dag teruggebracht tot twee doorgerekende maten, omdat
 * alleen die twee een bron hadden. Op 02-09-2026 zijn het er weer vier — niet
 * door de oude terug te zetten, maar door twee maten toe te voegen die uit
 * dezelfde meting komen als de twee die er al stonden.
 *
 * DE VIER MATEN
 *   Affordability      area-prices.json: vraagprijs voor grond per m², logschaal
 *   Everyday shopping  OSM: shop + supermarket + market binnen 2 km
 *   Places to eat      OSM: restaurant/café/fastfood + bar binnen 2 km
 *   Healthcare         OSM: kliniek/ziekenhuis + apotheek binnen 2 km, aangevuld
 *                      uit het register van het ministerie waar OSM nul kent
 *
 * Er is er even een vijfde geweest, "Transport points". Die is op 02-09-2026 op
 * verzoek weer weg: vijf ringen passen op een smaller scherm niet op één regel.
 * Vier is de bovengrens van dit blok — zie de opmerking bij TELMATEN.
 *
 * Alle drie de tellingen gebruiken dezelfde straal (2 km), dezelfde meting en
 * dezelfde ontdubbeling als de tegels in "What's nearby", zodat het getal onder
 * de ring en het getal in de tegel niet uiteen kunnen lopen.
 *
 * DE REGEL BIJ NUL
 *   Geen ring waar de telling nul is. In Gambia betekent nul bijna altijd
 *   "niet in kaart gebracht", niet "niet aanwezig" — Barra heeft zeker winkels,
 *   OSM kent ze niet. Een ring van 0 zou een bewering zijn die we niet kunnen
 *   waarmaken. Daardoor toont niet elke pagina vier ringen; de verdeling staat
 *   onderaan in de uitvoer van dit script. Dat is de eerlijke bovengrens van
 *   wat gemeten is.
 */

/* AFGEWEZEN KANDIDATEN, met de meting die ze afwees (_werk/verken-maten*.mjs,
 * 02-09-2026; rangcorrelatie is Spearman over de 41 gemeten gebieden)
 *
 *   Schools           dekking 39/41, en op zichzelf de sterkste kandidaat.
 *                     Afgewezen omdat de pagina eronder scholen bij naam noemt
 *                     uit plaatselijke kennis: op 14 van de 41 pagina's noemt
 *                     die lijst er MEER dan OSM binnen 2 km kent (Essau noemt
 *                     er drie, OSM kent er één). Twee getallen over hetzelfde
 *                     onderwerp die elkaar tegenspreken op één pagina — precies
 *                     waarom de tegel "Schools" er eerder al uit ging.
 *   Beach proximity   dekking 41/41 en heel betrouwbaar gemeten, maar
 *                     natural=coastline loopt in OSM door tot in de monding.
 *                     Banjul en Barra krijgen dan een "kust" van 0,35 km die de
 *                     rivier is. Waar het estuarium ophoudt en de oceaan begint
 *                     is een grens die IK zou moeten trekken. Blijft daarom een
 *                     tegel op de pagina's die zelf over strand spreken.
 *   Afstand tot Banjul  rangcorrelatie met de prijs −0,81. Dat is dezelfde ring
 *                     twee keer, gespiegeld.
 *   Kust als score    rangcorrelatie met de prijs −0,72. Zelfde bezwaar.
 *   Hotels & logies   rangcorrelatie met "Places to eat" 0,82. Voegt niets toe.
 *   Banken & geld     rangcorrelatie met "Everyday shopping" 0,79, dekking 25/41.
 *   Gebedshuizen      dekking 38/41 en het meest zelfstandig van alle tellingen,
 *                     maar een ring zegt "meer is beter". Over gebedshuizen is
 *                     dat geen meting maar een oordeel. Blijft een tegel.
 *   Safety            ongewijzigd afgewezen: er is geen Gambiaanse
 *                     criminaliteitsstatistiek per plaats.
 *   Transport als weging  ook ongewijzigd afgewezen. "Transport points" hieronder
 *                     is iets anders: het telt gekarteerde punten en weegt niets.
 */

import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');

/* HET IJKPUNT: DE MEDIAAN, NIET SENEGAMBIA (02-09-2026)
 *
 * De buitenste boog om elke ring was tot vandaag de score van Senegambia. Dat
 * gaf geen vergelijking maar een eenrichtingsmeting, want Senegambia is geen
 * midden maar een uiterste. Gemeten over de 41 gebieden (_werk/verken-benchmark.mjs):
 *
 *                       boven Senegambia   gelijk   onder        boven mediaan  gelijk  onder
 *   Affordability              31             9        1              18          12      11
 *   Everyday shopping           2             7       26              15           4      16
 *   Places to eat               0             3       32              16           2      17
 *   Healthcare                 13             8       14              13           8      14
 *
 * "Places to eat" was het duidelijkst: Senegambia scoort daar 100, de hoogste
 * van het land, dus geen enkel gebied kon er ooit boven uitkomen. Bij
 * Affordability precies andersom — Senegambia is bijna het duurste, dus stond
 * 31 van de 41 er automatisch boven. Alleen Healthcare was toevallig in balans,
 * omdat Senegambia daar toevallig óók de mediaan is (44).
 *
 * Het gemiddelde is afgewezen, ook gemeten: bij Affordability geeft het 15 boven
 * tegen 25 onder omdat die verdeling scheef is, en zes gebieden komen dan op elke
 * gemeten maat onder het ijkpunt uit. Met de mediaan is dat er nul.
 *
 * De mediaan wordt per maat genomen over de gebieden die die maat hebben (41
 * voor Affordability, 35 voor de tellingen) — niet over 41 met nullen erbij,
 * want een ontbrekende telling betekent "niet gekarteerd", geen nul. Bij een
 * even aantal is het het gemiddelde van de twee middelste, afgerond.
 */

const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const amen = JSON.parse(await readFile('area-amenities.json', 'utf8'));
const oud = JSON.parse(await readFile('_scores-data.json', 'utf8'));
const feat = JSON.parse(await readFile('area-features.json', 'utf8'));
const reis = JSON.parse(await readFile('area-travel.json', 'utf8'));

/* De "local strength" is een kwalificatie uit _scores-data.json en blijft dat.
   Drie omschrijvingen droegen nog een looptijd die nergens vandaan kwam — die
   zijn de ronde van 01-09-2026 ontsnapt omdat ze in scores[] stonden en niet in
   de kopstrook. Ze worden hier vervangen door de gemeten afstand, of door een
   zin zonder maat waar niets te meten valt. */
const kust = s => Object.values(feat.areas).find(a => a.slug === s)?.coast_km;
const reisKm = (s, naar) => Object.values(reis.areas).find(a => a.slug === s)
  ?.rows.find(r => r.to.toLowerCase().includes(naar))?.km;
const afstand = n => (n < 10 ? +n.toFixed(1) : Math.round(n)) + ' km';   /* zelfde afronding als de kopstrook */
const LOKAAL_HERSCHREVEN = {
  essau: 'Main road north to the Senegal border',
  kololi: `${afstand(kust('kololi'))} to the shore, as the crow flies`,
  yundum: `${afstand(reisKm('yundum', 'airport'))} to the airport by road`,
};

const gebieden = Object.values(amen.areas);
const prijsPerSlug = new Map(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => [a.slug, a]));
const geld = n => 'D' + Math.round(n).toLocaleString('en-GB');
const tel = (g, ks) => ks.reduce((s, k) => s + (g.counts[k] || 0), 0);

/* De drie tellingen. `keys` verwijst naar de categorieën van
   build-area-amenities.mjs, zodat ring en tegel niet uiteen kunnen lopen. */
const TELMATEN = [
  { label: 'Everyday shopping', keys: ['shop', 'supermarket', 'market'],
    een: 'shop or market', meer: 'shops & markets' },
  { label: 'Places to eat', keys: ['eat', 'bar'],
    een: 'place to eat', meer: 'places to eat' },
  { label: 'Healthcare', keys: ['health', 'pharmacy'],
    een: 'clinic or pharmacy', meer: 'clinics & pharmacies' },
];

/* WEG OP VERZOEK VAN EDWIN, 02-09-2026: "Transport points" (fuel + transport +
   ferry, 33/41). Niet omdat de meting niet deugde — die was even goed als de
   andere drie — maar omdat vijf ringen op een smaller scherm niet op één regel
   passen en het rooster dan breekt. Vier is de bovengrens van het blok.
   Wie er ooit een vijfde bij wil: verhoog dan eerst het rooster, en haal
   'Transport points' ook terug in TOEGESTAAN en TELKEYS van
   check-areascores.mjs — die vangrail wijst hem nu af. */

/* Logschaal, want de spreiding is dat ook: Senegambia heeft 93 eetgelegenheden
   en Bansang één. Lineair zou heel het land op 1 staan en Senegambia op 100. */
const maxima = {};
for (const m of TELMATEN) maxima[m.label] = Math.max(...gebieden.map(g => tel(g, m.keys)));
const logScore = (n, max) => Math.round(100 * Math.log(1 + n) / Math.log(1 + max));

const prijzenLijst = gebieden.map(g => prijsPerSlug.get(g.slug)?.gmd_m2).filter(n => n > 0);
const pMin = Math.min(...prijzenLijst), pMax = Math.max(...prijzenLijst);
const betaalbaar = p => Math.round(100 * (Math.log(pMax) - Math.log(p)) / (Math.log(pMax) - Math.log(pMin)));

const rijen = {};
for (const g of gebieden) {
  const p = prijsPerSlug.get(g.slug);
  const maten = [];

  if (p && p.gmd_m2 > 0) maten.push({
    label: 'Affordability', score: betaalbaar(p.gmd_m2),
    desc: `${geld(p.gmd_m2)} per m² asking`, source: 'area-prices.json',
  });

  for (const m of TELMATEN) {
    const n = tel(g, m.keys);
    if (n === 0) continue;                     /* nul = niet gekarteerd, geen ring */
    const uitRegister = m.label === 'Healthcare' && g.register.length && n === g.register.length;
    maten.push({
      label: m.label, score: logScore(n, maxima[m.label]),
      desc: `${n} ${n === 1 ? m.een : m.meer} within ${g.radius_km} km`,
      source: uitRegister ? 'Ministry of Health register' : 'OpenStreetMap ' + g.measured_on,
    });
  }

  const oudeRij = oud.areas[g.slug];
  const lokaal = oudeRij && oudeRij[4]
    ? { label: oudeRij[4][0], desc: LOKAAL_HERSCHREVEN[g.slug] ?? oudeRij[4][2] }
    : null;
  rijen[g.name.toLowerCase()] = { slug: g.slug, name: g.name, measures: maten, local: lokaal };
}

/* ijkpunt: de mediaan per maat, over de gebieden die die maat hebben */
const mediaan = a => { const s = [...a].sort((x, y) => x - y), n = s.length;
  return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2); };
const benchmark = {}, benchN = {};
for (const label of ['Affordability', ...TELMATEN.map(m => m.label)]) {
  const v = Object.values(rijen).map(g => g.measures.find(m => m.label === label)?.score)
                                .filter(x => x != null);
  if (!v.length) continue;
  benchmark[label] = mediaan(v);
  benchN[label] = v.length;
}

const uit = {
  about: 'Lifestyle scores per gebied. Alleen wat uit te rekenen is; zie build-area-scores.mjs voor de afgewezen kandidaten en waarom.',
  built: new Date().toISOString().slice(0, 10),
  radius_km: amen.radius_km,
  benchmark: {
    basis: 'median',
    about: 'Mediaan per maat over de gebieden die die maat hebben. Tot 02-09-2026 stond hier de score ' +
      'van Senegambia; dat was geen midden maar een uiterste — zie de kop van build-area-scores.mjs.',
    label_en: 'the median of every area we measure',
    scores: benchmark,
    n: benchN,
  },
  method: {
    Affordability: `100 × (ln(${Math.round(pMax)}) − ln(prijs)) / (ln(${Math.round(pMax)}) − ln(${Math.round(pMin)})), ` +
      'met de vraagprijs voor grond per m² uit area-prices.json. Goedkoopste gemeten gebied 100, duurste 0.',
    ...Object.fromEntries(TELMATEN.map(m => [m.label,
      `100 × ln(1+n) / ln(1+${maxima[m.label]}), met n = ${m.keys.join(' + ')} binnen ${amen.radius_km} km ` +
      'uit area-amenities.json. Geen ring waar n = 0: dat betekent niet gekarteerd.'])),
    removed: 'Safety en Transport-als-weging blijven weg. Schools, kust, afstand tot Banjul, logies, ' +
      'banken en gebedshuizen zijn op 02-09-2026 gewogen en afgewezen; de reden staat per kandidaat in het script. ' +
      '"Transport points" was er kort wel en is op verzoek weer weg — een keuze over het rooster, niet over de meting.',
  },
  sources: { prices: 'area-prices.json', amenities: amen.sources.osm, register: amen.sources.register,
             local: '_scores-data.json (kwalitatief, geen meting)' },
  areas: rijen,
};

console.log(`prijsbereik ${geld(pMin)} – ${geld(pMax)} per m²; maxima: ` +
  TELMATEN.map(m => `${m.label} ${maxima[m.label]}`).join(', '));
console.log('ijkpunt (mediaan): ' +
  Object.entries(benchmark).map(([k, v]) => `${k} ${v} (n=${benchN[k]})`).join(', ') + '\n');
for (const g of Object.values(rijen)) {
  console.log(`  ${g.name.padEnd(18)} ${g.measures.length} ringen: ` +
    g.measures.map(m => `${m.label} ${m.score}`).join(', '));
}
const verdeling = {};
for (const g of Object.values(rijen)) verdeling[g.measures.length] = (verdeling[g.measures.length] || 0) + 1;
console.log('\nringen per gebied: ' + Object.keys(verdeling).sort((a, b) => b - a).map(k => `${k}× bij ${verdeling[k]} gebieden`).join(', '));
if (WRITE) { await writeFile('area-scores.json', JSON.stringify(uit, null, 1)); console.log('geschreven: area-scores.json'); }
else console.log('Draai opnieuw met --write om area-scores.json te schrijven.');
