/* Draait de twaalf gevallen van valuation-selftest.html door het oude
   (euro) en het nieuwe (dalasi) model, en vergelijkt afwijking en
   bandoordeel. Beide horen identiek te zijn: de afwijking is een
   verhouding en dus eenheidsvrij. */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

/* De oude versie komt uit git, niet uit een kopie op schijf: zo blijft dit
   script draaien zonder dat er losse kopieën van getrackte bestanden
   rondslingeren. 2619fb0 is de laatste commit vóór de omzetting. */
const VOOR = '2619fb0';
const uitGit = p => execFileSync('git', ['show', `${VOOR}:${p}`], { encoding: 'utf8' });

function laad(model, areas) {
  const g = {};
  new Function('window', 'root', areas)(g, g);
  new Function('window', 'root', model)(g, g);
  return g;
}
const oud   = laad(uitGit('valuation.js'), uitGit('valuation-areas.js'));
const nieuw = laad(readFileSync('valuation.js', 'utf8'),
                   readFileSync('valuation-areas.js', 'utf8'));
const E = 85.74;

const L = {title:'alkalalo',road:'laterite',elec:'present',water:'nearby',fence:'partial',
           cleared:'cleared',shape:'regular',corner:'no',flood:'no',beach:'inland',view:'none'};
const c = o => Object.assign({}, L, o);

const CASES = [
 ['Kololi',      2500000, c({type:'land',area:'Kololi',plotSqm:480,road:'tarmac',water:'nawec'})],
 ['Bijilo',      2500000, c({type:'land',area:'Bijilo',plotSqm:460,water:'nawec'})],
 ['Brusubi',     1800000, c({type:'land',area:'Brusubi',plotSqm:375,title:'leasehold',road:'tarmac',water:'nawec'})],
 ['Kerr Serign', 2000000, c({type:'land',area:'Kerr Serign',plotSqm:500})],
 ['Jabang',       800000, c({type:'land',area:'Jabang',plotSqm:400,elec:'nearby',fence:'none',cleared:'partial'})],
 ['Lamin',        500000, c({type:'land',area:'Lamin',plotSqm:500,elec:'nearby',fence:'none',cleared:'partial'})],
 ['Old Yundum',   550000, c({type:'land',area:'Old Yundum',plotSqm:450,elec:'nearby',fence:'none',cleared:'partial'})],
 ['Gunjur',       250000, c({type:'land',area:'Gunjur',plotSqm:400,elec:'none',water:'none',fence:'none',cleared:'bush'})],
 ['Kartong',      175000, c({type:'land',area:'Kartong',plotSqm:400,elec:'none',water:'none',fence:'none',cleared:'bush'})],
 ['Sanyang',      440000, c({type:'land',area:'Sanyang',plotSqm:468,elec:'nearby',water:'none',fence:'none',cleared:'partial'})],
 ['Brikama',      450000, c({type:'land',area:'Brikama',plotSqm:400,elec:'nearby',fence:'none',cleared:'partial'})],
 ['Busumbala',    500000, c({type:'land',area:'Busumbala',plotSqm:450,elec:'nearby',fence:'none',cleared:'partial'})]
];

let verschil = 0;
for (const [n, obsGmd, i] of CASES) {
  const ro = oud.MK_VAL.value(i,   { LAND_BASE: oud.MK_RATES.LAND });
  const rn = nieuw.MK_VAL.value(i, { LAND_BASE: nieuw.MK_RATES.LAND });
  const obsEur = obsGmd / E;
  const devO = ro.mid / obsEur - 1, bandO = obsEur >= ro.low && obsEur <= ro.high;
  const devN = rn.mid / obsGmd - 1, bandN = obsGmd >= rn.low && obsGmd <= rn.high;
  if (Math.abs(devO - devN) > 0.005 || bandO !== bandN) {
    verschil++;
    console.log(`${n}: afwijking ${(devO*100).toFixed(1)}% -> ${(devN*100).toFixed(1)}%, ` +
                `band ${bandO} -> ${bandN}`);
  }
}
console.log(verschil === 0
  ? '12 gevallen: afwijking en bandoordeel identiek aan voor de omzetting.'
  : `${verschil} geval(len) verschillen.`);
