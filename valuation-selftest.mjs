require('/root/mykunda/valuation.js');
const V = globalThis.MK_VAL;
const EURGMD = 85.74;
const BASE = {'kololi':140,'senegambia':130,'bijilo':80,'brufut heights':80,'brufut':48,'brusubi':38,
'kerr serign':65,'sukuta':30,'lamin':15,'tujereng':13,'gunjur':14,'kartong':14,'sanyang':18,'brikama':13,
'busumbala':13,'jabang':17,'yundum':15,'old yundum':15,'tanji':25,'fajara':120,'bakau':90,'kotu':110,
'banjul':90,'serrekunda':50,'basse':4,'farafenni':4,'batokunku':18,'salagi':40,'kachumeh':25,'mandinari':12};

/* Geankerde gevallen: elk is een echte listing met een echte prijs.
   'obs' is de waargenomen vraagprijs in EUR. Vraagprijzen liggen boven
   verkoopprijzen, dus het model hoort er eerder onder dan boven te zitten. */
const CASES = [
 // --- kavels, lokale listings in dalasi ---
 {n:'Kololi 480 m² (D2,5 mln)',      obs:2_500_000/EURGMD, i:{type:'land',area:'Kololi',plotSqm:480,title:'alkalalo',road:'tarmac',elec:'present',water:'nawec',fence:'partial',cleared:'cleared',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Bijilo 460 m² (D2,5 mln)',      obs:2_500_000/EURGMD, i:{type:'land',area:'Bijilo',plotSqm:460,title:'alkalalo',road:'laterite',elec:'present',water:'nawec',fence:'partial',cleared:'cleared',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Brusubi Ph1 375 m² (D1,8 mln)', obs:1_800_000/EURGMD, i:{type:'land',area:'Brusubi',plotSqm:375,title:'leasehold',road:'tarmac',elec:'present',water:'nawec',fence:'partial',cleared:'cleared',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Kerr Serign 500 m² (D2,0 mln)', obs:2_000_000/EURGMD, i:{type:'land',area:'Kerr Serign',plotSqm:500,title:'alkalalo',road:'laterite',elec:'present',water:'nearby',fence:'partial',cleared:'cleared',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Jabang 400 m² (D800k)',         obs:800_000/EURGMD,   i:{type:'land',area:'Jabang',plotSqm:400,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Lamin 500 m² (D500k)',          obs:500_000/EURGMD,   i:{type:'land',area:'Lamin',plotSqm:500,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Yundum 450 m² (D550k)',         obs:550_000/EURGMD,   i:{type:'land',area:'Old Yundum',plotSqm:450,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Gunjur 400 m² (D250k)',         obs:250_000/EURGMD,   i:{type:'land',area:'Gunjur',plotSqm:400,title:'alkalalo',road:'laterite',elec:'none',water:'none',fence:'none',cleared:'bush',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Kartong 400 m² (D175k)',        obs:175_000/EURGMD,   i:{type:'land',area:'Kartong',plotSqm:400,title:'alkalalo',road:'laterite',elec:'none',water:'none',fence:'none',cleared:'bush',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Sanyang 468 m² (D440k)',        obs:440_000/EURGMD,   i:{type:'land',area:'Sanyang',plotSqm:468,title:'alkalalo',road:'laterite',elec:'nearby',water:'none',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Brikama 400 m² (D450k)',        obs:450_000/EURGMD,   i:{type:'land',area:'Brikama',plotSqm:400,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Busumbala 450 m² (D500k)',      obs:500_000/EURGMD,   i:{type:'land',area:'Busumbala',plotSqm:450,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},
 {n:'Sanyang 660 m² omheind (€25k)', obs:25_000,           i:{type:'land',area:'Sanyang',plotSqm:660,title:'leasehold',road:'laterite',elec:'nearby',water:'nearby',fence:'full',cleared:'cleared',flood:'no',beach:'walking',shape:'regular',corner:'no'}},
 {n:'Tujereng 1.100 m² bij strand',  obs:20_809,           i:{type:'land',area:'Tujereng',plotSqm:1100,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'walking',shape:'regular',corner:'no'}},
 {n:'Tanji 480 m² (€10.982)',        obs:10_982,           i:{type:'land',area:'Tanji',plotSqm:480,title:'alkalalo',road:'laterite',elec:'nearby',water:'nearby',fence:'none',cleared:'partial',flood:'no',beach:'inland',shape:'regular',corner:'no'}},

 // --- bebouwd, vraagprijs met bekende bebouwde m² ---
 {n:'Fajara villa 660 m² (€620k)',   obs:620_000, i:{type:'villa',area:'Fajara',builtSqm:660,plotSqm:1200,finish:'high',condition:'new',yearBuilt:2024,floors:'2',baths:'4',beds:'4',pool:'yes',solar:'both',security:'gated',water:'both',furnished:'semi',fence:'full',title:'leasehold',road:'tarmac',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'garden',shape:'regular',corner:'no'}},
 {n:'Bijilo 6 kmr 240 m² (€250k)',   obs:250_000, i:{type:'house',area:'Bijilo',builtSqm:240,plotSqm:600,finish:'standard',condition:'good',yearBuilt:2016,floors:'2',baths:'3',beds:'6',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Brufut 3 kmr 229 m² (€99k)',    obs:99_000,  i:{type:'house',area:'Brufut',builtSqm:229,plotSqm:600,finish:'standard',condition:'good',yearBuilt:2014,floors:'1',baths:'2',beds:'3',pool:'yes',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Salagi 4 kmr 225 m² (€99,4k)',  obs:99_419,  i:{type:'house',area:'Salagi',builtSqm:225,plotSqm:500,finish:'standard',condition:'good',yearBuilt:2016,floors:'1',baths:'2',beds:'4',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Jabang 4 kmr 800 m² kavel',     obs:289_008, i:{type:'house',area:'Jabang',builtSqm:220,plotSqm:800,finish:'high',condition:'good',yearBuilt:2019,floors:'2',baths:'3',beds:'4',pool:'yes',solar:'no',security:'gated',water:'nawec',furnished:'unfurnished',fence:'full',title:'leasehold',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
 {n:'Mandinari 4 kmr 500 m² (€90k)', obs:90_000,  i:{type:'house',area:'Mandinari',builtSqm:180,plotSqm:500,finish:'standard',condition:'good',yearBuilt:2015,floors:'1',baths:'2',beds:'4',pool:'no',solar:'no',security:'wall',water:'nawec',furnished:'unfurnished',fence:'full',title:'alkalalo',road:'laterite',elec:'present',cleared:'cleared',flood:'no',beach:'inland',view:'none',shape:'regular',corner:'no'}},
];

CASES.forEach((c,ix) => { c.portal = ix >= 12 && ix !== 14 ? (ix<15) : false; });
/* welke gevallen zijn portaalprijzen in euro's, en welke lokale listings in dalasi */
const PORTAL_IX = new Set([12,13,14,15,16,17,18,19,20]);
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
    + ('€' + Math.round(r.obs).toLocaleString('nl-NL')).padStart(12)
    + ('€' + r.mid.toLocaleString('nl-NL')).padStart(11)
    + ((r.dev>0?'+':'') + (r.dev*100).toFixed(0) + '%').padStart(11)
    + ('€' + r.low.toLocaleString('nl-NL') + '–' + r.high.toLocaleString('nl-NL')).padStart(22)
    + (r.ok ? '     ja  ' : '    NEE  ') + r.cf + ' ' + r.sc);
});
const md = a => { const d=a.map(r=>r.dev).sort((x,y)=>x-y); return d[Math.floor(d.length/2)]; };
const lIn = local.filter(r=>r.ok).length;
const lMae = local.reduce((s,r)=>s+Math.abs(r.dev),0)/local.length;
console.log('-'.repeat(118));
console.log(`In band: ${lIn}/${local.length}   mediane afwijking: ${(md(local)*100).toFixed(0)}%   gemiddelde absolute afwijking: ${(lMae*100).toFixed(0)}%`);

console.log('\n\n=== B · PORTAALPRIJZEN IN EURO\'S — hier hoort het model ONDER te liggen ===');
console.log('    De vraag is niet of het model de portaalprijs raakt, maar of de');
console.log('    verhouding stabiel genoeg is om als tweede getal te tonen.\n');
console.log(w('GEVAL') + 'portaal'.padStart(12) + 'model'.padStart(11) + 'verhouding'.padStart(12) + '   binnen 1,4-2,3?');
console.log('-'.repeat(118));
portal.forEach(r => {
  const inR = r.ratio >= 1.4 && r.ratio <= 2.3;
  console.log(w(r.n) + ('EUR' + Math.round(r.obs).toLocaleString('nl-NL')).padStart(12)
    + ('EUR' + r.mid.toLocaleString('nl-NL')).padStart(11)
    + ('x' + r.ratio.toFixed(2)).padStart(12) + (inR ? '   ja' : '   nee'));
});
const ratios = portal.map(r=>r.ratio).sort((a,b)=>a-b);
const rmed = (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.ceil((ratios.length-1)/2)])/2;
console.log('-'.repeat(118));
console.log(`Mediane verhouding portaal/model: x${rmed.toFixed(2)}   bereik x${ratios[0].toFixed(2)} - x${ratios[ratios.length-1].toFixed(2)}`);
console.log(`Binnen de getoonde band 1,4-2,3: ${portal.filter(r=>r.ratio>=1.4&&r.ratio<=2.3).length}/${portal.length}\n`);
