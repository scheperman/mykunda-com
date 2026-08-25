/* ============================================================
   MyKunda — Sources (backoffice)
   The registry behind the market index: who we take evidence
   from, how much each one is trusted, whether last night's
   harvest worked, and what the de-duplicator threw away.
   Demo mode mirrors the live shape so the screen reads before
   backend/market-sources.sql has been run.
   ============================================================ */

const MSRC = {
  live: false,
  sources: [],
  runs: [],
  stats: null,
  macro: [],
  filter: 'all',
  busy: null
};

const MSRC_KINDLABEL = {
  own: 'Own platform', portal: 'Gambian portal', aggregator: 'Aggregator',
  agent: 'Agent list', registry: 'Registry / notary', official: 'Official statistics', costs: 'Building costs'
};
const MSRC_MACROLABEL = {
  cpi_all: 'CPI, all items', cpi_housing: 'CPI, housing & utilities', inflation_yoy: 'Inflation, year on year',
  policy_rate: 'Policy rate', tbill_91: 'T-bill, 91 day', eur_gmd: 'Dalasi per euro',
  usd_gmd: 'Dalasi per dollar', cement_50kg: 'Cement, 50 kg bag'
};

function msrcAgo(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return 'just now';
  if (s < 5400) return Math.round(s / 60) + ' min ago';
  if (s < 172800) return Math.round(s / 3600) + ' h ago';
  return Math.round(s / 86400) + ' days ago';
}
function msrcNum(n) { return n == null ? '—' : Number(n).toLocaleString('en-US'); }
function msrcEsc(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }

/* ---------- demo shape ---------- */
function msrcDemo() {
  const now = Date.now();
  const S = [
    ['mykunda', 'MyKunda listings', 'own', 0.90, 'daily', 'manual', 412, null],
    ['mykunda_sold', 'MyKunda closed deals', 'own', 1.00, 'daily', 'manual', 58, null],
    ['observation', 'Manual observations', 'registry', 0.95, 'manual', 'manual', 34, null],
    ['registry', 'Notary & land registry', 'registry', 0.95, 'manual', 'manual', 19, null],
    ['agent_csv', 'Agent lists (CSV/email)', 'agent', 0.85, 'monthly', 'manual', 126, null],
    ['gamrealty', 'GamRealty', 'portal', 0.65, 'daily', 'html', 231, null],
    ['propertyshop', 'Gambia Property Shop', 'portal', 0.65, 'daily', 'html', 188, null],
    ['gambiarealestate', 'Gambia Real Estate', 'portal', 0.60, 'daily', 'html', 143, null],
    ['schumann', 'Schumann Real Estate', 'portal', 0.60, 'weekly', 'html', 64, null],
    ['realigro', 'Realigro (aggregator)', 'aggregator', 0.40, 'weekly', 'html', 97, null],
    ['holprop', 'Holprop (aggregator)', 'aggregator', 0.40, 'weekly', 'html', 81, null],
    ['accessgambia', 'AccessGambia Property', 'aggregator', 0.35, 'weekly', 'html', 12, 'item pattern matched nothing — selector needs tuning'],
    ['gbos', 'GBoS — CPI & inflation', 'official', 0, 'monthly', 'gbos', 0, null],
    ['cbg', 'Central Bank of Gambia', 'official', 0, 'daily', 'cbg', 0, null],
    ['costs', 'Building materials', 'costs', 0, 'monthly', 'manual', 0, null]
  ];
  MSRC.sources = S.map(function (r, i) {
    return {
      key: r[0], name: r[1], kind: r[2], trust: r[3], cadence: r[4], adapter: r[5],
      active: true, in_index: r[2] !== 'official' && r[2] !== 'costs',
      items: r[6], last_error: r[7],
      last_ok_at: r[5] === 'manual' ? null : new Date(now - (r[7] ? 96 : 7 + i) * 3600e3).toISOString(),
      robots_ok: r[5] === 'html' ? true : null
    };
  });
  MSRC.runs = MSRC.sources.filter(function (s) { return s.adapter !== 'manual'; })
    .map(function (s, i) {
      const bad = !!s.last_error;
      return {
        source_key: s.key, started_at: new Date(now - (i * 41 + 20) * 60e3).toISOString(),
        ok: !bad, items_seen: bad ? 0 : s.items, items_new: bad ? 0 : Math.round(s.items * 0.06),
        items_updated: bad ? 0 : Math.round(s.items * 0.8), items_rejected: bad ? 31 : Math.round(s.items * 0.14),
        error: s.last_error, http_status: bad ? 200 : 200
      };
    });
  const own = 412 + 58 + 34 + 19 + 126, ext = 231 + 188 + 143 + 64 + 97 + 81 + 12;
  MSRC.stats = { own: own, external: ext, duplicates: 168, active_sources: 12, weighted_external: 0.34 };
  MSRC.macro = [
    { series: 'cpi_all', value: 179.5, unit: 'index 2020M1=100', month: '2026-08-01', source: 'GBoS' },
    { series: 'cpi_housing', value: 184.7, unit: 'index 2020M1=100', month: '2026-08-01', source: 'GBoS' },
    { series: 'inflation_yoy', value: 6.3, unit: '%', month: '2026-08-01', source: 'GBoS' },
    { series: 'policy_rate', value: 17.0, unit: '%', month: '2026-08-01', source: 'CBG' },
    { series: 'tbill_91', value: 4.6, unit: '%', month: '2026-08-01', source: 'CBG' },
    { series: 'usd_gmd', value: 72.4, unit: 'GMD per USD', month: '2026-08-01', source: 'CBG' },
    { series: 'cement_50kg', value: 425, unit: 'GMD per bag', month: '2026-08-01', source: 'Manual' }
  ];
}

/* ---------- load ---------- */
async function msrcLoad() {
  if (MSRC.live) {
    const d = await fetchMarketSources();
    MSRC.sources = d.sources; MSRC.runs = d.runs; MSRC.stats = d.stats; MSRC.macro = d.macro;
  } else {
    msrcDemo();
  }
  msrcRender();
}

/* ---------- render ---------- */
function msrcRenderStats() {
  const s = MSRC.stats || {};
  const total = (s.own || 0) + (s.external || 0);
  document.getElementById('statRow').innerHTML = [
    ['Evidence in the index', msrcNum(total), (s.active_sources || 0) + ' sources feeding it'],
    ['From mykunda.com', msrcNum(s.own), total ? Math.round(s.own / total * 100) + '% of rows' : ''],
    ['From elsewhere', msrcNum(s.external), total ? Math.round(s.external / total * 100) + '% of rows' : ''],
    ['Weight they carry', s.weighted_external == null ? '—' : Math.round(s.weighted_external * 100) + '%', 'after trust weighting'],
    ['Duplicates removed', msrcNum(s.duplicates), 'same property, several portals'],
    ['Failing sources', String(MSRC.sources.filter(function (x) { return x.last_error; }).length), 'see the log below']
  ].map(function (x) {
    return '<div class="stat"><div class="lab">' + x[0] + '</div><div class="num">' + x[1] + '</div><div class="sub">' + (x[2] || '') + '</div></div>';
  }).join('');
}

function msrcHealth(s) {
  if (s.adapter === 'manual') return ['manual', 'Entered by hand'];
  if (s.last_error) return ['bad', 'Failing'];
  if (!s.last_ok_at) return ['idle', 'Never run'];
  const age = (Date.now() - new Date(s.last_ok_at).getTime()) / 3600e3;
  const limit = s.cadence === 'daily' ? 30 : s.cadence === 'weekly' ? 190 : 800;
  return age > limit ? ['stale', 'Overdue'] : ['ok', 'Healthy'];
}

function msrcRenderTable() {
  const list = MSRC.sources.filter(function (s) {
    if (MSRC.filter === 'all') return true;
    if (MSRC.filter === 'priced') return s.in_index;
    if (MSRC.filter === 'context') return !s.in_index;
    if (MSRC.filter === 'failing') return !!s.last_error;
    return true;
  });
  document.getElementById('srcTable').innerHTML = list.length ? '<table><tr>' +
    '<th>Source</th><th>Type</th><th>Weight in the index</th><th>Rows</th><th>Last harvest</th><th>Status</th><th></th></tr>' +
    list.map(function (s) {
      const h = msrcHealth(s);
      return '<tr data-key="' + s.key + '">' +
        '<td><b>' + msrcEsc(s.name) + '</b>' + (s.robots_ok === false ? '<span class="flag warn">robots.txt says no</span>' : '') + '</td>' +
        '<td class="muted-cell">' + (MSRC_KINDLABEL[s.kind] || s.kind) + '</td>' +
        '<td>' + (s.in_index
          ? '<div class="wctl"><input type="range" min="0" max="100" step="5" value="' + Math.round(s.trust * 100) + '" data-trust="' + s.key + '"><b>' + Math.round(s.trust * 100) + '</b></div>'
          : '<span class="muted-cell">context only</span>') + '</td>' +
        '<td class="num">' + msrcNum(s.items) + '</td>' +
        '<td class="muted-cell">' + msrcAgo(s.last_ok_at) + '</td>' +
        '<td><span class="dot ' + h[0] + '"></span>' + h[1] + '</td>' +
        '<td class="right">' + (s.adapter === 'manual' ? '' :
          '<span><button class="btn btn-ghost btn-sm" data-test="' + s.key + '">Test</button>' +
          '<button class="btn btn-ghost btn-sm" data-run="' + s.key + '">Fetch now</button></span>') + '</td></tr>' +
        (s.last_error ? '<tr class="errrow"><td colspan="7"><b>Last error:</b> ' + msrcEsc(s.last_error) + '</td></tr>' : '');
    }).join('') + '</table>'
    : '<div class="empty"><h3>Nothing here</h3><p>No source matches this filter.</p></div>';

  document.querySelectorAll('[data-trust]').forEach(function (el) {
    el.addEventListener('input', function () { el.nextElementSibling.textContent = el.value; });
    el.addEventListener('change', function () { msrcSetTrust(el.dataset.trust, +el.value / 100); });
  });
  document.querySelectorAll('[data-test]').forEach(function (b) {
    b.addEventListener('click', function () { msrcTest(b.dataset.test, b); });
  });
  document.querySelectorAll('[data-run]').forEach(function (b) {
    b.addEventListener('click', function () { msrcRun(b.dataset.run, b); });
  });
}

function msrcRenderLog() {
  document.getElementById('runLog').innerHTML = MSRC.runs.length ? MSRC.runs.slice(0, 14).map(function (r) {
    const src = MSRC.sources.filter(function (s) { return s.key === r.source_key; })[0];
    return '<div class="logrow ' + (r.ok ? '' : 'bad') + '">' +
      '<span class="dot ' + (r.ok ? 'ok' : 'bad') + '"></span>' +
      '<b>' + msrcEsc(src ? src.name : r.source_key) + '</b>' +
      '<span class="logmeta">' + (r.ok
        ? msrcNum(r.items_seen) + ' seen · ' + msrcNum(r.items_new) + ' new · ' + msrcNum(r.items_rejected) + ' unparsed'
        : msrcEsc(r.error || 'failed')) + '</span>' +
      '<span class="logtime">' + msrcAgo(r.started_at) + '</span></div>';
  }).join('') : '<p class="how" style="margin:0">No harvest has run yet.</p>';
}

function msrcRenderMacro() {
  document.getElementById('macroList').innerHTML = MSRC.macro.length ? MSRC.macro.map(function (m) {
    const pct = m.unit === '%';
    return '<div class="mover"><span>' + (MSRC_MACROLABEL[m.series] || m.series) + '</span>' +
      '<span class="mv">' + (pct ? m.value.toFixed(1) + '%' : Number(m.value).toLocaleString('en-US')) +
      ' <span class="muted-cell" style="font-weight:600">' + msrcEsc(m.source || '') + '</span></span></div>';
  }).join('') : '<p class="how" style="margin:0">No official series stored yet.</p>';
}

function msrcRender() {
  msrcRenderStats(); msrcRenderTable(); msrcRenderLog(); msrcRenderMacro();
}

/* ---------- actions ---------- */
async function msrcSetTrust(key, trust) {
  const s = MSRC.sources.filter(function (x) { return x.key === key; })[0];
  if (s) s.trust = trust;
  msrcFlash(MSRC.live ? 'Weight saved — press Recalculate on the market index to apply it.' : 'Demo mode — weight not saved.');
  if (MSRC.live) { try { await saveSourceTrust(key, trust); } catch (e) { msrcFlash('Could not save: ' + e.message, true); } }
}

async function msrcTest(key, btn) {
  const old = btn.textContent; btn.textContent = 'Testing…'; btn.disabled = true;
  const box = document.getElementById('testOut');
  try {
    const res = MSRC.live ? await runSourceFetch(key, true) : msrcFakeTest(key);
    const r = (res.results || [])[0] || {};
    box.style.display = 'block';
    box.innerHTML = '<div class="testhead"><b>' + msrcEsc(key) + '</b> — ' +
      (r.ok ? msrcNum(r.seen) + ' rows parsed, ' + msrcNum(r.rejected) + ' unusable' : 'failed: ' + msrcEsc(r.error)) +
      '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'testOut\').style.display=\'none\'">Close</button></div>' +
      ((r.sample || []).length ? '<table><tr><th>Title</th><th>Area</th><th>Type</th><th>Price (USD)</th><th>m²</th><th>Confidence</th></tr>' +
        r.sample.map(function (x) {
          return '<tr><td>' + msrcEsc((x.title || '').slice(0, 70)) + '</td><td>' + msrcEsc(x.area || '—') + '</td>' +
            '<td>' + msrcEsc(x.category) + ' · ' + msrcEsc(x.kind) + '</td>' +
            '<td class="num">' + msrcNum(x.price_usd) + '</td><td class="num">' + (x.sqm || '—') + '</td>' +
            '<td class="num">' + Math.round((x.confidence || 0) * 100) + '%</td></tr>';
        }).join('') + '</table>' : '') +
      ((r.rejects || []).length ? '<p class="how" style="margin:12px 0 0"><b>Blocks it could not read</b> — tune the pattern for this source against these:</p>' +
        r.rejects.map(function (x) { return '<pre class="reject">' + msrcEsc(x.text) + '</pre>'; }).join('') : '');
  } catch (e) {
    box.style.display = 'block'; box.innerHTML = '<div class="testhead">Test failed: ' + msrcEsc(e.message) + '</div>';
  }
  btn.textContent = old; btn.disabled = false;
}

function msrcFakeTest(key) {
  const areas = ['Kololi', 'Brufut', 'Brusubi', 'Sanyang', 'Bijilo'];
  return {
    results: [{
      ok: true, seen: 24, rejected: 3,
      sample: areas.map(function (a, i) {
        return {
          title: a + ' — ' + (i % 2 ? 'plot of land, fenced' : '3 bedroom villa with pool'),
          area: a, category: i % 2 ? 'land' : 'villa', kind: 'sale',
          price_usd: i % 2 ? 28000 + i * 4200 : 132000 + i * 21000,
          sqm: i % 2 ? 600 + i * 50 : 240 + i * 30, confidence: 0.85 - i * 0.05
        };
      }),
      rejects: [{ text: 'Price on application · Contact agent for details · Ref GR-' + key.slice(0, 3).toUpperCase() + '-2291' }]
    }]
  };
}

async function msrcRun(key, btn) {
  const old = btn.textContent; btn.textContent = 'Fetching…'; btn.disabled = true;
  try {
    if (MSRC.live) { await runSourceFetch(key, false); await msrcLoad(); msrcFlash('Harvest finished.'); }
    else { await new Promise(function (r) { setTimeout(r, 800); }); msrcFlash('Demo mode — no harvest was run.'); }
    btn.textContent = 'Done ✓';
  } catch (e) { btn.textContent = 'Failed'; msrcFlash('Harvest failed: ' + e.message, true); }
  setTimeout(function () { btn.textContent = old; btn.disabled = false; }, 1600);
}

function msrcFlash(text, bad) {
  const el = document.getElementById('flash');
  el.textContent = text;
  el.style.color = bad ? 'var(--amber-600)' : 'var(--green-600)';
  clearTimeout(msrcFlash._t);
  msrcFlash._t = setTimeout(function () { el.textContent = ''; }, 5000);
}

Object.assign(window, {
  MSRC: MSRC, msrcLoad: msrcLoad, msrcRender: msrcRender, msrcRun: msrcRun, msrcTest: msrcTest
});
