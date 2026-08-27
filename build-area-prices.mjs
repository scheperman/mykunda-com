/* MyKunda — area-pagina's vullen uit area-prices.json
 * ---------------------------------------------------------------
 *   node build-area-prices.mjs            controleren, niets schrijven
 *   node build-area-prices.mjs --write    schrijven
 *
 * Eén bron. Elk bedrag op een area-pagina en in de tabel op
 * gambia-property-prices.html komt hieruit. Zet nooit een bedrag met de
 * hand in een pagina: de volgende run overschrijft het, of erger, hij
 * overschrijft het niet en dan lopen de vijf plekken waar hetzelfde
 * getal staat weer uit elkaar. Dat is precies hoe Kerewan op $4 kwam.
 *
 * Draai dit VOOR build.mjs. Node 18+, geen dependencies.
 */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');
const DB = JSON.parse(await readFile('area-prices.json', 'utf8'));
const A = DB.areas;
const FX = DB.fx;                       // dalasi per USD / per EUR

/* De pagina's rekenen in DALASI: fmtAreaPrice() in app.js deelt door de
   koers van de gekozen munt. Alles wat we in een id zetten is dus het
   waargenomen dalasibedrag, ongewijzigd.

   Tot 27-08-2026 werd hier door FX.eur gedeeld en op de pagina weer met de
   live koers vermenigvuldigd. Daardoor bewoog elke gebiedsprijs mee met de
   dalasi terwijl er niets was gemeten: zakte de munt 5%, dan stond Kololi
   de volgende ochtend 5% hoger. DB.fx blijft in het bestand staan als
   vastlegging van de koers waarop is gemeten, maar rekent nergens meer mee. */
const D   = n => 'D' + Math.round(n).toLocaleString('en-US');
const Dk  = n => n >= 1e6 ? 'D' + (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M'
               : 'D' + Math.round(n / 1000) + 'k';

const SRC = { observed: 'local listings', thin: 'few observations',
              derived: 'derived', none: 'no data' };

/* Hoeveel waarnemingen, in gewone woorden. Het aantal is niet decoratief:
   het is het verschil tussen een gemeten en een afgeleid getal. */
function note(r) {
  if (r.src === 'observed') return r.n + ' local plot listings';
  if (r.src === 'thin')     return r.n + ' observation' + (r.n === 1 ? '' : 's') + ' only';
  return 'no local observations — regional rate';
}

/* Hetzelfde, maar dan voor de huur. Die had tot 27-08-2026 helemaal geen
   bewijsklasse: het cijfer was 2,0% van de vraagprijs van de woning en het
   bijschrift zei "at a 2% gross yield" alsof dat een meting was. Een huur wordt
   nu nooit meer uit een prijs afgeleid — staat er geen bewijs onder, dan staat
   er geen bedrag. */
function rentNote(r) {
  if (r.rent_src === 'observed') return r.rent_n + ' local rental listings';
  if (r.rent_src === 'thin')     return r.rent_n + ' rental listing' + (r.rent_n === 1 ? '' : 's') + ' only';
  return 'no rental listings we can verify';
}

/* Huurders in Gambia denken per maand, makelaars adverteren per jaar. Het bedrag
   zelf is de maandhuur — dat is wat een lezer herkent — en de jaarband staat er
   direct naast. Alleen het kale bedrag mag in het id staan: fmtAreaPrice()
   overschrijft de hele textContent zodra iemand op de muntknop drukt, dus een
   woord als "a month" ernaast zou bij de eerste klik verdwijnen. */
const rentValue = r => D(Math.round(r.rent_month));
const rentSub   = r => `a month · ${D(r.rent_lo)}–${D(r.rent_hi)} a year · ${rentNote(r)}`;

/* Het rendement is een uitkomst van twee gemeten getallen, geen aanname vooraf.
   Tot 27-08-2026 stond hier op elke pagina "roughly 2%" — wat klopte, omdat de
   huur eronder 2% van de vraagprijs erboven was. Nu rekenen we het per gebied
   uit, en zeggen we het alleen waar beide getallen bestaan. */
function yieldLine(r) {
  if (!r.house) return '';                       // upcountry: geen woningprijs, dus ook geen rendement
  if (!r.yield) return ' We have no rent listing we can verify here, so we quote no rental yield for this area either — a yield built on a rent we had to guess would only look like knowledge.';
  const lo = (r.rent_lo / r.house * 100).toFixed(1);
  const hi = (r.rent_hi / r.house * 100).toFixed(1);
  return ` Against the asking price above, the advertised rents work out at a gross yield of ` +
         `<strong>${lo}% to ${hi}%</strong> — before agent's fees, repairs and the months a place stands empty, ` +
         `and below the 9.45% a one-year Gambian treasury bill paid in August 2026. Buyers here are mostly buying land, not income.`;
}

/* ---------- de drie prijstegels ---------- */
const QSTAT = /<div class="qstat"><div class="k">[^<]*<\/div><div class="v"[^>]*>[^<]*<\/div><div class="t[^"]*"[^>]*>[^<]*<\/div><\/div>/g;

function tiles(r) {
  const t = [];
  t.push(tile('Land, per m²', 'qs0', D(r.gmd_m2), note(r)));
  t.push(tile('Typical plot, 400 m²', 'qs1', Dk(r.plot400),
        r.plot_src === 'observed' ? 'median asking price' : 'at the rate above'));
  if (r.house) t.push(tile('House, asking', 'qs2', Dk(r.house),
        r.house_src === 'observed' ? 'median local listing' : 'land + build cost'));
  else t.push(tile('House, asking', 'qs2', '—', 'no listings we can verify'));
  return t.join('');
}
const tile = (k, id, v, sub) =>
  `<div class="qstat"><div class="k">${k}</div><div class="v" id="${id}">${v}</div><div class="t" style="color:var(--muted);font-weight:600">${sub}</div></div>`;

/* ---------- het blok dat de prijsgrafiek vervangt ---------- */
function factRow(id, label, value, sub) {
  return `<div style="display:flex;align-items:baseline;gap:10px;padding:11px 0;border-bottom:1px solid #EFEBE1">
              <span style="flex:1;color:#4A463C">${label}</span>
              <span style="font-weight:700;color:#1A1814;white-space:nowrap"${id ? ` id="${id}"` : ''}>${value}</span>
              <span style="width:38%;min-width:150px;color:#8A8478;font-size:12.5px;text-align:right">${sub}</span>
            </div>`;
}

function priceBlock(key, r) {
  const name = r.label;
  const rentLine = r.rent_year
    ? factRow('pf3', 'Rent, long let, 2–3 bedrooms', rentValue(r), rentSub(r))
    : factRow(null, 'Rent, long let, 2–3 bedrooms', '—', 'no rental listings we can verify');

  const houseLine = r.house
    ? factRow('pf2', 'House, asking price', D(r.house),
        r.house_src === 'observed' ? 'median local listing' : 'land + build cost, 120 m² house')
    : factRow(null, 'House, asking price', '—', 'no listings we can verify');

  const expl = r.src === 'observed'
    ? `These are asking prices actually advertised in ${name}, not a national average pushed onto the map.`
    : r.src === 'thin'
      ? `We have only ${r.n} usable observation${r.n === 1 ? '' : 's'} in ${name}. The figure is the best we can see, not a market average — treat it as a starting point and check it against what you are shown.`
      : `We have no plot listings of our own for ${name} yet. The rate above is the ${r.zone === 'upcountry' ? 'provincial' : r.zone === 'greater' ? 'Greater Banjul' : r.zone === 'coast' ? 'coastal' : 'Kombo'} regional rate, and it can be wide of a specific street by a factor of two.`;

  const upc = r.zone === 'upcountry'
    ? ` Upcountry we publish land only: there is not enough house or rental advertising in ${name} to put a number on either, and a number we cannot defend is worse than none.`
    : '';

  return `<div class="block">
        <h2>What property costs in ${name}</h2>
        <p class="lead">Asking prices, measured ${DB.measured_label}. Land and buildings are priced separately here, because in The Gambia they are usually sold separately.</p>
        <div style="margin-top:16px;padding:6px 20px 18px;background:#FAF8F3;border-radius:10px;font-size:14.5px;line-height:1.6">
          ${factRow('pf0', 'Land, per m²', D(r.gmd_m2), `range ${D(r.lo)}–${D(r.hi)}`)}
          ${factRow('pf1', 'Plot of 20 × 20 m (400 m²)', D(r.plot400), r.plot_src === 'observed' ? 'median asking price' : 'at the rate above')}
          ${houseLine}
          ${rentLine}
          <p style="margin:14px 0 0;font-size:12.5px;color:#8A8478">Evidence behind the land rate: <strong>${note(r)}</strong>. Behind the rent: <strong>${rentNote(r)}</strong>. Gambian tenants think in months; agents advertise by the year, and landlords normally ask six to twelve months up front, so both units are shown.</p>
        </div>
        <p style="margin-top:18px">${expl}${upc}</p>
        <p style="margin-top:14px">Every figure on this page is an <em>asking</em> price. No one in The Gambia publishes what property actually sells for — there is no public register of sale prices — so what a seller asks is the only thing that can be measured consistently. Sale prices are generally lower, by an amount that depends entirely on the seller.${yieldLine(r)}</p>
        <p class="src">Land: ${DB.sources.land_obs} priced plot listings across The Gambia, from Facebook Marketplace (${DB.measured_label}), Songhai Properties, AccessGambia, Holprop and GamRealty. Houses and rents: ${DB.sources.house_obs} and ${DB.sources.rent_obs} local listings. <a href="how-we-measure-prices.html">How we measure prices</a>.</p>
      </div>`;
}

/* ---------- helpers ---------- */
/* Zoekt het <div class="block"> waar `marker` in staat en geeft [start,end)
   terug, met de sluitende </div> meegeteld. Tellen, niet gokken: een regex
   over geneste divs pakt de verkeerde sluiter zodra er één div bij komt. */
function blockRange(src, marker) {
  const m = src.indexOf(marker);
  if (m < 0) return null;
  const start = src.lastIndexOf('<div class="block"', m);
  if (start < 0) return null;
  let i = start, depth = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  let t;
  while ((t = re.exec(src))) {
    depth += t[0] === '</div>' ? -1 : 1;
    if (depth === 0) return [start, t.index + 6];
    i = t.index;
  }
  return null;
}

const report = [];
let changed = 0, skipped = 0;

for (const key of Object.keys(A)) {
  const r = A[key];
  const file = r.slug + '.html';
  let src;
  try { src = await readFile(file, 'utf8'); }
  catch { report.push([file, 'ONTBREEKT']); skipped++; continue; }
  const before = src;
  const probs = [];

  /* 1 — de drie prijstegels */
  let seen = 0;
  const q = src.replace(QSTAT, m => (seen++ < 3 ? (seen === 1 ? tiles(r) : '') : m));
  if (seen < 3) probs.push('minder dan 3 qstat-tegels gevonden (' + seen + ')');
  else src = q;

  /* 2 — prijsgrafiekblok vervangen */
  const marker = src.includes('<h2>Price trends</h2>') ? '<h2>Price trends</h2>'
               : '<h2>What property costs in ' + r.label + '</h2>';
  const rng = blockRange(src, marker);
  if (!rng) probs.push('prijsblok niet gevonden (' + marker + ')');
  else src = src.slice(0, rng[0]) + priceBlock(key, r) + src.slice(rng[1]);

  /* 3 — het tekenscript van de verwijderde grafiek weg */
  const chart = src.match(/(?:\/\/[^\n]*chart[^\n]*\n)?\(function\(\)\{\s*(?:var|const|let)\s+data=\[[0-9,.\s]+\];[\s\S]*?chartWrap\.innerHTML=[\s\S]*?\n\}\)\(\);\n?/i);
  if (chart) src = src.replace(chart[0], '');
  else if (/chartWrap/.test(src)) probs.push('chartWrap staat er nog maar het tekenscript is niet herkend');

  /* 4 — vergelijkingslijst: grondprijs per m², zelfde buren */
  /* De lijst staat op de pagina's als `const comp=[...]` met enkele
     aanhalingstekens. Deze vervanger zocht op `var comp=` met dubbele, en
     matchte daardoor sinds hij bestaat geen enkele pagina — zonder klacht,
     want de melding hieronder zit BINNEN de replace en die draaide nooit.
     Gevolg: de vergelijkingslijst op alle 41 pagina's stond nog op de oude
     eurocijfers. Nu tolerant in beide opzichten, en een gemiste match is
     voortaan een probleem in plaats van stilte. */
  const compRe = /(var|const|let)\s+comp\s*=\s*\[(.*?)\];/;
  if (!compRe.test(src)) probs.push('vergelijkingslijst niet gevonden');
  else src = src.replace(compRe, (m, kw, body) => {
    const names = [...body.matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*[\d.]+\s*\]/g)].map(x => x[1]);
    const rows = names.map(n => {
      const k = n.toLowerCase();
      const rec = A[k] || A[Object.keys(A).find(x => A[x].label === n)];
      return rec ? `['${n}',${rec.gmd_m2}]` : null;
    }).filter(Boolean);
    if (rows.length < 2) { probs.push('vergelijkingslijst niet omgezet (' + names.length + ' namen gelezen)'); return m; }
    if (rows.length !== names.length) probs.push('vergelijkingslijst: ' + (names.length - rows.length) + ' gebied(en) onbekend');
    return kw + ' comp=[' + rows.join(',') + '];';
  });
  src = src.replace(/(<h3>Compare nearby<\/h3>\s*<p>)[^<]*(<\/p>)/, '$1Land, per m²$2');

  /* 5 — updateAreaPrices(): de enige plek die de muntknop bedient */
  const upd = [
    'function updateAreaPrices(){',
    `  var v=[["qs0",${r.gmd_m2}],["pf0",${r.gmd_m2}],` +
      `["qs1",${r.plot400}],["pf1",${r.plot400}]` +
      (r.house ? `,["qs2",${r.house}],["pf2",${r.house}]` : '') +
      (r.rent_month ? `,["pf3",${Math.round(r.rent_month)}]` : '') + '];',
    '  v.forEach(function(p){ var e=document.getElementById(p[0]); if(e) e.textContent=fmtAreaPrice(p[1]); });',
    '}',
    'updateAreaPrices();'
  ].join('\n');
  const uRe = /function updateAreaPrices\(\)\{[\s\S]*?\n\}\s*\nupdateAreaPrices\(\);/;
  if (!uRe.test(src)) probs.push('updateAreaPrices() niet gevonden');
  else src = src.replace(uRe, upd);

  /* 5b — de structured data leest een zoekmachine; die moet hetzelfde zeggen */
  src = src.replace(/"additionalProperty":\[[\s\S]*?\](,"subjectOf")/, (m, tail) => {
    const P = [
      `{"@type":"PropertyValue","name":"Land asking price per m\u00b2","value":${r.gmd_m2},"unitText":"GMD","valueReference":"${DB.measured}"}`,
      `{"@type":"PropertyValue","name":"Plot of 400 m\u00b2, asking price","value":${r.plot400},"unitText":"GMD","valueReference":"${DB.measured}"}`
    ];
    if (r.house) P.push(`{"@type":"PropertyValue","name":"House asking price","value":${r.house},"unitText":"GMD","valueReference":"${DB.measured}"}`);
    P.push(`{"@type":"PropertyValue","name":"Local plot listings behind the land rate","value":${r.n}}`);
    return '"additionalProperty":[' + P.join(',') + ']' + tail;
  });

  /* 6 — vangnetten: nooit een halve pagina wegschrijven */
  if (!/<!--mk-hdr-->/.test(src)) probs.push('header-marker weg');
  if (src.length < before.length * 0.75) probs.push('pagina meer dan een kwart korter geworden');
  if (/id="qs0"[\s\S]*id="qs0"/.test(src)) probs.push('qs0 staat er dubbel in');

  if (probs.length) { report.push([file, probs.join(' | ')]); skipped++; continue; }
  if (src !== before) { changed++; if (WRITE) await writeFile(file, src); }
  report.push([file, `ok  D${r.gmd_m2}/m²  ${r.src}  n=${r.n}`]);
}

/* ---------- de tabel op gambia-property-prices.html ---------- */
{
  const file = 'gambia-property-prices.html';
  const sorted = Object.values(A).slice().sort((a, b) => b.gmd_m2 - a.gmd_m2);
  const top = sorted[0], bot = sorted[sorted.length - 1];
  let src = await readFile(file, 'utf8');
  const before = src;
  let n = 0;
  src = src.replace(/<tr><td><a href="([a-z-]+)\.html">([^<]+)<\/a><\/td><td class="reg">([^<]*)<\/td>[\s\S]*?<\/tr>/g,
    (m, slug, label, reg) => {
      const key = Object.keys(A).find(k => A[k].slug === slug);
      if (!key) return m;
      const r = A[key]; n++;
      return `<tr><td><a href="${slug}.html">${label}</a></td><td class="reg">${reg}</td>` +
        `<td class="num">${D(r.gmd_m2)}</td>` +
        `<td class="num">${SRC[r.src]}${r.n ? ' · n=' + r.n : ''}</td>` +
        `<td class="med">${Dk(r.plot400)}<span>plot, 400 m²</span></td>` +
        `<td class="med">${r.house ? Dk(r.house) : '—'}<span>house, asking</span></td></tr>`;
    });

  /* kop, inleiding en kolomtitels horen bij de nieuwe inhoud */
  src = src.replace(/<thead><tr>[\s\S]*?<\/tr><\/thead>/,
    '<thead><tr><th>Area</th><th>Region</th><th style="text-align:right">Land, per m\u00b2</th>' +
    '<th style="text-align:right">Evidence</th><th>Plot, 400 m\u00b2</th><th>House, asking</th></tr></thead>');
  src = src.replace(/<h1>[^<]*<\/h1>/, '<h1>Land and property prices in The Gambia</h1>');
  src = src.replace(/(<div class="eyebrow">)[^<]*(<\/div>)/, `$1MyKunda price table \u00b7 measured ${DB.measured_label}$2`);
  src = src.replace(/(<div class="eyebrow">[^<]*<\/div>\s*<h1>[^<]*<\/h1>\s*)<p>[\s\S]*?<\/p>/,
    '$1<p>What land actually costs, area by area, in dalasi \u2014 the currency it is sold in. ' +
    'Land and buildings are listed separately, because in The Gambia they are usually sold separately, ' +
    'and every figure says how much evidence sits behind it.</p>');
  src = src.replace(/<p class="px-lead">[\s\S]*?<\/p>/, () => {
    const obs = Object.values(A).filter(x => x.src === 'observed').length;
    const der = Object.values(A).filter(x => x.src === 'derived').length;
    return '<p class="px-lead">Land in the ' + Object.keys(A).length + ' areas MyKunda tracks runs from ' +
      '<b>' + D(top.gmd_m2) + ' per m\u00b2 in ' + top.label + '</b> down to <b>' + D(bot.gmd_m2) + ' per m\u00b2 in ' + bot.label + '</b> \u2014 ' +
      'a factor of ' + Math.round(top.gmd_m2 / bot.gmd_m2) + ' across one small country. The standard unit is a ' +
      '20 \u00d7 20 metre plot of 400 m\u00b2. <b>' + obs + '</b> of these areas have enough local plot listings for the figure to ' +
      'count as measured; <b>' + der + '</b> have none of their own and carry a regional rate instead, marked as derived. ' +
      'Upcountry we publish land only \u2014 there is not enough house or rental advertising to put a number on either. ' +
      'For bare plots specifically, see <a href="land-for-sale-in-the-gambia.html">land for sale in The Gambia</a>.</p>';
  });
  src = src.replace(/<p class="px-stamp">[\s\S]*?<\/p>/,
    '<p class="px-stamp"><span></span> Asking prices, in Gambian dalasi per square metre. ' + DB.sources.land_obs +
    ' priced plot listings from Facebook Marketplace, Songhai Properties, AccessGambia, Holprop and GamRealty. ' +
    'Measured <time datetime="' + DB.measured + '">' + DB.measured_label + '</time>. ' +
    '<a href="how-we-measure-prices.html">How we measure these prices</a></p>');

  /* op grondprijs sorteren: de tabel moet een rangorde zijn, geen willekeur */
  src = src.replace(/(<tbody>\n)([\s\S]*?)(<\/tbody>)/, (m, a, body, c) => {
    const rows = body.trim().split('\n').filter(Boolean);
    const val = t => { const s2 = t.match(/href="([a-z-]+)\.html"/); const k = s2 && Object.keys(A).find(x => A[x].slug === s2[1]);
                       return k ? A[k].gmd_m2 : -1; };
    rows.sort((x, y) => val(y) - val(x));
    return a + rows.join('\n') + '\n' + c;
  });

  report.push([file, n ? `ok  ${n} rijen` : 'GEEN RIJEN HERKEND']);
  if (n && src !== before) { changed++; if (WRITE) await writeFile(file, src); }
}


/* ---------- de overige pagina's die dezelfde cijfers herhalen ----------
   Zolang een bedrag ergens anders óók met de hand staat, is er geen één bron.
   Deze pagina's worden daarom uit dezelfde tabel bijgewerkt. */
const bySlug = {};
for (const k of Object.keys(A)) bySlug[A[k].slug] = A[k];
const byLabel = {};
for (const k of Object.keys(A)) byLabel[A[k].label] = A[k];

async function patch(file, fn) {
  let src;
  try { src = await readFile(file, 'utf8'); } catch { report.push([file, 'ONTBREEKT']); return; }
  const out = fn(src);
  if (out == null) { report.push([file, 'niets herkend']); skipped++; return; }
  if (out !== src) { changed++; if (WRITE) await writeFile(file, out); }
  report.push([file, 'ok']);
}

/* overzichtspagina met de gebiedskaartjes */
await patch('areas-in-the-gambia.html', src => {
  let n = 0;
  src = src.replace(/(href="([a-z-]+)\.html"[\s\S]{0,220}?<span class="pr">)[^<]*<small[^>]*>[^<]*<\/small>(<\/span>)/g,
    (m, head, slug, tail) => {
      const r = bySlug[slug]; if (!r) return m;
      n++; return head + D(r.gmd_m2) + '<small class="">land / m²</small>' + tail;
    });
  src = src.replace(/<b>\$1,100 per square metre in Cape Point<\/b> to <b>\$32 in Fatoto<\/b>/,
    `<b>${D(A['cape point'].gmd_m2)} per square metre of land in Cape Point</b> down to <b>${D(A['fatoto'].gmd_m2)} in Fatoto</b>`);
  src = src.replace(/with the average asking price per square metre and the year-on-year change/g,
    'with the asking price of land per square metre and how much evidence sits behind it');
  return n ? src : null;
});

/* de grondpagina: dezelfde tabel, maar dan voor kavels */
await patch('land-for-sale-in-the-gambia.html', src => {
  let n = 0;
  src = src.replace(/<tr><td><a href="([a-z-]+)\.html">([^<]+)<\/a><\/td><td class="reg">([^<]*)<\/td>[\s\S]*?<\/tr>/g,
    (m, slug, label, reg) => {
      const r = bySlug[slug]; if (!r) return m;
      n++;
      return `<tr><td><a href="${slug}.html">${label}</a></td><td class="reg">${reg}</td>` +
        `<td class="med">${Dk(r.plot400)}<span>plot, 400 m²</span></td>` +
        `<td class="num">${D(r.gmd_m2)}</td>` +
        `<td class="num">${SRC[r.src]}${r.n ? ' · n=' + r.n : ''}</td></tr>`;
    });
  src = src.replace(/<thead><tr>[\s\S]*?<\/tr><\/thead>/,
    '<thead><tr><th>Area</th><th>Region</th><th>Typical plot asking price</th>' +
    '<th style="text-align:right">Land, per m²</th><th style="text-align:right">Evidence</th></tr></thead>');
  src = src.replace(/<p class="px-stamp">[\s\S]*?<\/p>/,
    '<p class="px-stamp"><span></span> Asking prices in Gambian dalasi, measured <time datetime="' + DB.measured + '">' +
    DB.measured_label + '</time>. The standard unit here is a 20 × 20 metre plot of 400 m² — the size most Gambian plots are sold in. ' +
    '<a href="how-we-measure-prices.html">How we measure these prices</a></p>');
  src = src.replace(/a standard 1000 m² plot, the area price per m² and the year-on-year change/g,
    'a standard 400 m² plot, the price of land per m² and the evidence behind it');
  src = src.replace(/1000 m²/g, '400 m²');
  src = src.replace(/<b>Avg\. price \/ m²<\/b> is the area's index across everything that sells there, built and unbuilt, so it sits far/,
    "<b>Land, per m²</b> is the rate for bare ground only — buildings are priced separately on this site, so it sits far");
  src = src.replace(/MyKunda price index/g, 'MyKunda price table');
  return n ? src : null;
});

/* objectpagina: het buurtblok onder de listing */
await patch('property.html', src => {
  let n = 0;
  src = src.replace(/stats: \[\['Avg\. price\/m²',\s*([\d.]+),/g, (m, v) => {
    n++; return `stats: [['Land, per m²', ${DB.extra._default.gmd_m2},`;
  });
  src = src.replace(/'([^']+)': \{\n(\s*)intro:([\s\S]*?)stats: \[\['Land, per m²',\s*([\d.]+),/g,
    (m, label, ind, intro, val) => {
      const r = byLabel[label] || (DB.extra && DB.extra[label]) || (DB.extra && DB.extra._default);
      if (!r) return m;
      n++;
      return `'${label}': {\n${ind}intro:${intro}stats: [['Land, per m²', ${r.gmd_m2},`;
    });
  src = src.replace(/h\[0\]==='Avg\. price\/m²'/g, "h[0]==='Land, per m²'");
  return n ? src : null;
});

/* ---------- wijktegels op de voorpagina en op /buy ----------
   Dit waren de laatste bedragen op de site die met de hand in een pagina
   stonden, en ze liepen dan ook uit de pas: de voorpagina zei "Avg
   D83.747/m²" voor Kololi, /buy zei D95.450 voor hetzelfde gebied, en de
   areapagina zelf publiceert D8.800 per m² grond. Drie getallen, één
   plaats. Ze staan bovendien met een koers van D83,00 per euro ingebakken,
   die nergens anders op de site voorkomt.

   Ze komen nu uit area-prices.json, net als al het andere — zie de regel in
   CLAUDE.md: zet nooit met de hand een bedrag in een pagina. */
/* Hoeveel waarnemingen er achter een tegelcijfer zitten, in de tegel zelf.
   Cape Point stond op de voorpagina met D16.667 per m² uit ÉÉN advertentie.
   De areapagina zegt daar eerlijk "1 observation only" bij; de tegel zei
   niets, en zo krijgt de mening van één verkoper het gewicht van een
   marktprijs op de drukst bezochte pagina van de site.

   Bij `observed` (drie of meer waarnemingen, dus een mediaan) blijft het
   kaal — daar is het getal wat het voorgeeft te zijn. */
function tegelBewijs(r) {
  if (r.src === 'observed') return '';
  if (r.src === 'thin') return ' · ' + r.n + ' listing' + (r.n === 1 ? '' : 's');
  return ' · no local listings';
}

for (const page of ['home.html', 'index.html', 'buy.html']) {
  await patch(page, src => {
    let n = 0, missed = [];
    src = src.replace(
      /* Zowel "Avg" (de oude tekst) als "Land" (wat deze stap ervan maakt),
         zodat een tweede run niet "niets herkend" meldt over werk dat de
         eerste al goed heeft gedaan. Hetzelfde geldt voor het staartje met
         het aantal waarnemingen: dat wordt meegelezen en opnieuw gezet, niet
         opgestapeld. Wat er ná /m² aan redactionele tekst staat — "· Beach &
         nightlife" — blijft ongemoeid. */
      /(<h3>([^<]+)<\/h3><p>[^<]*?)(?:Avg|Land) (<span class="(?:hood-price|apr)" data-gmd=")\d+(">)[^<]*(<\/span>)(\/m²)( · (?:\d+ listings?|no local listings))?/g,
      (m, head, label, pre, mid, post, eenheid) => {
        const r = byLabel[label] || A[label.toLowerCase()];
        if (!r) { missed.push(label); return m; }
        n++;
        return head + 'Land ' + pre + r.gmd_m2 + mid + 'D' + r.gmd_m2.toLocaleString('en-US') +
               post + eenheid + tegelBewijs(r);
      });
    /* `probs` bestaat alleen binnen de areapagina-lus; hier is `report` de
       plek waar een probleem zichtbaar wordt. */
    if (missed.length) report.push([page, 'geen cijfer voor ' + missed.join(', ')]);
    return n ? src : null;
  });
}

/* ---------- de meetstempel op how-we-measure-prices ----------
   Stond met de hand in de zin getypt. Hij klopte, maar hij klopte per
   ongeluk: niets hield hem gelijk aan DB.fx en DB.measured, en een stempel
   die zegt wanneer en waartegen is gemeten hoort geen los leven te leiden
   van de meting zelf.

   Let op wat deze koersen WEL en NIET zijn: het is de koers waarop is
   gemeten, niet de koers waarmee de site rekent. Bedragen staan sinds
   27-08-2026 in dalasi en worden niet meer omgerekend, dus deze twee
   getallen leggen alleen vast hoe de dollar- en eurokolom in de
   bronadvertenties naar dalasi zijn gebracht. */
await patch('how-we-measure-prices.html', src => {
  const d = new Date(DB.measured + 'T00:00:00Z');
  const nl = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const stamp = `<p class="px-stamp"><span></span> Last measured <time datetime="${DB.measured}">${nl}</time>. ` +
    `Rates used to bring foreign-currency listings into dalasi: D${FX.usd.toFixed(2)} per US dollar, ` +
    `D${FX.eur.toFixed(2)} per euro (Central Bank of The Gambia, ${nl}). ` +
    `Every amount on this site is stored and shown in dalasi; other currencies are converted at the live rate on the day you look.</p>`;
  const re = /<p class="px-stamp">[\s\S]*?<\/p>/;
  if (!re.test(src)) { report.push(['how-we-measure-prices.html', 'meetstempel niet gevonden']); return null; }
  return src.replace(re, stamp);
});

/* metateksten en structured data die de oude belofte herhalen */
const TXT = [
  [/Average asking price per square metre for 41 areas in The Gambia, with the year-on-year change, collected from listings and partner agents and updated monthly\./g,
   'Asking price of land per square metre for 41 areas in The Gambia, in dalasi, with the number of local listings behind each figure. Measured monthly.'],
  [/Average asking price per m² for 41 areas in The Gambia, from Kololi to Fatoto, with the year-on-year change per area\. Updated every month\./g,
   'What land costs per square metre in 41 areas of The Gambia, in dalasi, with the evidence behind every figure. Measured monthly.'],
  [/What a square metre costs in 41 areas of The Gambia, with the year-on-year change\. Updated monthly\./g,
   'What land costs per square metre in 41 areas of The Gambia, in dalasi, with the evidence behind every figure.'],
  [/\{"@type":"PropertyValue","name":"Average asking price per m²","unitText":"USD\/m²"\},\{"@type":"PropertyValue","name":"Year-on-year change","unitText":"PERCENT"\}/g,
   '{"@type":"PropertyValue","name":"Land asking price per m²","unitText":"GMD"},{"@type":"PropertyValue","name":"Local plot listings behind the figure","unitText":"COUNT"}'],
  [/average asking price per square metre for 41 areas, from the Kololi strip to Fatoto in the far east, with the year-on-year change per area\. The figures are asking prices collected from listings and partner agents and are indicative only\./g,
   'asking price of land per square metre for 41 areas, from the Kololi strip to Fatoto in the far east, in dalasi. Every figure says how many local listings sit behind it; they are asking prices and indicative only.'],
  [/Kololi strip to Fatoto in the far east, with the year-on-year change per area\. The figures are asking prices collected from listings and partner agents and are indicative only\./g,
   'Kololi strip to Fatoto in the far east, in dalasi. Every figure says how many local listings sit behind it; they are asking prices and indicative only.'],
  [/Where the MyKunda price index comes from/g, 'Where the MyKunda price figures come from'],
  [/MyKunda price index/g, 'MyKunda price table'],
];
for (const f of ['gambia-property-prices.html', 'how-we-measure-prices.html', 'index.html', 'areas-in-the-gambia.html']) {
  let src = await readFile(f, 'utf8');
  const before = src;
  for (const [re, to] of TXT) src = src.replace(re, to);
  if (src !== before) { changed++; if (WRITE) await writeFile(f, src); report.push([f + ' (tekst)', 'ok']); }
  else report.push([f + ' (tekst)', 'ongewijzigd']);
}

for (const [f, s] of report) console.log(f.padEnd(26), s);
console.log(`\n${WRITE ? 'geschreven' : 'zou schrijven'}: ${changed} bestand(en), overgeslagen: ${skipped}`);
if (skipped) console.log('LET OP: overgeslagen bestanden zijn NIET aangepast. Los de melding op en draai opnieuw.');
if (!WRITE) console.log('Dit was een proefdraai. Voeg --write toe om het echt te schrijven.');
