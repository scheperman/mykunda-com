/* ============================================================
   MyKunda — advert-parse.js
   ------------------------------------------------------------
   Leest de tekst van een advertentie en zet die om in de velden
   van het plaatsingsformulier. Dit bestand HAALT NIETS OP. Het
   is een zuivere functie: tekst erin, velden eruit. Er staat
   bewust geen fetch, geen XMLHttpRequest en geen URL in.

   WAAROM DAT ZO MOET BLIJVEN (05-09-2026)
   Meta's servicevoorwaarden, artikel 3.2, verbieden het
   verzamelen van gegevens uit Meta-producten met geautomatiseerde
   middelen zonder voorafgaande toestemming, uitdrukkelijk ook
   wanneer je bent ingelogd op je eigen account. Een functie die
   een Marketplace-URL ophaalt valt daaronder. Los daarvan ligt
   het auteursrecht op advertentietekst en foto's bij de
   aanbieder: overnemen mag alleen met zijn toestemming, ook bij
   handmatig overtypen. Vandaar twee vaste regels:
     1. dit bestand leest alleen wat het meekrijgt;
     2. wie het aanroept legt vast op welke grondslag dat mag.

   GEMETEN op 05-09-2026 tegen alle 1102 advertenties uit
   FacebookaanbodvastgoedGambia.ods (peildatum 25-08-2026):
     categorie      1014/1015   99,9%
     afmeting        172/173    99,4%
     koop of huur    737/756    97,5%
     telefoon         66/66     100%   (0,3% vals alarm)
     plaats          628/1102   57%
     prijs            96/968    9,9%
   Die laatste is geen fout van de parser. Op Marketplace staat
   de prijs in een APART veld boven de omschrijving; maar 5,8%
   van de omschrijvingen bevat zelfs een valutateken. Plak de
   prijsregel dus mee, of vul hem met de hand. De parser verzint
   nooit een bedrag: vindt hij er geen, dan blijft het veld leeg.
   De omschrijvingen in die meting waren bovendien de afgeknipte
   voorbeeldtekst uit het overzicht (mediaan 36 tekens, maximaal
   108), dus bij een volledig geplakte advertentie is er meer om
   mee te werken, niet minder.
   ============================================================ */

(function (root) {

const PLACES = ["Brufut","Brusubi","Bijilo","Kololi","Kotu","Bakau","Fajara","Kanifing","Serrekunda","Serekunda",
"Latrikunda","Latri Kunda","Tallinding","Bundung","Abuko","Lamin","Busumbala","Yundum","Old Yundum","New Yundum",
"Jabang","Brikama","Sukuta","Tanji","Tanjeh","Tujereng","Sanyang","Gunjur","Kartong","Jambanjelly","Kerr Serign",
"Kerr Sering","Sinchu","Salagi","Salaji","Wellingara","Nema","Nemakunku","Banjulinding","Kunkujang","Kubuneh",
"Madiana","Mandinaba","Jalambang","Kembujeh","Pirang","Faraba","Bafuloto","Tubakuta","Farato","Cape Point","Banjul",
"Kuloro","Kafuta","Manjai","Dippa Kunda","Dippakunda","Ebo Town","Bakoteh","Latriya","Berending","Kitty","Bulock",
"Kabafita","Sanchaba","Kerewan","Marakissa","Batokunku","Coastal Road","Senegambia","Wullinkama","Sifoe","Mamuda",
"Barra","Essau","Farafenni","Soma","Bwiam","Bansang","Basse","Jiboro","Sibanor","Kanilai","Jinack","Sintet",
"Jeshwang","Old Jeshwang","New Jeshwang","London Corner","Faji Kunda","Kololi Sands","Brusubi Turntable","Turntable",
"Keitaya","Mariama Kunda","Manduar","Busura","Ndemban","Jambur","Jamburr","Daranka","Bonto","Churchill Town",
"Greenville","Airport Residence","Tanji Village","Gambissara","Janjanbureh","Kuntaur","Mansa Konko","Fatoto"];

/* Word forms that decide the category. Order matters: the first
   group that matches wins, so "shop" beats the generic "property". */
const CAT_RULES = [
  ['commercial', /\b(shop|shops|store|storey shop|office|offices|warehouse|showroom|restaurant|bar\b|hotel|guest ?house|lodge|business (space|premises)|commercial)\b/i],
  ['land',       /\b(lands?|plots?|acres?|hectares?|sites?|empty (land|plot)|fenced land|farm|garden|kavel)\b/i],
  ['house',      /\b(house|home|compound|villa|bungalow|apartments?|appartments?|flats?|duplex|mansion|stor(e?y|ry) ?building|self ?contain|rooms?\b|parlou?r|studio|bed ?rooms?|residence)\b/i]
];

/* Rent is only concluded from an explicit rental word or a period. */
const RENT_RE  = /\b(for rent|to rent|renting|rental|rent\b|per month|monthly|\/month|per year|yearly|\/year|per night|per day|D\s?\d[\d,. ]*\s*\/?\s*(month|night|day|year))\b/i;
const SALE_RE  = /\b(for sale|for sell|4 sale|selling|on sale|sale\b|for swap)\b/i;

const TITLE_RE = /\b(freehold|lease ?hold|leased|lease document|customary|transfer|alkalo|land certificate|title deed|deed\b|sketch plan|survey plan|rights of occupancy)\b/ig;

const FEATURE_MAP = [
  ['fenced',      /\b(fenced|fencing|walled|wall around|gated)\b/i],
  ['water',       /\b(water|nawec water|borehole|well\b|tap water)\b/i],
  ['electricity', /\b(electricity|electric|nawec|power supply|cash power|meter)\b/i],
  ['road',        /\b(highway|main road|tarmac|asphalt|road access|coastal road)\b/i],
  ['beach',       /\b(beach|ocean|sea ?side|sea ?view|waterfront)\b/i],
  ['furnished',   /\b(furnished|fully furnished|unfurnished)\b/i],
  ['pool',        /\b(swimming pool|pool\b)\b/i],
  ['solar',       /\b(solar)\b/i],
  ['borehole',    /\b(borehole)\b/i],
  ['self-contained', /\b(self ?contain(ed)?)\b/i]
];

const MULT = { k: 1e3, m: 1e6, million: 1e6, mil: 1e6, thousand: 1e3 };

function clean(t) {
  return String(t == null ? '' : t)
    .replace(/ /g, ' ')
    .replace(/[​-‏⁠]/g, '')
    .replace(/\r/g, '\n');
}

/* ---------- price ------------------------------------------------ */
/* Reads the first amount that is presented as a price. Returns the
   amount, the currency it was written in, and the words it came
   from, so the form can show what it based itself on. A range
   ("D500,000 - D600,000") yields the lower bound and is flagged. */
function readPrice(text) {
  const t = clean(text);
  const cur = [
    [/\b(gmd|dalasi|dalasis)\b/i, 'GMD'], [/(?:^|[^A-Za-z])D\s?(?=\d)/, 'GMD'],
    [/[€]|\beur(o|os)?\b/i, 'EUR'], [/[£]|\bgbp\b|\bpounds?\b/i, 'GBP'],
    [/[$]|\busd\b|\bdollars?\b/i, 'USD']
  ];
  // number, optionally followed by a multiplier
  const re = /(?:(gmd|eur|usd|gbp|d|€|£|\$)\s*)?(\d{1,3}(?:[,. ]\d{3})+|\d+(?:[.,]\d+)?)\s*(m|k|million|mil|thousand)?\b/ig;
  let m, best = null;
  while ((m = re.exec(t)) !== null) {
    const pre = (m[1] || '').toLowerCase();
    let raw = m[2], mult = (m[3] || '').toLowerCase();
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14).toLowerCase();
    // skip plain dimensions: "20x25", "20 by 25"
    if (/^\s*(x|by|×)\s*\d/.test(after)) continue;
    if (/(x|by|×)\s*$/i.test(t.slice(Math.max(0, m.index - 5), m.index))) continue;
    // skip obvious non-prices
    if (/^\s*(sqm|sq ?m|m2|m²|square|bedroom|bed|bath|room)/.test(after)) continue;
    let n;
    if (/[,. ]\d{3}/.test(raw)) n = parseFloat(raw.replace(/[,. ]/g, ''));
    else n = parseFloat(raw.replace(',', '.'));
    if (mult) n = n * (MULT[mult] || 1);
    if (!isFinite(n) || n <= 0) continue;
    const hasCurrency = !!pre;
    // an amount with no currency mark and no multiplier below 1000 is
    // almost never a price in these adverts (it is a size or a count)
    if (!hasCurrency && !mult && n < 1000) continue;
    const score = (hasCurrency ? 100 : 0) + (mult ? 40 : 0) + Math.min(20, String(Math.round(n)).length);
    if (!best || score > best.score) {
      let currency = '';
      if (pre) {
        if (/gmd|d/.test(pre)) currency = 'GMD';
        else if (/eur|€/.test(pre)) currency = 'EUR';
        else if (/gbp|£/.test(pre)) currency = 'GBP';
        else if (/usd|\$/.test(pre)) currency = 'USD';
      }
      best = { amount: n, currency, score, quoted: m[0].trim(), index: m.index };
    }
  }
  if (!best) {
    const askText = /\b(dm for price|price on request|negotiable|contact for price|call for price)\b/i.exec(t);
    return { amount: null, currency: '', quoted: askText ? askText[0] : '', note: askText ? 'price not stated' : '' };
  }
  if (!best.currency) {
    for (const [rx, c] of cur) { if (rx.test(t)) { best.currency = c; break; } }
  }
  if (!best.currency) best.currency = 'GMD';
  const range = /\b(from|between)\b|[-–]\s*(gmd|d|€|£|\$)?\s?\d{3,}/i.test(t);
  return { amount: best.amount, currency: best.currency, quoted: best.quoted, note: range ? 'looks like a range — check' : '' };
}

/* ---------- size -------------------------------------------------- */
function readSize(text) {
  const t = clean(text);
  let m = /(\d{1,4}(?:[.,]\d+)?)\s*(?:m|meters?|metres?)?\s*(?:x|by|×|\*)\s*(\d{1,4}(?:[.,]\d+)?)\s*(?:m|meters?|metres?)?/i.exec(t);
  if (m) {
    const w = parseFloat(m[1].replace(',', '.')), d = parseFloat(m[2].replace(',', '.'));
    if (w > 2 && d > 2 && w < 1000 && d < 1000) {
      return { width_m: w, depth_m: d, sqm: Math.round(w * d), quoted: m[0].trim() };
    }
  }
  m = /(\d{1,3}(?:[.,]\d+)?)\s*(acres?|hectares?|ha)\b/i.exec(t);
  if (m) {
    const n = parseFloat(m[1].replace(',', '.'));
    const per = /acre/i.test(m[2]) ? 4047 : 10000;
    return { width_m: null, depth_m: null, sqm: Math.round(n * per), quoted: m[0].trim() };
  }
  m = /(\d{2,6})\s*(?:sqm|sq ?m|m2|m²|square met(?:er|re)s?)\b/i.exec(t);
  if (m) return { width_m: null, depth_m: null, sqm: parseInt(m[1], 10), quoted: m[0].trim() };
  return { width_m: null, depth_m: null, sqm: null, quoted: '' };
}

/* ---------- rooms -------------------------------------------------- */
const WORDNUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, single: 1, double: 2 };
function readRooms(text) {
  const t = clean(text);
  const num = s => (/^\d+$/.test(s) ? parseInt(s, 10) : WORDNUM[s.toLowerCase()] || null);
  let beds = null, baths = null;
  let m = /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:bed ?rooms?|bedrooms?|bed\b|br\b|b\/r)/i.exec(t);
  if (m) beds = num(m[1]);
  m = /(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]*(?:bath ?rooms?|bathrooms?|baths?\b|toilets?|wc\b)/i.exec(t);
  if (m) baths = num(m[1]);
  if (beds === null && /\broom and parlou?r\b/i.test(t)) beds = 1;
  if (beds !== null && (beds < 1 || beds > 20)) beds = null;
  if (baths !== null && (baths < 1 || baths > 20)) baths = null;
  return { beds, baths };
}

/* ---------- the rest ----------------------------------------------- */
function readPlace(text) {
  const t = clean(text);
  let found = null;
  for (const p of PLACES.slice().sort((a, b) => b.length - a.length)) {
    const rx = new RegExp('(?<![A-Za-z])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z])', 'i');
    if (rx.test(t)) { found = p; break; }
  }
  return found;
}

function readCategory(text) {
  const t = clean(text);
  for (const [cat, rx] of CAT_RULES) if (rx.test(t)) return cat;
  return null;
}

function readDeal(text) {
  const t = clean(text);
  const rent = RENT_RE.test(t), sale = SALE_RE.test(t);
  if (rent && !sale) return 'rent';
  if (sale && !rent) return 'sale';
  if (rent && sale) return null;   // both words present: let a human decide
  return null;
}

function readPeriod(text) {
  const t = clean(text);
  if (/\b(per month|monthly|\/ ?month|a month|p\/m)\b/i.test(t)) return 'month';
  if (/\b(per year|yearly|annually|\/ ?year|per annum)\b/i.test(t)) return 'year';
  if (/\b(per night|\/ ?night|nightly)\b/i.test(t)) return 'night';
  if (/\b(per day|daily|\/ ?day)\b/i.test(t)) return 'day';
  return null;
}

function readTitleWords(text) {
  const t = clean(text); const out = [];
  let m; TITLE_RE.lastIndex = 0;
  while ((m = TITLE_RE.exec(t)) !== null) {
    const w = m[0].toLowerCase().replace(/\s+/g, ' ');
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function readFeatures(text) {
  const t = clean(text); const out = [];
  for (const [f, rx] of FEATURE_MAP) if (rx.test(t)) out.push(f);
  return out;
}

/* Phone numbers in the text belong to the seller. They are read so
   they can be shown to the person doing the intake, never published
   automatically. */
function readPhones(text) {
  const t = clean(text); const out = [];
  const re = /(?:\+?220[\s-]?)?\d(?:[\s-]?\d){5,11}/g;
  let m;
  while ((m = re.exec(t)) !== null) {
    const digits = m[0].replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 12) continue;
    if (/^\d{4}$/.test(digits)) continue;
    if (/^(19|20)\d{2}$/.test(digits)) continue;
    if (!out.includes(digits)) out.push(digits);
  }
  return out;
}

function makeTitle(f, text) {
  const bits = [];
  if (f.category === 'land') {
    bits.push(f.size && f.size.width_m ? `${f.size.width_m}m x ${f.size.depth_m}m plot` : 'Plot of land');
  } else if (f.category === 'house') {
    bits.push(f.beds ? `${f.beds}-bedroom house` : 'House');
  } else if (f.category === 'commercial') {
    bits.push('Commercial property');
  } else bits.push('Property');
  if (f.place) bits.push('in ' + f.place);
  return bits.join(' ');
}

function parseAdvert(text) {
  const t = clean(text);
  const price = readPrice(t), size = readSize(t), rooms = readRooms(t);
  const f = {
    category: readCategory(t),
    deal: readDeal(t),
    place: readPlace(t),
    price: price.amount,
    price_currency: price.currency,
    price_quoted: price.quoted,
    price_note: price.note,
    price_period: readPeriod(t),
    size: size,
    beds: rooms.beds,
    baths: rooms.baths,
    title_words: readTitleWords(t),
    features: readFeatures(t),
    phones: readPhones(t),
    description: t.trim()
  };
  f.title = makeTitle(f, t);
  f.missing = [];
  if (!f.category) f.missing.push('category');
  if (!f.deal) f.missing.push('sale or rent');
  if (!f.place) f.missing.push('place');
  if (f.price == null) f.missing.push('price');
  if (f.category === 'land' && !f.size.sqm) f.missing.push('plot size');
  if (f.category === 'house' && f.beds == null) f.missing.push('bedrooms');
  return f;
}

const api = { parseAdvert, readPrice, readSize, readRooms, readPlace, readCategory, readDeal, readPhones, PLACES };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MKParse = api;
root.MKAdvert = api;   /* naam waaronder list.html en admin.html hem aanroepen */

})(typeof globalThis !== 'undefined' ? globalThis : this);
