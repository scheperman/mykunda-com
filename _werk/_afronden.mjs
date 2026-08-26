/* Laatste drie stappen: knopstijl, de zelftestpagina, en de prijsstap van
   list.html op dezelfde module. Draaien vanuit de projectmap. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const uit = [];

/* 1 - btn-light is wit op transparant, gemaakt voor donkere vlakken. Op onze
       witte kaart is hij onzichtbaar. Eigen secundaire knop dus. */
let s = readFileSync('sell.html', 'utf8');
if (s.includes('class="btn btn-light" type="button" id="mkvRestart"')) {
  s = s.split('class="btn btn-light" type="button" id="mkvRestart"').join('class="btn mkv-sec" type="button" id="mkvRestart"');
  s = s.split('class="btn btn-light" type="button" id="mkvSkip"').join('class="btn mkv-sec" type="button" id="mkvSkip"');
  s = s.replace('.mkv-err{color:var(--v-red);font-size:14px;margin-top:10px;min-height:1px}',
    '.mkv-err{color:var(--v-red);font-size:14px;margin-top:10px;min-height:1px}\n'
    + '#value .btn.mkv-sec{background:var(--v-paper);border:1.5px solid var(--v-line2);color:var(--v-ink)}\n'
    + '#value .btn.mkv-sec:hover{border-color:var(--v-green2);color:var(--v-green2)}');
  writeFileSync('sell.html', s);
  uit.push('sell.html: eigen secundaire knop in plaats van btn-light');
}

/* 2 - list.html: dezelfde module, als prijsindicatie bij de prijsstap.
       Zo kunnen de listingflow en de waardebepaling niet uiteenlopen. */
let l = readFileSync('list.html', 'utf8');
const voorL = l;
if (!l.includes('valuation-areas.js')) {
  const i = l.indexOf('<script src="app.min.js?v=');
  if (i < 0) throw new Error('app.min.js-tag in list.html niet gevonden');
  const stamp = l.slice(i).match(/app\.min\.js\?v=([^"]+)"/)[1];
  l = l.slice(0, i) + '<script src="valuation-areas.js?v=' + stamp + '"></script>\n'
    + '<script src="valuation.js?v=' + stamp + '"></script>\n' + l.slice(i);
  uit.push('list.html: module ingeladen');
}
/* Het vlak waar de indicatie in komt, onder de prijshint. */
const mark = '        <div class="hint" id="priceHint"></div>';
if (!l.includes('id="priceGuide"')) {
  if (!l.includes(mark)) throw new Error('priceHint-markup in list.html niet gevonden');
  l = l.replace(mark, mark + '\n        <div class="hint" id="priceGuide" style="display:none;margin-top:8px;padding:10px 12px;background:var(--green-50, #EDF3F0);border-radius:8px;line-height:1.5"></div>');
  uit.push('list.html: vlak voor de prijsindicatie toegevoegd');
}

const anker = "document.getElementById('priceHint').textContent = rent";
if (!l.includes('mkPriceGuide')) {
  if (!l.includes(anker)) throw new Error('priceHint-anker in list.html niet gevonden');
  l = l.replace('function updatePriceLabels(){', `/* Wat vraagt de markt hier ongeveer? Zelfde module als de
   waardebepaling op sell.html, zodat de twee niet uiteen kunnen lopen.
   Het is een indicatie naast het veld, niet een ingevulde prijs: de
   verkoper bepaalt zijn vraagprijs zelf. */
function mkPriceGuide(){
  const box = document.getElementById('priceGuide');
  if(!box) return;
  if(isRent() || !window.MK_VAL || !window.MK_RATES){ box.style.display='none'; return; }
  const r = window.MK_VAL.value({
    type: S.cat==='villa'||S.cat==='compound'||S.cat==='townhouse'||S.cat==='lodge' ? 'villa' : S.cat,
    area: (S.area||'').split(' \\u00b7 ')[0], plotSqm: S.cat==='land' ? S.landSqm : S.plot,
    builtSqm: S.cat==='land' ? '' : S.sqm, title: S.titleType, road: S.road, elec: S.elec,
    water: S.cat==='land' ? S.landWater : S.water, fence: S.fence, flood: S.flood,
    beach: S.cat==='land' ? S.landBeach : S.beach, view: S.view, condition: S.condition,
    yearBuilt: S.yearBuilt, floors: S.floors, baths: S.baths, security: S.security,
    furnished: S.furnished, finish: 'standard'
  }, { LAND_BASE: (window.MK_RATES||{}).LAND || {} });
  if(!r || r.ok===false){ box.style.display='none'; return; }
  const gmd = v => 'D' + Math.round(v * CURRENCIES.GMD.rate / CURRENCIES.EUR.rate).toLocaleString('en-US');
  box.style.display='block';
  box.innerHTML = 'Comparable properties in this area work out around <b>' + gmd(r.mid)
    + '</b> (' + gmd(r.low) + ' \\u2013 ' + gmd(r.high) + '). '
    + '<span style="opacity:.75">' + { strong:'Strongly evidenced', fair:'Fairly evidenced', indicative:'Indicative only' }[r.confidence.label]
    + ' \\u2014 an estimate from asking prices, not a valuation. Your price is yours to set.</span>';
}

function updatePriceLabels(){`);
  l = l.replace(anker, "mkPriceGuide();\n  " + anker);
  uit.push('list.html: prijsindicatie op de module aangesloten');
}
if (l !== voorL) writeFileSync('list.html', l);

/* 3 - de zelftest als pagina, zodat hij in de browser draait en niet alleen
       in de terminal. Staat op noindex; hij is voor ons, niet voor Google. */
let bld = readFileSync('build.mjs', 'utf8');
if (!bld.includes("'valuation-selftest.html'")) {
  const a = "const NOINDEX_PAGES = new Set(['admin.html',";
  if (!bld.includes(a)) throw new Error('NOINDEX_PAGES-anker niet gevonden');
  bld = bld.replace(a, "const NOINDEX_PAGES = new Set(['valuation-selftest.html', 'admin.html',");
  writeFileSync('build.mjs', bld);
  uit.push('build.mjs: zelftestpagina op noindex');
}

console.log(uit.map(x => '  - ' + x).join('\n') || '  (niets te doen)');
