/* ============================================================
   MyKunda — Market index (backoffice)
   Reads public.market_snapshots (see backend/market-index.sql).
   In demo mode it generates a synthetic listing population and
   aggregates it with exactly the same rules as the SQL rollup,
   so the console behaves identically before the backend is live.
   ============================================================ */

const MKI = {
  kind: 'sale',
  axis: 'landuse',
  metric: 'index',
  ccy: 'USD',
  months: 24,
  rows: [],
  lastRun: null,
  fx: 66,
  live: true,
  real: false,      // deflate the index by CPI
  macro: {}         // official series, by series -> month -> value
};

const MKI_COLORS = ['#15463A', '#CE1126', '#2A7561', '#C8702D', '#1C5848', '#8A958E'];
const MKI_AXIS = { market: 'Whole market', landuse: 'Land vs built', area_land: 'Land, by area', area_built: 'Built property, by area', region: 'By region', category: 'By property type' };
const MKI_CATLABEL = { land: 'Land & plots', villa: 'Villa', house: 'House', apartment: 'Apartment', townhouse: 'Townhouse', compound: 'Compound', commercial: 'Commercial', penthouse: 'Penthouse', lodge: 'Lodge', built: 'Built property' };

/* ---------- small helpers ---------- */
function mkiRng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mkiMedian(arr) { if (!arr.length) return null; const s = arr.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function mkiMonthKey(d) { return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-01'; }
function mkiMonthsBack(n) { const out = [], now = new Date(); for (let i = n - 1; i >= 0; i--) out.push(mkiMonthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)))); return out; }
function mkiMonthLabel(k, long) { const d = new Date(k + 'T00:00:00Z'); return d.toLocaleDateString('en-GB', { month: 'short', year: long ? 'numeric' : '2-digit', timeZone: 'UTC' }); }
function mkiLabel(row) { return MKI_CATLABEL[row.segment_key] || row.segment_key; }

function mkiMoney(usd, compact) {
  if (usd == null) return '—';
  const gmd = MKI.ccy === 'GMD', v = gmd ? usd * MKI.fx : usd, sym = gmd ? 'D' : '$';
  if (compact && v >= 1e6) return sym + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M';
  if (compact && v >= 1e4) return sym + Math.round(v / 1e3) + 'k';
  return sym + Math.round(v).toLocaleString('en-US');
}
function mkiPpsm(usd) {
  if (usd == null) return '—';
  const gmd = MKI.ccy === 'GMD', v = gmd ? usd * MKI.fx : usd;
  return (gmd ? 'D' : '$') + (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(v < 10 ? 1 : 0));
}
function mkiPct(p, big) {
  if (p == null) return '<span class="pct flat">—</span>';
  const c = p > 0.25 ? 'up' : p < -0.25 ? 'down' : 'flat';
  const arrow = p > 0.25 ? '▲' : p < -0.25 ? '▼' : '·';
  return '<span class="pct ' + c + (big ? ' big' : '') + '">' + arrow + ' ' + (p > 0 ? '+' : '') + p.toFixed(1) + '%</span>';
}
/* CPI is published monthly but stored sparsely — interpolate between the
   months we actually have, rather than dropping a year of the curve. */
function mkiCpi(month, series) {
  const s = MKI.macro[series || 'cpi_all'];
  if (!s) return null;
  if (s[month] != null) return s[month];
  const keys = Object.keys(s).sort();
  if (!keys.length) return null;
  let lo = null, hi = null;
  keys.forEach(function (k) { if (k <= month) lo = k; if (hi === null && k >= month) hi = k; });
  if (lo && hi && lo !== hi) {
    const t = (Date.parse(month) - Date.parse(lo)) / (Date.parse(hi) - Date.parse(lo));
    return s[lo] + (s[hi] - s[lo]) * t;
  }
  return s[lo || hi];
}

/* Real index: what the market did once national inflation is taken out. */
function mkiDeflate(r) {
  if (r.index_real_100 != null) return r.index_real_100;
  if (r.index_100 == null) return null;
  const base = mkiCpi(mkiMonthsBack(MKI.months)[0]), now = mkiCpi(r.month);
  if (!base || !now) return null;
  return r.index_100 * base / now;
}

function mkiVal(r) {
  if (MKI.metric === 'index') return MKI.real ? mkiDeflate(r) : r.index_100;
  return MKI.metric === 'ppsm' ? r.median_ppsm : r.median_price;
}

/* ============================================================
   Demo population — synthetic listings, aggregated like the SQL
   ============================================================ */
const MKI_AREAS = [
  // key, region, land $/m² 24m ago, built $/m² 24m ago, monthly growth, listings per month
  ['Kololi', 'Kombo North', 58, 720, 0.0115, 2.6],
  ['Bijilo', 'Kombo North', 52, 690, 0.0125, 2.1],
  ['Cape Point', 'Greater Banjul', 64, 760, 0.0085, 1.3],
  ['Brufut', 'Kombo South', 31, 520, 0.0135, 2.3],
  ['Brusubi', 'Kombo North', 39, 580, 0.0105, 2.4],
  ['Kerr Serign', 'Kombo North', 44, 610, 0.0095, 1.5],
  ['Serrekunda', 'Greater Banjul', 26, 430, 0.0070, 1.9],
  ['Tanji', 'South Coast', 15, 330, 0.0155, 1.1],
  ['Sanyang', 'South Coast', 12, 300, 0.0170, 1.0],
  ['Kartong', 'South Coast', 8, 260, 0.0145, 0.5],
  ['Barra', 'North Bank', 6, 190, 0.0060, 0.4]
];
const MKI_BUILT = [['villa', .22], ['house', .3], ['apartment', .22], ['townhouse', .13], ['compound', .08], ['commercial', .05]];
/* Where the demo's evidence comes from — same mix the live registry produces. */
const MKI_SRC = [['mykunda', .28], ['agent_csv', .09], ['observation', .03], ['registry', .02],
  ['gamrealty', .17], ['propertyshop', .13], ['gambiarealestate', .10], ['schumann', .05],
  ['realigro', .07], ['holprop', .04], ['accessgambia', .02]];
function mkiPickSrc(r) { let acc = 0; for (const s of MKI_SRC) { acc += s[1]; if (r <= acc) return s[0]; } return 'mykunda'; }
function mkiIsExternal(k) { return k !== 'mykunda' && k !== 'mykunda_sold' && k !== 'observation' && k !== 'registry'; }

function mkiBuildDemo() {
  const months = mkiMonthsBack(MKI.months), rnd = mkiRng(20260810), out = [];
  MKI_AREAS.forEach(function (A, ai) {
    const [key, region, land0, built0, g, flow] = A;
    months.forEach(function (m, t) {
      // seasonality: the market wakes up after the rains (Nov–Mar)
      const season = 1 + 0.28 * Math.cos((t + ai) % 12 / 12 * Math.PI * 2);
      let n = Math.floor(flow * season + (rnd() < (flow * season) % 1 ? 1 : 0));
      for (let i = 0; i < n; i++) {
        const isRent = rnd() < 0.18;
        const isLand = !isRent && rnd() < 0.42;
        const drift = Math.pow(1 + g, t) * (1 + (rnd() - 0.5) * 0.05);
        let category, sqm, price;
        if (isLand) {
          category = 'land';
          sqm = Math.round((400 + rnd() * 900) / 50) * 50;
          price = land0 * drift * sqm * (0.82 + rnd() * 0.4);
        } else {
          let r = rnd(), acc = 0; category = 'house';
          for (const c of MKI_BUILT) { acc += c[1]; if (r <= acc) { category = c[0]; break; } }
          sqm = Math.round((category === 'apartment' ? 70 + rnd() * 90 : category === 'villa' ? 220 + rnd() * 220 : 110 + rnd() * 170) / 5) * 5;
          const mult = category === 'villa' ? 1.25 : category === 'apartment' ? 0.92 : category === 'commercial' ? 1.1 : 1;
          price = built0 * drift * mult * sqm * (0.85 + rnd() * 0.32);
          if (isRent) price = price * (0.0052 + rnd() * 0.0016); // monthly rent
        }
        const listed = t, life = 2 + Math.floor(rnd() * 8);
        const sells = rnd() < 0.55;
        out.push({
          area: key, region: region, category: category, kind: isRent ? 'rent' : 'sale',
          landuse: category === 'land' ? 'land' : 'built',
          price: Math.round(price / 100) * 100, sqm: sqm,
          src: mkiPickSrc(rnd()),
          listed: listed, sold: sells ? Math.min(listed + life, 40) : null,
          cut: rnd() < 0.22 ? listed + 2 + Math.floor(rnd() * 4) : null,
          cutPct: 0.92 + rnd() * 0.05
        });
      }
    });
  });
  return { listings: out, months: months };
}

function mkiPoolAt(listings, t) {
  const pool = [];
  for (const l of listings) {
    if (l.listed > t) continue;
    if (l.sold != null && l.sold < t) continue;
    const cut = l.cut != null && l.cut <= t;
    pool.push({
      seg: l, price: cut ? Math.round(l.price * l.cutPct) : l.price, sqm: l.sqm,
      isNew: l.listed === t, isSold: l.sold === t, isCut: l.cut === t
    });
  }
  return pool;
}

function mkiAggregate(demo) {
  const rows = [];
  demo.months.forEach(function (month, t) {
    const cur = mkiPoolAt(demo.listings, t);
    const pooled = cur.concat(mkiPoolAt(demo.listings, t - 1), mkiPoolAt(demo.listings, t - 2));
    const bucket = {};
    function add(store, type, key, kind, p) {
      if (!key) return;
      const id = type + '|' + key + '|' + kind;
      (store[id] = store[id] || { segment_type: type, segment_key: key, kind: kind, px: [], ppsm: [], n_new: 0, n_sold: 0, n_reduced: 0, n_ext: 0, srcs: {} });
      store[id].px.push(p.price);
      if (p.sqm) store[id].ppsm.push(p.price / p.sqm);
      store[id].srcs[p.seg.src] = (store[id].srcs[p.seg.src] || 0) + 1;
      if (mkiIsExternal(p.seg.src)) store[id].n_ext++;
      if (store === bucket) { if (p.isNew) store[id].n_new++; if (p.isSold) store[id].n_sold++; if (p.isCut) store[id].n_reduced++; }
    }
    function fan(store, list) {
      list.forEach(function (p) {
        const l = p.seg;
        add(store, 'market', 'All Gambia', l.kind, p);
        add(store, 'area', l.area, l.kind, p);
        add(store, 'region', l.region, l.kind, p);
        add(store, 'category', l.category, l.kind, p);
        add(store, 'landuse', l.landuse, l.kind, p);
        add(store, l.landuse === 'land' ? 'area_land' : 'area_built', l.area, l.kind, p);
      });
    }
    const poolStore = {};
    fan(bucket, cur); fan(poolStore, pooled);
    Object.keys(bucket).forEach(function (id) {
      const b = bucket[id], p = poolStore[id], thin = b.px.length < 5;
      const src = thin && p ? p : b;
      rows.push({
        month: month, segment_type: b.segment_type, segment_key: b.segment_key, kind: b.kind,
        n_listings: b.px.length, n_new: b.n_new, n_sold: b.n_sold, n_reduced: b.n_reduced,
        median_price: mkiMedian(src.px), median_ppsm: mkiMedian(src.ppsm),
        sample: src.px.length, thin: thin, method: thin ? '3m' : 'month',
        n_external: b.n_ext, n_sources: Object.keys(b.srcs).length, sources: b.srcs
      });
    });
  });
  return mkiDerive(rows);
}

/* Index (first month = 100), MoM and YoY — mirrors market_recompute_derived().
   Measured on price per m² so composition changes don't masquerade as movement. */
function mkiBasis(r) { return r.median_ppsm != null ? r.median_ppsm : r.median_price; }
function mkiDerive(rows) {
  const by = {};
  rows.forEach(function (r) { const k = r.segment_type + '|' + r.segment_key + '|' + r.kind; (by[k] = by[k] || []).push(r); });
  Object.values(by).forEach(function (list) {
    list.sort(function (a, b) { return a.month < b.month ? -1 : 1; });
    const idx = {}; list.forEach(function (r) { idx[r.month] = r; });
    const base = mkiBasis(list[0]);
    list.forEach(function (r) {
      const d = new Date(r.month + 'T00:00:00Z'), now = mkiBasis(r);
      const pm = idx[mkiMonthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))];
      const py = idx[mkiMonthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 12, 1)))];
      r.mom_pct = pm && mkiBasis(pm) ? (now / mkiBasis(pm) - 1) * 100 : null;
      r.yoy_pct = py && mkiBasis(py) ? (now / mkiBasis(py) - 1) * 100 : null;
      r.index_100 = base ? now / base * 100 : null;
    });
  });
  return mkiComposite(rows);
}

/* The whole-market line is a sample-weighted composite of the land and built
   indices — a plain median over both would just track the month's mix. */
function mkiComposite(rows) {
  const idx = {}, byKind = {};
  rows.forEach(function (r) {
    if (r.segment_type !== 'landuse' || r.index_100 == null) return;
    const k = r.kind + '|' + r.month;
    (idx[k] = idx[k] || { w: 0, s: 0 });
    idx[k].w += r.index_100 * r.sample; idx[k].s += r.sample;
  });
  Object.keys(idx).forEach(function (k) { byKind[k] = idx[k].s ? idx[k].w / idx[k].s : null; });
  rows.forEach(function (r) {
    if (r.segment_type !== 'market') return;
    const d = new Date(r.month + 'T00:00:00Z');
    const cur = byKind[r.kind + '|' + r.month];
    const pm = byKind[r.kind + '|' + mkiMonthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))];
    const py = byKind[r.kind + '|' + mkiMonthKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 12, 1)))];
    if (cur == null) return;
    r.index_100 = cur;
    r.mom_pct = pm ? (cur / pm - 1) * 100 : null;
    r.yoy_pct = py ? (cur / py - 1) * 100 : null;
  });
  return rows;
}

/* ============================================================
   Load
   ============================================================ */
async function mkiLoad() {
  try {
    if (typeof CURRENCIES !== 'undefined' && CURRENCIES.GMD && CURRENCIES.USD) MKI.fx = CURRENCIES.GMD.rate / CURRENCIES.USD.rate;
  } catch (e) { }

  if (MKI.live) {
    const first = mkiMonthsBack(MKI.months)[0];
    const data = await fetchMarketSnapshots(first);
    MKI.rows = (data || []).map(function (r) {
      return Object.assign({}, r, {
        median_price: r.median_price == null ? null : +r.median_price,
        median_ppsm: r.median_ppsm == null ? null : +r.median_ppsm,
        mom_pct: r.mom_pct == null ? null : +r.mom_pct,
        yoy_pct: r.yoy_pct == null ? null : +r.yoy_pct,
        index_100: r.index_100 == null ? null : +r.index_100,
        index_real_100: r.index_real_100 == null ? null : +r.index_real_100
      });
    });
    try { MKI.macro = await fetchMarketMacro(first); } catch (e) { MKI.macro = {}; }
    try { MKI.lastRun = await lastMarketIndexRun(); } catch (e) { }
  } else {
    MKI.rows = mkiAggregate(mkiBuildDemo());
    MKI.macro = mkiDemoMacro();
    MKI.lastRun = new Date().toISOString();
  }
  mkiRender();
}

/* Demo stand-ins for the official series, on the same shape the live
   market_macro table returns. Roughly today's Gambian numbers. */
function mkiDemoMacro() {
  const months = mkiMonthsBack(MKI.months), cpi = {}, cpih = {}, last = months[months.length - 1];
  months.forEach(function (m, t) {
    cpi[m] = +(155 * Math.pow(1.0051, t)).toFixed(1);
    cpih[m] = +(160 * Math.pow(1.0056, t)).toFixed(1);
  });
  const one = function (v) { const o = {}; o[last] = v; return o; };
  return {
    cpi_all: cpi, cpi_housing: cpih,
    inflation_yoy: one(6.3), policy_rate: one(17), tbill_91: one(4.6),
    usd_gmd: one(72.4), cement_50kg: one(425)
  };
}

/* ============================================================
   Render
   ============================================================ */
function mkiSeries() {
  const months = mkiMonthsBack(MKI.months);
  const rows = MKI.rows.filter(function (r) { return r.segment_type === MKI.axis && r.kind === MKI.kind; });
  const keys = {};
  rows.forEach(function (r) { (keys[r.segment_key] = keys[r.segment_key] || {})[r.month] = r; });
  let list = Object.keys(keys).map(function (k) {
    const pts = months.map(function (m) { return keys[k][m] || null; });
    const last = pts.slice().reverse().find(Boolean);
    return { key: k, label: MKI_CATLABEL[k] || k, points: pts, last: last, sortVal: last ? (mkiVal(last) || 0) : 0 };
  }).filter(function (s) { return s.points.some(Boolean); });
  list.sort(function (a, b) { return b.sortVal - a.sortVal; });
  return { months: months, series: list.slice(0, 6), all: list };
}

function mkiRenderChart(data) {
  const host = document.getElementById('chart');
  const W = Math.max(560, host.clientWidth), H = 330, P = { l: 66, r: 18, t: 18, b: 30 };
  const vals = [];
  data.series.forEach(function (s) { s.points.forEach(function (p) { if (p && mkiVal(p) != null) vals.push(mkiVal(p)); }); });
  if (!vals.length) { host.innerHTML = '<div class="empty"><h3>No data for this view</h3><p>Try another segment or currency.</p></div>'; return; }
  const conv = MKI.metric === 'index' ? 1 : (MKI.ccy === 'GMD' ? MKI.fx : 1);
  let lo = Math.min.apply(null, vals) * conv, hi = Math.max.apply(null, vals) * conv;
  const pad = (hi - lo) * 0.18 || hi * 0.1; lo = Math.max(0, lo - pad); hi = hi + pad;
  const step = Math.pow(10, Math.floor(Math.log10(hi - lo))) / 2;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = function (i) { return P.l + i * (W - P.l - P.r) / Math.max(1, data.months.length - 1); };
  const y = function (v) { return P.t + (1 - (v * conv - lo) / (hi - lo)) * (H - P.t - P.b); };
  const fmtY = function (v) { return MKI.metric === 'index' ? v.toFixed(0) : (MKI.ccy === 'GMD' ? 'D' : '$') + (v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.round(v).toLocaleString('en-US')); };

  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" height="' + H + '" role="img" aria-label="Monthly price development">';
  for (let g = 0; g <= 4; g++) {
    const v = lo + (hi - lo) * g / 4, yy = P.t + (1 - g / 4) * (H - P.t - P.b);
    svg += '<line x1="' + P.l + '" y1="' + yy + '" x2="' + (W - P.r) + '" y2="' + yy + '" stroke="#EFEBE1" stroke-width="1"/>';
    svg += '<text x="' + (P.l - 10) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="11.5" font-weight="600" fill="#8A958E">' + fmtY(v) + '</text>';
  }
  data.months.forEach(function (m, i) {
    if (i % (data.months.length > 14 ? 3 : 2) !== 0 && i !== data.months.length - 1) return;
    svg += '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11.5" font-weight="600" fill="#8A958E">' + mkiMonthLabel(m) + '</text>';
  });
  data.series.forEach(function (s, si) {
    const c = MKI_COLORS[si % MKI_COLORS.length];
    let d = '', open = false;
    s.points.forEach(function (p, i) {
      const v = p && mkiVal(p); if (v == null) { open = false; return; }
      d += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' '; open = true;
    });
    svg += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
    s.points.forEach(function (p, i) {
      const v = p && mkiVal(p); if (v == null) return;
      svg += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="' + (p.thin ? 3.4 : 2.6) + '" fill="' + (p.thin ? '#FFF' : c) + '" stroke="' + c + '" stroke-width="' + (p.thin ? 2 : 1) + '"/>';
    });
  });

  /* Housing CPI, rebased to 100, as the yardstick the index is measured
     against — property beating or trailing the cost of living. */
  let cpiLine = false;
  if (MKI.metric === 'index' && MKI.macro.cpi_housing) {
    const base = mkiCpi(data.months[0], 'cpi_housing');
    if (base) {
      let d = '', open = false;
      data.months.forEach(function (m, i) {
        const v = mkiCpi(m, 'cpi_housing'); if (v == null) { open = false; return; }
        d += (open ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v / base * 100).toFixed(1) + ' '; open = true;
      });
      if (d) { svg += '<path d="' + d + '" fill="none" stroke="#8A958E" stroke-width="1.8" stroke-dasharray="5 4" stroke-linejoin="round"/>'; cpiLine = true; }
    }
  }
  data.months.forEach(function (m, i) {
    svg += '<rect class="hit" data-i="' + i + '" x="' + (x(i) - (W - P.l - P.r) / data.months.length / 2) + '" y="' + P.t + '" width="' + (W - P.l - P.r) / data.months.length + '" height="' + (H - P.t - P.b) + '" fill="transparent"/>';
  });
  svg += '<line id="guide" x1="0" y1="' + P.t + '" x2="0" y2="' + (H - P.b) + '" stroke="#15463A" stroke-width="1" stroke-dasharray="3 3" opacity="0"/></svg>';
  host.innerHTML = svg + '<div class="tip" id="tip"></div>';

  document.getElementById('legend').innerHTML = data.series.map(function (s, i) {
    return '<span class="leg"><i style="background:' + MKI_COLORS[i % MKI_COLORS.length] + '"></i>' + s.label + '</span>';
  }).join('') + (cpiLine ? '<span class="leg dash"><i></i>Housing CPI, rebased (GBoS)</span>' : '')
    + (data.all.length > data.series.length ? '<span class="leg muted">+ ' + (data.all.length - data.series.length) + ' more in the table</span>' : '');

  const tip = document.getElementById('tip'), guide = document.getElementById('guide');
  host.querySelectorAll('rect.hit').forEach(function (r) {
    r.addEventListener('mouseenter', function () {
      const i = +r.dataset.i, sc = host.clientWidth / W;
      guide.setAttribute('x1', x(i)); guide.setAttribute('x2', x(i)); guide.setAttribute('opacity', '.5');
      const lines = data.series.map(function (s, si) {
        const p = s.points[i]; if (!p) return '';
        return '<div class="tl"><i style="background:' + MKI_COLORS[si % MKI_COLORS.length] + '"></i>' + s.label +
          '<b>' + (MKI.metric === 'index' ? (p.index_100 == null ? '—' : p.index_100.toFixed(1)) : MKI.metric === 'ppsm' ? mkiPpsm(p.median_ppsm) : mkiMoney(p.median_price, true)) + '</b></div>';
      }).join('');
      tip.innerHTML = '<div class="th">' + mkiMonthLabel(data.months[i], true) + '</div>' + lines;
      tip.style.opacity = '1';
      const left = x(i) * sc;
      tip.style.left = Math.min(Math.max(left - 90, 4), host.clientWidth - 190) + 'px';
    });
    r.addEventListener('mouseleave', function () { tip.style.opacity = '0'; guide.setAttribute('opacity', '0'); });
  });
}

function mkiSpark(points) {
  const vals = points.map(function (p) { return p ? mkiVal(p) : null; });
  const known = vals.filter(function (v) { return v != null; });
  if (known.length < 2) return '';
  const lo = Math.min.apply(null, known), hi = Math.max.apply(null, known), W = 78, H = 22;
  let d = '', open = false;
  vals.forEach(function (v, i) {
    if (v == null) { open = false; return; }
    const px = i * W / (vals.length - 1), py = H - 2 - (hi === lo ? H / 2 : (v - lo) / (hi - lo) * (H - 4));
    d += (open ? 'L' : 'M') + px.toFixed(1) + ' ' + py.toFixed(1) + ' '; open = true;
  });
  const up = known[known.length - 1] >= known[0];
  return '<svg width="' + W + '" height="' + H + '" aria-hidden="true"><path d="' + d + '" fill="none" stroke="' + (up ? '#2A7561' : '#CE1126') + '" stroke-width="1.8" stroke-linejoin="round"/></svg>';
}

/* Rates and cost context, straight from the official series. Never priced
   into the index — but the reason a curve bends is usually down here. */
function mkiRenderMacro() {
  const host = document.getElementById('macroStrip');
  if (!host) return;
  const latest = function (series) {
    const s = MKI.macro[series]; if (!s) return null;
    const k = Object.keys(s).sort(); return k.length ? s[k[k.length - 1]] : null;
  };
  const items = [
    ['Inflation', latest('inflation_yoy'), '%', 'GBoS'],
    ['Policy rate', latest('policy_rate'), '%', 'CBG'],
    ['T-bill 91d', latest('tbill_91'), '%', 'CBG'],
    ['Dalasi / $', latest('usd_gmd'), '', 'CBG'],
    ['Cement 50kg', latest('cement_50kg'), 'D', 'manual']
  ].filter(function (x) { return x[1] != null; });
  host.innerHTML = items.length ? items.map(function (x) {
    const v = x[2] === '%' ? Number(x[1]).toFixed(1) + '%' : x[2] === 'D' ? 'D' + Math.round(x[1]) : Number(x[1]).toFixed(1);
    return '<span class="mac"><b>' + x[0] + '</b>' + v + '<i>' + x[3] + '</i></span>';
  }).join('') : '';
}

function mkiRender() {
  const data = mkiSeries(), months = data.months, last = months[months.length - 1];
  const head = MKI.rows.filter(function (r) { return r.segment_type === 'market' && r.kind === MKI.kind && r.month === last; })[0];
  const landRow = MKI.rows.filter(function (r) { return r.segment_type === 'landuse' && r.segment_key === 'land' && r.kind === MKI.kind && r.month === last; })[0];
  const builtRow = MKI.rows.filter(function (r) { return r.segment_type === 'landuse' && r.segment_key === 'built' && r.kind === MKI.kind && r.month === last; })[0];

  document.getElementById('statRow').innerHTML = [
    ['Median ' + (MKI.kind === 'rent' ? 'rent' : 'asking price'), head ? mkiMoney(head.median_price, true) : '—', head ? mkiPct(head.mom_pct) + ' vs last month' : ''],
    [MKI.real ? 'Real index (infl. adj.)' : 'Market index', head && mkiVal(head) != null && MKI.metric === 'index' ? mkiVal(head).toFixed(1) : (head && head.index_100 != null ? (MKI.real ? (mkiDeflate(head) || 0).toFixed(1) : head.index_100.toFixed(1)) : '—'), head ? mkiPct(head.yoy_pct) + ' year on year' : ''],
    ['Land per m²', landRow ? mkiPpsm(landRow.median_ppsm) : '—', landRow ? mkiPct(landRow.yoy_pct) + ' year on year' : ''],
    ['Built per m²', builtRow ? mkiPpsm(builtRow.median_ppsm) : '—', builtRow ? mkiPct(builtRow.yoy_pct) + ' year on year' : ''],
    ['On the market', head ? head.n_listings : '—', head ? (head.n_new + ' new · ' + head.n_sold + ' closed · ' + head.n_reduced + ' cut') : ''],
    ['Outside mykunda.com', head && head.n_external != null ? head.n_external : '—',
      head && head.n_listings ? ((head.n_sources || 0) + ' sources · ' + Math.round((head.n_external || 0) / head.n_listings * 100) + '% of evidence') : '']
  ].map(function (s) {
    return '<div class="stat"><div class="lab">' + s[0] + '</div><div class="num">' + s[1] + '</div><div class="sub">' + (s[2] || '') + '</div></div>';
  }).join('');

  mkiRenderChart(data);
  mkiRenderMacro();

  const metricHead = MKI.metric === 'ppsm' ? 'Median per m²' : MKI.metric === 'index' ? 'Index' : 'Median';
  document.getElementById('tableWrap').innerHTML = data.all.length ? '<table><tr>' +
    '<th>Segment</th><th>Median</th><th>Per m²</th><th>MoM</th><th>YoY</th><th>Index</th><th>Sample</th><th>' + MKI.months + '-month trend (' + metricHead + ')</th></tr>' +
    data.all.map(function (s) {
      const r = s.last; if (!r) return '';
      return '<tr><td><b>' + s.label + '</b>' + (r.thin ? '<span class="thinflag" title="Fewer than 5 listings that month — median pooled over 3 months">thin · 3-mo</span>' : '') + '</td>' +
        '<td class="num">' + mkiMoney(r.median_price, true) + '</td>' +
        '<td class="num">' + mkiPpsm(r.median_ppsm) + '</td>' +
        '<td>' + mkiPct(r.mom_pct) + '</td><td>' + mkiPct(r.yoy_pct) + '</td>' +
        '<td class="num">' + (r.index_100 == null ? '—' : r.index_100.toFixed(1)) + '</td>' +
        '<td class="num">' + r.sample + '</td>' +
        '<td>' + mkiSpark(s.points) + '</td></tr>';
    }).join('') + '</table>' : '<div class="empty"><h3>Nothing tracked yet</h3><p>This segment has no listings in the selected period.</p></div>';

  const moverSeg = MKI.axis === 'area_built' || MKI.axis === 'category' ? 'area_built' : 'area_land';
  document.getElementById('moversTitle').textContent = (moverSeg === 'area_land' ? 'Land' : 'Built property') + ' movers, year on year';
  const movers = MKI.rows.filter(function (r) { return r.segment_type === moverSeg && r.kind === MKI.kind && r.month === last && r.yoy_pct != null; })
    .sort(function (a, b) { return b.yoy_pct - a.yoy_pct; });
  document.getElementById('movers').innerHTML = movers.length ? movers.slice(0, 3).concat(movers.slice(-3).reverse()).filter(function (v, i, a) { return a.indexOf(v) === i; })
    .map(function (r) {
      return '<div class="mover"><span>' + r.segment_key + '</span><span class="mv">' + mkiPpsm(r.median_ppsm) + '/m² ' + mkiPct(r.yoy_pct) + '</span></div>';
    }).join('') : '<p class="muted" style="font-size:13px;margin:0">Not enough history yet.</p>';

  document.getElementById('runInfo').textContent = MKI.lastRun
    ? 'Last calculated ' + new Date(MKI.lastRun).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Not calculated yet';
  document.getElementById('axisTitle').textContent = MKI_AXIS[MKI.axis];
}

/* ---------- CSV ---------- */
function mkiExportCsv() {
  const cols = ['month', 'segment_type', 'segment_key', 'kind', 'median_price_usd', 'median_price_per_sqm_usd', 'index_100', 'index_real_100', 'mom_pct', 'yoy_pct', 'n_listings', 'n_new', 'n_sold', 'n_reduced', 'n_external', 'n_sources', 'sample', 'method'];
  const rows = MKI.rows.filter(function (r) { return r.kind === MKI.kind; }).sort(function (a, b) { return a.month < b.month ? -1 : a.month > b.month ? 1 : a.segment_type.localeCompare(b.segment_type); });
  const body = rows.map(function (r) {
    const real = r.index_real_100 != null ? r.index_real_100 : mkiDeflate(r);
    return [r.month, r.segment_type, r.segment_key, r.kind, r.median_price == null ? '' : Math.round(r.median_price),
    r.median_ppsm == null ? '' : r.median_ppsm.toFixed(2), r.index_100 == null ? '' : r.index_100.toFixed(1),
    real == null ? '' : real.toFixed(1),
    r.mom_pct == null ? '' : r.mom_pct.toFixed(2), r.yoy_pct == null ? '' : r.yoy_pct.toFixed(2),
    r.n_listings, r.n_new, r.n_sold, r.n_reduced, r.n_external == null ? '' : r.n_external,
    r.n_sources == null ? '' : r.n_sources, r.sample, r.method].join(',');
  }).join('\n');
  const blob = new Blob([cols.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'mykunda-market-index-' + MKI.kind + '-' + mkiMonthsBack(1)[0] + '.csv';
  a.click(); URL.revokeObjectURL(a.href);
}

Object.assign(window, { MKI: MKI, mkiLoad: mkiLoad, mkiRender: mkiRender, mkiExportCsv: mkiExportCsv, mkiMonthsBack: mkiMonthsBack });
