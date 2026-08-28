/* ============================================================
   MyKunda-kaartstijl
   Neemt een officiële MapTiler-stijl en zet hem om naar de huisstijl:
   Engelse labels met terugval, de kleuren uit styles.css, en de Buildings-
   tileset in plaats van de gebouwen uit Planet. Draai:
       node maak-stijl.mjs streets-v4.style.json mykunda-streets.style.json
   ============================================================ */
import { readFileSync, writeFileSync } from 'node:fs';

const [, , bron, doel, variantArg] = process.argv;
/* Twee soorten stijl. 'paper' is de kaartlaag: die wordt volledig hergekleurd.
   'satelliet' ligt over luchtfoto's; daar zijn de witte labels met donkere
   rand van MapTiler al op leesbaarheid getekend, dus daar blijven de kleuren
   met rust en veranderen alleen de taal en de gebouwomtrekken. */
const variant = variantArg || (/hybrid|satellite/i.test(bron) ? 'satelliet' : 'paper');
const sat = variant === 'satelliet';
const s = JSON.parse(readFileSync(bron, 'utf8'));

/* ---------- huisstijl (styles.css) ---------- */
const MK = {
  land:    '#F1EFE7',   // --map-land
  water:   '#CEE2EA',   // --map-water
  park:    '#D8E6C9',   // --map-park
  road:    '#FFFFFF',   // --map-road
  roadAlt: '#EDE9DD',   // --map-road-2
  green700:'#15463A',
  green500:'#2A7561',
  ink:     '#18201D',
  muted:   '#5C6B64',
  line:    '#E5E1D6',
  /* Alleen voor de satellietlaag. Wit en lichtgrijs — waar MapTiler zijn
     hybride labels mee tekent — verdwijnen in Gambia in het beeld zelf: zand,
     zinken daken en witte muren zitten precies in dezelfde toon. Geel komt in
     die luchtfoto's nergens voor, dus een geel label ligt altijd los van de
     achtergrond. */
  satLabel:'hsl(45, 100%, 60%)'
};

/* ---------- kleur: parsen, tinten, terugschrijven ---------- */
function parse(c) {
  if (typeof c !== 'string') return null;
  let m = c.match(/^hsla?\(\s*([-\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { h: +m[1], s: +m[2] / 100, l: +m[3] / 100, a: m[4] === undefined ? 1 : +m[4] };
  m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { ...rgb2hsl(+m[1], +m[2], +m[3]), a: m[4] === undefined ? 1 : +m[4] };
  m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    const h = m[1].length === 3 ? m[1].split('').map(x => x + x).join('') : m[1];
    return { ...rgb2hsl(parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)), a: 1 };
  }
  return null;
}
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  let h = 0, sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return { h, s: sat, l };
}
const uit = o => o.a === 1
  ? `hsl(${Math.round(o.h)}, ${Math.round(o.s * 100)}%, ${Math.round(o.l * 100)}%)`
  : `hsla(${Math.round(o.h)}, ${Math.round(o.s * 100)}%, ${Math.round(o.l * 100)}%, ${+o.a.toFixed(3)})`;
const klem = (v, a, b) => Math.max(a, Math.min(b, v));

/* tint() houdt de helderheid van het origineel vast — daarmee blijft elke
   zoomtrap en elke hiërarchie in de bronstijl overeind — en vervangt alleen
   de kleurtoon en de verzadiging. */
const tint = (h, sVal, opt = {}) => c => ({
  h, s: sVal,
  l: klem(c.l * (opt.lmul ?? 1) + (opt.lplus ?? 0), opt.lmin ?? 0, opt.lmax ?? 1),
  a: c.a
});
const vast = hex => { const p = parse(hex); return c => ({ ...p, a: c.a }); };

/* ---------- welke laag krijgt welke behandeling ---------- */
const AARDE  = tint(44, 0.19, { lmin: 0.70, lmax: 0.955 });
const WATER  = tint(196, 0.38, { lmin: 0.74, lmax: 0.90 });
const GROEN  = tint(92, 0.34, { lmin: 0.74, lmax: 0.90 });
const WEG    = tint(45, 0.30, { lmin: 0.80, lmax: 1 });
const RAND   = tint(40, 0.16, { lmin: 0.68, lmax: 0.86, lmul: 0.94 });
const GRIJS  = tint(44, 0.10, { lmin: 0.62, lmax: 0.94 });

function kiesMapper(l) {
  const id = (l.id || '').toLowerCase();
  const sl = (l['source-layer'] || '').toLowerCase();
  if (id === 'background') return vast(MK.land);
  if (/water|ocean|sea|lake|river|stream|dam|swimming|waterway|ferry/.test(id) || /water|waterway/.test(sl)) return WATER;
  if (/wood|forest|grass|vegetation|farmland|park|zoo|pitch|golf|garden|cemetery/.test(id) || /vegetation|farmland|wood|forest|grass|leisure/.test(sl)) return GROEN;
  if (/outline|casing|tunnel outline|bridge/.test(id)) return RAND;
  if (/road|highway|street|motorway|pathway|cycleway|track|pier|runway|taxiway|aeroway|service/.test(id) || /road|pathway|pier|aeroway/.test(sl)) return WEG;
  if (/railway|boundary|border|dam|wall|barrier/.test(id)) return GRIJS;
  return AARDE;
}

/* ---------- Engelse labels, met terugval op de lokale naam ---------- */
const EN = ['coalesce', ['get', 'name:en'], ['get', 'name']];
const isGet = (v, k) => Array.isArray(v) && v.length === 2 && v[0] === 'get' && v[1] === k;
function engels(v) {
  if (typeof v === 'string') return /^\{name(:en)?\}$/.test(v.trim()) ? JSON.parse(JSON.stringify(EN)) : v;
  if (!Array.isArray(v)) return v;
  if (isGet(v, 'name') || isGet(v, 'name:en')) return JSON.parse(JSON.stringify(EN));
  if (v[0] === 'coalesce' && v.slice(1).every(x => isGet(x, 'name') || isGet(x, 'name:en') || x === '')) {
    const rest = v.slice(1).filter(x => x === '');
    return [...JSON.parse(JSON.stringify(EN)), ...rest];
  }
  return v.map(engels);
}

/* ---------- kleuren in een paint-waarde omzetten, structuur intact ---------- */
function kleurMap(v, f) {
  if (typeof v === 'string') { const p = parse(v); return p ? uit(f(p)) : v; }
  if (Array.isArray(v)) return v.map(x => kleurMap(x, f));
  if (v && typeof v === 'object') {
    const o = {};
    for (const k of Object.keys(v)) o[k] = k === 'stops' ? v[k].map(([z, c]) => [z, kleurMap(c, f)]) : kleurMap(v[k], f);
    return o;
  }
  return v;
}

/* ---------- labels: tekstkleuren per soort ---------- */
const PLAATS = /^(place labels|village labels|town labels|city labels|capital city labels|state labels|country labels|continent labels|island labels|archipelago labels|disputed country labels|military label)/i;
const WATERLBL = /(sea labels|ocean labels|lake labels|river labels|stream labels|ferry labels)/i;
const WEGLBL = /(road labels|pathway labels|cycleway labels|highway junctions)/i;

/* ============================================================ */
let labelsOm = 0, lagenOm = 0;
s.name = sat ? 'MyKunda Satellite' : 'MyKunda Paper';
s.metadata = { ...(s.metadata || {}), 'mykunda:variant': variant, 'mykunda:bron': bron };

if (!sat) s.layers = s.layers.filter(l => !/^(Building|Building 3D)$/.test(l.id));   // vervangen door de Buildings-tileset

for (const l of s.layers) {
  if (l.layout && l.layout['text-field']) {
    const voor = JSON.stringify(l.layout['text-field']);
    l.layout['text-field'] = engels(l.layout['text-field']);
    if (JSON.stringify(l.layout['text-field']) !== voor) labelsOm++;
  }
  /* Op de satellietlaag blijven de vlakken en lijnen met rust — daar ligt een
     luchtfoto onder, geen kleurvlak. Alleen de labels gaan om: plaatsnamen en
     straatnamen worden geel met een zwarte rand. Water blijft blauw; dat leest
     al goed en houdt water als water herkenbaar. */
  if (sat) {
    if (l.type === 'symbol' && l.paint && (PLAATS.test(l.id) || WEGLBL.test(l.id))) {
      if (l.paint['text-color']) l.paint['text-color'] = MK.satLabel;
      l.paint['text-halo-color'] = 'hsl(0, 0%, 0%)';
      l.paint['text-halo-width'] = 1.4;
      lagenOm++;
    }
    continue;
  }
  if (!l.paint) continue;
  if (l.type === 'symbol') {
    const kleur = PLAATS.test(l.id) ? MK.green700 : WATERLBL.test(l.id) ? '#6E8FA0' : WEGLBL.test(l.id) ? MK.muted : null;
    if (kleur && l.paint['text-color']) { l.paint['text-color'] = kleur; lagenOm++; }
    if (l.paint['text-halo-color']) l.paint['text-halo-color'] = 'hsla(0, 0%, 100%, 0.9)';
    continue;
  }
  const f = kiesMapper(l);
  let veranderd = false;
  for (const k of Object.keys(l.paint)) {
    if (!/color/i.test(k)) continue;
    const voor = JSON.stringify(l.paint[k]);
    l.paint[k] = kleurMap(l.paint[k], f);
    if (JSON.stringify(l.paint[k]) !== voor) veranderd = true;
  }
  if (veranderd) lagenOm++;
}

/* ---------- Buildings-tileset ---------- */
const sleutel = (s.glyphs.match(/key=([^&]+)/) || [])[1];
s.sources.mykunda_buildings = { type: 'vector', url: `https://api.maptiler.com/tiles/buildings/tiles.json?key=${sleutel}` };

/* Het pand is op een woningsite het onderwerp, niet de achtergrond. Daarom
   krijgen gebouwen hier meer gewicht dan in een gewone stadskaart: een eigen
   vlak, een duidelijke rand, en vanaf zoom 17 de naam erbij. facade_color uit
   de tileset gaat voor — staat die er niet, dan de huisstijlkleur. */
const gebouwVlak = sat ? {
  /* Op de luchtfoto tekenen we het gebouw niet dicht — de foto is het beeld.
     Alleen de omtrek, zodat de koper ziet waar het pand ophoudt en het perceel
     begint. Vanaf zoom 16, want daaronder wordt het een grijze waas. */
  id: 'MyKunda buildings', type: 'line', source: 'mykunda_buildings', 'source-layer': 'building',
  minzoom: 18,
  paint: {
    'line-color': 'hsl(150, 45%, 90%)',
    'line-width': ['interpolate', ['linear'], ['zoom'], 18, 0.6, 20, 1.6],
    'line-opacity': ['interpolate', ['linear'], ['zoom'], 18, 0.35, 20, 0.75]
  }
} : {
  id: 'MyKunda buildings', type: 'fill', source: 'mykunda_buildings', 'source-layer': 'building',
  minzoom: 12,
  paint: {
    'fill-color': ['coalesce', ['get', 'facade_color'], 'hsl(36, 22%, 75%)'],
    'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12, 0.45, 15, 0.8, 17, 0.95],
    'fill-outline-color': 'hsl(150, 14%, 52%)'
  }
};
const gebouwNaam = {
  id: 'MyKunda building labels', type: 'symbol', source: 'mykunda_buildings', 'source-layer': 'building_label',
  minzoom: 17,
  layout: {
    'text-field': JSON.parse(JSON.stringify(EN)),
    'text-font': sat ? ['Noto Sans Regular'] : ['Roboto Regular', 'Noto Sans Regular'],
    'text-size': ['interpolate', ['linear'], ['zoom'], 17, 10, 20, 13],
    'text-max-width': 8, 'text-padding': 4
  },
  paint: sat
    ? { 'text-color': MK.satLabel, 'text-halo-color': 'hsl(0, 0%, 0%)', 'text-halo-width': 1.4 }
    : { 'text-color': MK.green700, 'text-halo-color': 'hsla(0, 0%, 100%, 0.9)', 'text-halo-width': 1.2 }
};

/* Onder de wegen, boven het landgebruik: een gebouw hoort de straat niet te
   overschrijven. Op de luchtfoto ligt de omtrek meteen boven het beeld. */
const naLanduse = sat
  ? s.layers.findIndex(l => l.type === 'raster')
  : s.layers.findIndex(l => /pier|bridge/i.test(l.id) && l.type === 'fill');
const plek = naLanduse >= 0 ? naLanduse + 1 : s.layers.findIndex(l => l.type === 'line');
s.layers.splice(plek, 0, gebouwVlak);
s.layers.push(gebouwNaam);

writeFileSync(doel, JSON.stringify(s, null, 1), 'utf8');
console.log(`${doel}: ${s.layers.length} lagen · ${labelsOm} labellagen naar Engels · ${lagenOm} lagen hergekleurd`);
