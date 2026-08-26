/* Vervangt de VALUATION-sectie en de twee oude rekenfuncties in sell.html
   door de nieuwe flow. Werkt op exacte ankers, niet op regelnummers, en
   laat een backup achter. Draaien vanuit de projectmap. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const F = 'sell.html';
let s = readFileSync(F, 'utf8');
if (!existsSync('_sell.html.voor-waardemodel')) writeFileSync('_sell.html.voor-waardemodel', s);

const blokA = readFileSync('_blokA.html', 'utf8');
const blokB = readFileSync('_blokB.js', 'utf8');
const stap = [];

/* 1 - de markup van de sectie */
const aStart = s.indexOf('<!-- VALUATION -->');
const aEnd = s.indexOf('<!-- PRICING -->');
if (aStart < 0 || aEnd < 0 || aEnd < aStart) throw new Error('VALUATION/PRICING-anker niet gevonden');
s = s.slice(0, aStart) + blokA.trim() + '\n\n' + s.slice(aEnd);
stap.push('markup vervangen');

/* 2 - de twee oude rekenfuncties en de paneelwissel */
const bStart = s.indexOf('  // ---------------- TOOL 1: home, villa or apartment ----------------');
const bEndAnchor = "  showPanel(savedTab==='land'?'land':'property');";
const bEnd = s.indexOf(bEndAnchor);
if (bStart < 0 || bEnd < 0 || bEnd < bStart) throw new Error('anker voor de rekenfuncties niet gevonden');
s = s.slice(0, bStart) + blokB.trimEnd() + '\n' + s.slice(bEnd + bEndAnchor.length + 1);
stap.push('rekenfuncties vervangen');

/* 3 - het intekenen schrijft lfSize en lfBeach programmatisch; zonder een
       event merkt de flow dat niet. Twee regels, meer is het niet. */
const a3 = "LD.sqm=sqm; size.value=sqm; size.readOnly=true; size.classList.remove('bad');";
if (!s.includes(a3)) throw new Error('ldSyncSize-anker niet gevonden');
s = s.replace(a3, a3 + "\n    size.dispatchEvent(new Event('change',{bubbles:true}));");
stap.push('ldSyncSize meldt de gemeten oppervlakte');

const a4 = "  function ldApplyGeo(){";
if (!s.includes(a4)) throw new Error('ldApplyGeo-anker niet gevonden');
s = s.replace(a4, a4 + "\n    /* De flow rekent mee op 'change'; programmatisch zetten vuurt dat niet zelf. */\n    setTimeout(function(){ var b=document.getElementById('lfBeach'); if(b) b.dispatchEvent(new Event('change',{bubbles:true})); },0);");
stap.push('ldApplyGeo meldt de gemeten zeeafstand');

/* 4 - de twee nieuwe scripts inladen, voor app.min.js.
       De ?v=-stempel wordt door build.mjs herschreven; wat hier staat
       is alleen de eerste waarde. */
const a5 = '<script src="app.min.js?v=';
if (s.includes('valuation-areas.js')) { stap.push('scripttags stonden er al'); }
else {
  const i = s.indexOf(a5);
  if (i < 0) throw new Error('app.min.js-scripttag niet gevonden');
  const stamp = s.slice(i).match(/app\.min\.js\?v=([^"]+)"/)[1];
  s = s.slice(0, i) + '<script src="valuation-areas.js?v=' + stamp + '"></script>\n'
    + '<script src="valuation.js?v=' + stamp + '"></script>\n' + s.slice(i);
  stap.push('valuation-areas.js en valuation.js ingeladen');
}

/* 5 - de build moet ze kennen: SITE_ASSETS zorgt dat ze in deploy/ komen,
       VERSIONED dat de stempel meebeweegt als een tarief wijzigt. */
let bld = readFileSync('build.mjs', 'utf8');
if (bld.includes("'valuation.js'")) { stap.push('build.mjs kende ze al'); }
else {
  const a6 = "'market-index.js', 'market-sources.js',";
  const n6 = (bld.match(new RegExp(a6.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  if (n6 !== 2) throw new Error('verwachtte 2 treffers voor SITE_ASSETS/VERSIONED, vond ' + n6);
  bld = bld.split(a6).join(a6 + "\n  'valuation.js', 'valuation-areas.js',");
  writeFileSync('build.mjs', bld);
  stap.push('build.mjs: toegevoegd aan SITE_ASSETS en VERSIONED');
}

writeFileSync(F, s);
console.log(stap.map(x => '  - ' + x).join('\n'));
console.log('\nsell.html:', s.length, 'bytes  (backup: _sell.html.voor-waardemodel)');
console.log('resten van de oude tool:', ['propForm','landForm','pdRange','ldRange','valueToggle','initPropertyValuation']
  .filter(k => s.includes(k)).join(', ') || 'geen');
