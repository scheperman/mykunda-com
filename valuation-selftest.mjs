/* MyKunda — zelftest van het waarderingsmodel
 *   node valuation-selftest.mjs
 * Draait vanuit de projectmap; laadt valuation.js ernaast.
 *
 * Blok A zijn echte, GEDATEERDE kavelaanbiedingen van 25-08-2026. Ze zitten
 * niet als losse waarneming in de tarieventabel maar in de mediaan ervan, dus
 * het model mag er per geval naast zitten. Waar het om gaat: staat de mediane
 * afwijking rond nul (geen systematische scheefheid), en vangt de band die het
 * model zelf afgeeft ongeveer vier op de vijf gevallen? Gemeten op 45
 * aanbiedingen valt 78% van het aanbod binnen ±35% van de gebiedsmediaan; meer
 * dan dat kan een model op gebiedsniveau niet beloven.
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), 'valuation.js'));
const V = globalThis.MK_VAL;
/* 27-08-2026: het model rekent intern in dalasi. De waarnemingen in blok A
   waren hier al dalasi en werden alleen ter wille van het model door deze
   koers gedeeld — die deling is eruit. EURGMD staat er nog voor de gevallen
   die werkelijk in euro's zijn waargenomen: de portaalprijzen in blok B, de
   villa-vraagprijzen, en de terugvaltabel hieronder. */
const EURGMD = 85.74;
const BASE_EUR = {'kololi':140,'senegambia':130,'bijilo':80,'brufut heights':80,'brufut':48,'brusubi':38,
'kerr serign':65,'sukuta':30,'lamin':15,'tujereng':13,'gunjur':14,'kartong':14,'sanyang':18,'brikama':13,
'busumbala':13,'jabang':17,'yundum':15,'old yundum':15,'tanji':25,'fajara':120,'bakau':90,'kotu':110,
'banjul':90,'serrekunda':50,'basse':4,'farafenni':4,'batokunku':18,'salagi':40,'kachumeh':25,'mandinari':12};
/* De terugvaltabel die het model verwacht, in dalasi. Deze lijst is een
   handmatige subset van valuation-areas.js en blijft daarom hier staan;
   alleen de eenheid wordt hier omgezet. */
const BASE = Object.fromEntries(
  Object.entries(BASE_EUR).map(([k, v]) => [k, Math.round(v * EURGMD)]));

/* Geankerde gevallen: elk is een echte listing met een echte prijs.
   'obs' is de waargenomen vraagprijs in DALASI — de eenheid waarin het
   model rekent. Vraagprijzen liggen boven verkoopprijzen, dus het model
   hoort er eerder onder dan boven te zitten. */
const CASES = [
 /* --- A · lokale kavels: echte, GEDATEERDE Facebook-advertenties van
        25-08-2026. Prijs en maat komen uit de advertentie zelf; de
        kenmerken alleen waar de tekst ze noemt, want een advertentie
        die zwijgt over titel of stroom hoort in het model ook te
        zwijgen. Deze twintig zitten NIET in de tarieventabel als
        losse waarneming maar in de mediaan ervan, dus het model mag
        er per geval best naast zitten - de vraag is of de spreiding
        binnen de band valt die het zelf afgeeft. --- */
 {n:'Kololi 23x23 m (D3,5 mln)'                   , obs:3_500_000, i:{type:'land',area:'Kololi',plotSqm:529}},
 {n:'Brusubi 20x30 m (D3,5 mln)'                  , obs:3_500_000, i:{type:'land',area:'Brusubi',plotSqm:600}},
 {n:'Sukuta Nema 20x25, omheind (D850k)'          , obs:850_000, i:{type:'land',area:'Sukuta',plotSqm:500, fence:'full'}},
 {n:'Jabang/Tawto, omheind, leasehold (D1,5 mln)' , obs:1_500_000, i:{type:'land',area:'Jabang',plotSqm:400, fence:'full', title:'leasehold'}},
 {n:'Lamin Keriwan (D800k)'                       , obs:800_000, i:{type:'land',area:'Lamin',plotSqm:400}},
 {n:'New Yundum 40x25, dubbele kavel (D2 mln)'    , obs:2_000_000, i:{type:'land',area:'Old Yundum',plotSqm:1000}},
 {n:'Busumbala 24x15 m (D1,3 mln)'                , obs:1_300_000, i:{type:'land',area:'Busumbala',plotSqm:360}},
 {n:'Brikama Penyem, water en stroom (D375k)'     , obs:375_000, i:{type:'land',area:'Brikama',plotSqm:400, elec:'present', water:'nawec'}},
 {n:'Sanyang 17x24 m (D450k)'                     , obs:450_000, i:{type:'land',area:'Sanyang',plotSqm:408}},
 {n:'Sanyang 20x20, zeezicht (D450k)'             , obs:450_000, i:{type:'land',area:'Sanyang',plotSqm:400, view:'ocean', beach:'walking'}},
 {n:'Tanji 20x25, omheind (D600k)'                , obs:600_000, i:{type:'land',area:'Tanji',plotSqm:500, fence:'full'}},
 {n:'Tujereng aan de highway 20x40 (D4 mln)'      , obs:4_000_000, i:{type:'land',area:'Tujereng',plotSqm:800, road:'tarmac'}},
 {n:'Brufut 17x49, freehold (D2,2 mln)'           , obs:2_200_000, i:{type:'land',area:'Brufut',plotSqm:833, title:'freehold'}},
 {n:'Farato Bojang, omheind (D800k)'              , obs:800_000, i:{type:'land',area:'Farato',plotSqm:450, fence:'full'}},
 {n:'Jambur 25x25, volledig omheind (D1 mln)'     , obs:1_000_000, i:{type:'land',area:'Jambur',plotSqm:625, fence:'full'}},
 {n:'Kitty 20x20 (D350k)'                         , obs:350_000, i:{type:'land',area:'Kitty',plotSqm:400}},
 {n:'Sifoe 20x20 (D250k)'                         , obs:250_000, i:{type:'land',area:'Sifoe',plotSqm:400}},
 {n:'Salagi Wullinkama 12x53 (D2,5 mln)'          , obs:2_500_000, i:{type:'land',area:'Salagi',plotSqm:636}},
 {n:'Mamuda 20x20 (D475k)'                        , obs:475_000, i:{type:'land',area:'Mamuda',plotSqm:400}},
 {n:'Gunjur 200x200, groot perceel (D11 mln)'     , obs:11_000_000, i:{type:'land',area:'Gunjur',plotSqm:40000}},

 // --- bebouwd, vraagprijs met bekende bebouwde m² ---
 {n:'Fajara villa 660 m² (€620k)',   obs:620_000*EURGMD, i:{type:'villa',area:'Fajara',builtSqm:660,plotSqm:1200,finish:'high',condition:'new',yearBuilt:2024,floors:'2',baths:'4',beds:'4',pool:'yes',solar:'both',security:'gated',water:'both',furnished:'semi',fence:'full',title:'leasehold',road:'tarmac',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'garden',shape:'regular',corner:'no'}},
 {n:'Bijilo 6 kmr 240 m² (€250k)',   obs:250_000*EURGMD, i:{type:'house',area:'Bijilo',builtSqm:240,plotSqm:600,finish:'standard',condition:'good',yearBuilt:2016,floors:'2',baths:'3',beds:'6',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Brufut 3 kmr 229 m² (€99k)',    obs:99_000*EURGMD,  i:{type:'house',area:'Brufut',builtSqm:229,plotSqm:600,finish:'standard',condition:'good',yearBuilt:2014,floors:'1',baths:'2',beds:'3',pool:'yes',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Salagi 4 kmr 225 m² (€99,4k)',  obs:99_419*EURGMD,  i:{type:'house',area:'Salagi',builtSqm:225,plotSqm:500,finish:'standard',condition:'good',yearBuilt:2016,floors:'1',baths:'2',beds:'4',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Jabang 4 kmr 800 m² kavel',     obs:289_008*EURGMD, i:{type:'house',area:'Jabang',builtSqm:220,plotSqm:800,finish:'high',condition:'good',yearBuilt:2019,floors:'2',baths:'3',beds:'4',pool:'yes',solar:'no',security:'gated',water:'nawec',furnished:'unfurnished',fence:'full',title:'leasehold',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Mandinari 4 kmr 500 m² (€90k)', obs:90_000*EURGMD,  i:{type:'house',area:'Mandinari',builtSqm:180,plotSqm:500,finish:'standard',condition:'good',yearBuilt:2015,floors:'1',baths:'2',beds:'4',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
];

/* welke gevallen zijn portaalprijzen in euro's, en welke lokale listings in dalasi */
const PORTAL_IX = new Set([20,21,22,23,24,25,26,27,28]);
let inBand = 0, rows = [];
CASES.forEach((c,ix) => {
  const r = V.value(c.i, {LAND_BASE: BASE});
  const dev = r.mid / c.obs - 1;
  const ok = c.obs >= r.low && c.obs <= r.high;
  if (ok) inBand++;
  rows.push({n:c.n, obs:c.obs, mid:r.mid, low:r.low, high:r.high, dev, ok, cf:r.confidence.label, sc:r.confidence.score, portal:PORTAL_IX.has(ix), ratio:c.obs/r.mid});
});

const w = s => String(s).padEnd(34);
const local = rows.filter(r=>!r.portal), portal = rows.filter(r=>r.portal);

console.log('\n=== A · LOKALE KAVELLISTINGS IN DALASI — hier moet het model kloppen ===');
console.log('\n' + w('GEVAL') + 'waargenomen'.padStart(12) + 'model'.padStart(11) + 'afwijking'.padStart(11) + '  band'.padStart(20) + '  in band  vertrouwen');
console.log('-'.repeat(118));
local.forEach(r => {
  console.log(w(r.n)
    + ('D' + Math.round(r.obs).toLocaleString('nl-NL')).padStart(14)
    + ('D' + r.mid.toLocaleString('nl-NL')).padStart(13)
    + ((r.dev>0?'+':'') + (r.dev*100).toFixed(0) + '%').padStart(11)
    + ('D' + r.low.toLocaleString('nl-NL') + '–D' + r.high.toLocaleString('nl-NL')).padStart(26)
    + (r.ok ? '     ja  ' : '    NEE  ') + r.cf + ' ' + r.sc);
});
const md = a => { const d=a.map(r=>r.dev).sort((x,y)=>x-y); return d[Math.floor(d.length/2)]; };
const lIn = local.filter(r=>r.ok).length;
const lMae = local.reduce((s,r)=>s+Math.abs(r.dev),0)/local.length;
console.log('-'.repeat(118));
console.log(`In band: ${lIn}/${local.length}   mediane afwijking: ${(md(local)*100).toFixed(0)}%   gemiddelde absolute afwijking: ${(lMae*100).toFixed(0)}%`);

console.log('\n\n=== B · PORTAALPRIJZEN — in euro\'s waargenomen, hier in dalasi gezet ===');
console.log('    De vraag is niet of het model de portaalprijs raakt, maar of de');
console.log('    verhouding stabiel genoeg is om als tweede getal te tonen.');
console.log(`    Omgerekend tegen ${EURGMD} GMD/EUR; de verhouding zelf is eenheidsvrij.\n`);
console.log(w('GEVAL') + 'portaal'.padStart(14) + 'model'.padStart(13) + 'verhouding'.padStart(12) + '   binnen 1,4-2,3?');
console.log('-'.repeat(118));
portal.forEach(r => {
  const inR = r.ratio >= 1.4 && r.ratio <= 2.3;
  console.log(w(r.n) + ('D' + Math.round(r.obs).toLocaleString('nl-NL')).padStart(14)
    + ('D' + r.mid.toLocaleString('nl-NL')).padStart(13)
    + ('x' + r.ratio.toFixed(2)).padStart(12) + (inR ? '   ja' : '   nee'));
});
const ratios = portal.map(r=>r.ratio).sort((a,b)=>a-b);
const rmed = (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.ceil((ratios.length-1)/2)])/2;
console.log('-'.repeat(118));
console.log(`Mediane verhouding portaal/model: x${rmed.toFixed(2)}   bereik x${ratios[0].toFixed(2)} - x${ratios[ratios.length-1].toFixed(2)}`);
console.log(`Binnen de getoonde band 1,4-2,3: ${portal.filter(r=>r.ratio>=1.4&&r.ratio<=2.3).length}/${portal.length}\n`);

/* ---------------------------------------------------------------------------
   Blok C — HUUR. Toegevoegd 27-08-2026, nadat bleek dat het rendement in
   valuation.js zichzelf voedde: de huren waarop het geijkt was, waren zelf
   uit vraagprijzen afgeleid. Deze test kan dat niet meer laten gebeuren.

   De vraag: reproduceert het ENE landelijke rendement de huren die we per
   gebied werkelijk zien? Bron is area-prices.json — dezelfde bron als de
   area-pagina's, zodat de twee niet uit elkaar kunnen lopen.
--------------------------------------------------------------------------- */
const { readFileSync } = await import('node:fs');
const DB = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'area-prices.json'), 'utf8'));
const Y = globalThis.MK_VAL_CONFIG.RENT_YIELD.local.house;

const rent = Object.values(DB.areas).filter(a => a.house && a.rent_year);
console.log(`\n=== C · HUUR — reproduceert ${(Y*100).toFixed(1)}% de waargenomen huren? ===`);
console.log('    Model = vraagprijs woning x het rendement voor een gewone woning.');
console.log('    Waargenomen = de p25-p75 band uit de lokale huuradvertenties.\n');
console.log(w('GEBIED') + 'model/jaar'.padStart(12) + '  waargenomen band'.padStart(24) + '  in band  gemeten %');
console.log('-'.repeat(118));
let rIn = 0;
rent.sort((a,b)=>b.house-a.house).forEach(a => {
  const model = a.house * Y;
  const ok = model >= a.rent_lo && model <= a.rent_hi;
  if (ok) rIn++;
  console.log(w(a.label)
    + ('D' + Math.round(model).toLocaleString('nl-NL')).padStart(12)
    + ('D' + a.rent_lo.toLocaleString('nl-NL') + '–' + a.rent_hi.toLocaleString('nl-NL')).padStart(24)
    + (ok ? '     ja  ' : '    NEE  ') + (a.yield == null ? '  —  ' : a.yield.toFixed(1) + '%') + '  n=' + a.rent_n);
});
/* Een paar kan een lege yield dragen (27-08-2026: Bakoteh — drie huur-
   advertenties die niet bij de bandwoningprijs passen; 8,5% zou de 1–8%-
   vangrail raken en zegt eerder iets over het paar dan over de markt).
   Zo'n paar telt niet mee in de mediaan; de bandtoets hierboven draait er
   gewoon voor. Zoek bij de volgende herijking de bron van het paar. */
const ys = rent.map(a=>a.yield).filter(y=>y!=null).sort((a,b)=>a-b);
const yMed = ys[Math.floor(ys.length/2)];
const worst = Math.max(...rent.map(a => Math.max((a.house*Y)/a.rent_hi, a.rent_lo/(a.house*Y))));
console.log('-'.repeat(118));
console.log(`In band: ${rIn}/${rent.length}   gemeten rendement: mediaan ${yMed.toFixed(2)}%, ` +
            `spreiding ${ys[0].toFixed(1)}–${ys[ys.length-1].toFixed(1)}%   model: ${(Y*100).toFixed(1)}%`);

/* Wanneer is dit goed genoeg? Eén landelijk percentage kan een spreiding van
   1,5 tot 4,7% niet per gebied raken, en dat hoeft ook niet. Twee dingen
   moeten wel kloppen: het model mag niet systematisch scheef staan, en geen
   enkel gebied mag er een factor twee naast zitten. Zakt een van beide door
   de grens, dan is er iets veranderd in de markt of in de meting. */
const skew = Math.abs(Y*100 - yMed);
console.log(`Scheefheid model t.o.v. mediaan: ${skew.toFixed(2)} procentpunt (grens 0,40) — ${skew <= 0.4 ? 'ok' : 'TE SCHEEF'}`);
console.log(`Slechtste gebied zit ${worst.toFixed(2)}x buiten zijn band (grens 2,00) — ${worst <= 2 ? 'ok' : 'TE VER'}`);
if (ys[0] < 1 || ys[ys.length-1] > 8)
  console.log('LET OP: een gemeten rendement buiten 1–8% betekent dat huur en vraagprijs uit twee markten komen.');
console.log('');
