// Supabase Edge Function: market-sources
//
// Harvests every source in public.market_sources and normalises it into
// public.external_listings (property evidence) or public.market_macro
// (CPI, rates, materials). The rollup in backend/market-sources.sql then
// takes a WEIGHTED median, so a thin aggregator adds coverage without
// being able to drag the index around.
//
// Deploy:   supabase functions deploy market-sources --no-verify-jwt
// Schedule: nightly, before the index rebuild
//             select cron.schedule('market-sources-nightly','20 1 * * *', $$
//               select net.http_post(
//                 url := 'https://<project>.supabase.co/functions/v1/market-sources',
//                 headers := '{"Content-Type":"application/json"}'::jsonb,
//                 body := '{"run":"due"}'::jsonb) $$);
//
// GET                      → per-source health summary
// POST {run:"due"}         → fetch every source whose cadence is due
// POST {run:"all"}         → fetch everything active
// POST {run:"gamrealty"}   → one source
// POST {run:"x", dry:true} → parse but write nothing; returns samples,
//                            which is how you tune a selector from the
//                            console without redeploying
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UA = 'MyKundaMarketIndex/1.0 (+https://mykunda.com; internal market research)'
const CRAWL_DELAY_MS = 1600      // between requests to the same host
const MAX_PAGES = 8
const TIMEOUT_MS = 20000
const MIN_CONFIDENCE = 0.5       // below this a row is logged, not stored

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* ---------- fetching, politely ---------- */
const robotsCache = new Map<string, string[]>()

async function disallowedPaths(host: string): Promise<string[]> {
  if (robotsCache.has(host)) return robotsCache.get(host)!
  let rules: string[] = []
  try {
    const r = await fetch(`https://${host}/robots.txt`, {
      headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000),
    })
    if (r.ok) {
      const txt = await r.text()
      let applies = false
      for (const line of txt.split('\n')) {
        const l = line.trim().toLowerCase()
        if (l.startsWith('user-agent:')) applies = l.includes('*') || l.includes('mykunda')
        else if (applies && l.startsWith('disallow:')) {
          const p = line.split(':').slice(1).join(':').trim()
          if (p) rules.push(p)
        }
      }
    }
  } catch (_e) { /* no robots.txt reachable — treat as open, but stay slow */ }
  robotsCache.set(host, rules)
  return rules
}

function robotsAllows(rules: string[], url: string): boolean {
  try {
    const path = new URL(url).pathname
    return !rules.some((r) => r === '/' || (r.length > 1 && path.startsWith(r)))
  } catch { return false }
}

async function getHtml(url: string): Promise<{ html: string; status: number }> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const html = r.ok ? await r.text() : ''
  return { html, status: r.status }
}

/* ---------- normalising ---------- */
const strip = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#8217;|&rsquo;/g, "'").replace(/\s+/g, ' ').trim()

const SYMBOL: Record<string, string> = {
  'D': 'GMD', 'GMD': 'GMD', 'DALASI': 'GMD',
  '$': 'USD', 'USD': 'USD', 'US$': 'USD',
  '€': 'EUR', 'EUR': 'EUR', '£': 'GBP', 'GBP': 'GBP',
}

function parseNumber(raw: string): number | null {
  // 1.250.000 · 1,250,000 · 1250000 · 138.000 — thousands separators only,
  // because no listing in this market is priced with real decimals.
  const cleaned = raw.replace(/[^0-9.,]/g, '')
  if (!cleaned) return null
  const digits = cleaned.replace(/[.,]/g, '')
  const n = parseInt(digits, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function detectKind(text: string): 'sale' | 'rent' {
  return /\b(for rent|to let|rental|rent(?:ing)?\b|per month|\/month|p\/m|monthly)\b/i.test(text)
    ? 'rent' : 'sale'
}

function detectCategory(text: string): string {
  const t = text.toLowerCase()
  if (/\b(plot|land|acre|hectare|bare land|building plot)\b/.test(t)) return 'land'
  if (/\bvilla\b/.test(t)) return 'villa'
  if (/\b(apartment|flat|studio|penthouse)\b/.test(t)) return 'apartment'
  if (/\btown\s?house\b/.test(t)) return 'townhouse'
  if (/\bcompound\b/.test(t)) return 'compound'
  if (/\b(commercial|office|shop|warehouse|factory|hotel|restaurant)\b/.test(t)) return 'commercial'
  if (/\b(house|home|bungalow|duplex)\b/.test(t)) return 'house'
  return 'house'
}

type Alias = { alias: string; area: string; region: string }
function matchArea(text: string, aliases: Alias[]) {
  const t = text.toLowerCase()
  for (const a of aliases) if (t.includes(a.alias)) return a   // pre-sorted longest first
  return null
}

async function fxToUsd(client: ReturnType<typeof sb>) {
  const { data } = await client.from('fx_rates')
    .select('*').order('as_at', { ascending: false }).limit(1).maybeSingle()
  const eurGmd = data?.eur_gmd ?? 78, usdGmd = data?.usd_gmd ?? 72, gbpGmd = data?.gbp_gmd ?? 91
  return (v: number, ccy: string) => {
    if (ccy === 'USD') return v
    if (ccy === 'GMD') return v / usdGmd
    if (ccy === 'EUR') return v * (eurGmd / usdGmd)
    if (ccy === 'GBP') return v * (gbpGmd / usdGmd)
    return v
  }
}

/* ---------- the generic HTML adapter ----------
   Config-driven on purpose: when a portal redesigns, you fix a regex in
   the console and press "Test", instead of waiting for a redeploy. */
type Parsed = {
  external_id: string; url: string | null; title: string | null
  kind: string; category: string; area: string | null; region: string | null
  price_usd: number | null; price_raw: string | null; currency: string | null
  sqm: number | null; beds: number | null; confidence: number
}

function parseBlock(block: string, cfg: any, aliases: Alias[], toUsd: (v: number, c: string) => number, base: string): Parsed | null {
  const f = cfg.fields || {}
  const text = strip(block)
  if (text.length < 12) return null

  const pick = (pattern: string, group = 1): string | null => {
    if (!pattern) return null
    try {
      const m = block.match(new RegExp(pattern, 'i')) || text.match(new RegExp(pattern, 'i'))
      return m && m[group] ? m[group] : null
    } catch { return null }
  }

  let url = pick(f.url)
  if (url && url.startsWith('/')) { try { url = new URL(url, base).href } catch { /* keep as is */ } }
  const title = f.title ? strip(pick(f.title) || '') : text.slice(0, 120)

  // price: group 1 is the symbol, group 2 the number
  let price: number | null = null, ccy: string | null = null, priceRaw: string | null = null
  if (f.price) {
    try {
      const m = text.match(new RegExp(f.price, 'i'))
      if (m) {
        priceRaw = m[0]
        ccy = SYMBOL[(m[1] || '').toUpperCase().trim()] || null
        price = parseNumber(m[2] ?? m[1] ?? '')
      }
    } catch { /* bad regex — leaves price null, which the score punishes */ }
  }
  // A dalasi figure under 5,000 is a fee or a typo, not a property.
  if (price && ccy === 'GMD' && price < 5000) price = null
  if (price && ccy !== 'GMD' && price < 300) price = null

  const sqmRaw = f.sqm ? pick(f.sqm) : null
  const sqm = sqmRaw ? parseNumber(sqmRaw) : null
  const bedsRaw = f.beds ? pick(f.beds) : null
  const beds = bedsRaw ? parseInt(bedsRaw, 10) : null

  const haystack = `${title} ${url || ''} ${text}`
  const hit = matchArea(haystack, aliases)
  const kind = cfg.kind && cfg.kind !== 'auto' ? cfg.kind : detectKind(haystack)
  const category = cfg.category && cfg.category !== 'auto' ? cfg.category : detectCategory(haystack)

  let confidence = 0
  if (price) confidence += 0.40
  if (ccy) confidence += 0.10
  if (hit) confidence += 0.25
  if (sqm && sqm >= 20 && sqm <= 100000) confidence += 0.15
  if (url) confidence += 0.10

  const external_id = url ? url.replace(/[?#].*$/, '').slice(-160)
    : (title || text).slice(0, 120)

  return {
    external_id, url, title: title || null, kind, category,
    area: hit?.area ?? null, region: hit?.region ?? null,
    price_usd: price && ccy ? Math.round(toUsd(price, ccy)) : (price ? Math.round(toUsd(price, 'GMD')) : null),
    price_raw: priceRaw, currency: ccy,
    sqm: sqm && sqm >= 20 && sqm <= 100000 ? sqm : null,
    beds: beds && beds > 0 && beds < 30 ? beds : null,
    confidence: Math.min(1, +confidence.toFixed(2)),
  }
}

async function runHtmlSource(client: ReturnType<typeof sb>, src: any, aliases: Alias[], dry: boolean) {
  const cfg = src.parse || {}
  const pages = Math.min(cfg.pages || 1, MAX_PAGES)
  const urls: string[] = []
  const templates: string[] = cfg.list || (src.url ? [src.url] : [])
  for (const t of templates) {
    if (t.includes('{page}')) for (let p = 1; p <= pages; p++) urls.push(t.replace('{page}', String(p)))
    else urls.push(t)
  }
  if (!urls.length) throw new Error('no list url configured')

  const host = src.host || new URL(urls[0]).host
  const rules = await disallowedPaths(host)
  const blocked = urls.filter((u) => !robotsAllows(rules, u))
  if (blocked.length === urls.length) {
    await client.from('market_sources').update({ robots_ok: false }).eq('key', src.key)
    throw new Error('robots_disallow')
  }
  await client.from('market_sources').update({ robots_ok: true }).eq('key', src.key)

  const toUsd = await fxToUsd(client)
  const seen: Parsed[] = []
  const rejected: any[] = []
  let status = 0

  for (const u of urls) {
    if (!robotsAllows(rules, u)) continue
    const got = await getHtml(u)
    status = got.status
    if (!got.html) { await sleep(CRAWL_DELAY_MS); continue }

    let blocks: string[] = []
    if (cfg.item) {
      try { blocks = got.html.match(new RegExp(cfg.item, 'gi')) || [] } catch { blocks = [] }
    }
    // No item pattern (or it matched nothing): fall back to anchor blocks,
    // which is crude but usually still finds prices.
    if (!blocks.length) blocks = got.html.match(/<a[\s\S]{40,1400}?<\/a>/gi) || []

    for (const b of blocks) {
      const row = parseBlock(b, cfg, aliases, toUsd, u)
      if (!row) continue
      if (row.confidence < MIN_CONFIDENCE || !row.price_usd) {
        if (rejected.length < 5) rejected.push({ confidence: row.confidence, text: strip(b).slice(0, 240) })
        continue
      }
      if (!seen.some((s) => s.external_id === row.external_id)) seen.push(row)
    }
    await sleep(CRAWL_DELAY_MS)
  }

  if (dry) return { status, seen: seen.length, sample: seen.slice(0, 8), rejected, isNew: 0, updated: 0 }

  const today = new Date().toISOString().slice(0, 10)
  let isNew = 0, updated = 0
  for (const row of seen) {
    const { data: existing } = await client.from('external_listings')
      .select('id, price_usd').eq('source_key', src.key).eq('external_id', row.external_id).maybeSingle()

    if (existing) {
      await client.from('external_listings').update({
        ...row, last_seen: today, delisted_at: null, status: 'active',
      }).eq('id', existing.id)
      updated++
    } else {
      await client.from('external_listings').insert({
        source_key: src.key, ...row, first_seen: today, last_seen: today, raw: null,
      })
      isNew++
    }
  }

  // Anything this source stopped carrying is gone from the market, not
  // gone from history: it stays, dated, so past months don't change.
  if (seen.length > 3) {
    await client.from('external_listings')
      .update({ delisted_at: today, status: 'delisted' })
      .eq('source_key', src.key).eq('status', 'active').lt('last_seen', today)
  }

  return { status, seen: seen.length, sample: seen.slice(0, 5), rejected, isNew, updated }
}

/* ---------- official series ---------- */
const monthStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)

async function runCbg(client: ReturnType<typeof sb>, dry: boolean) {
  const got = await getHtml('https://www.cbg.gm/')
  const text = strip(got.html)
  const out: any[] = []
  const m = new Date()

  const usd = text.match(/USD\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i)
  const eur = text.match(/EUR\s*:?\s*([0-9]+(?:\.[0-9]+)?)/i)
  const policy = text.match(/(?:monetary policy rate|MPR)\D{0,30}([0-9]{1,2}(?:\.[0-9]+)?)\s*%/i)
  const tbill = text.match(/91[\s-]?day\D{0,40}([0-9]{1,2}(?:\.[0-9]+)?)\s*%/i)

  if (usd) out.push({ series: 'usd_gmd', value: +usd[1], unit: 'GMD per USD' })
  if (eur) out.push({ series: 'eur_gmd', value: +eur[1], unit: 'GMD per EUR' })
  if (policy) out.push({ series: 'policy_rate', value: +policy[1], unit: '%' })
  if (tbill) out.push({ series: 'tbill_91', value: +tbill[1], unit: '%' })
  if (!out.length) throw new Error('cbg_unparseable')

  if (!dry) {
    for (const o of out) {
      await client.from('market_macro').upsert({
        month: monthStart(m), ...o, source: 'Central Bank of The Gambia', source_url: 'https://www.cbg.gm/',
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'month,series' })
    }
  }
  return { status: got.status, seen: out.length, sample: out, rejected: [], isNew: out.length, updated: 0 }
}

async function runGbos(client: ReturnType<typeof sb>, dry: boolean) {
  const got = await getHtml('https://www.gbos.gov.gm/cpi.php')
  const text = strip(got.html)
  const out: any[] = []

  // "The CPI for March 2026 stood at 179.52" — and variants around it.
  const idx = text.match(/(?:CPI|consumer price index)[^.]{0,120}?([12][0-9]{2}\.[0-9]{1,2})/i)
  const infl = text.match(/inflation\s*rate[^.]{0,80}?([0-9]{1,2}\.[0-9]{1,2})\s*(?:percent|%)/i)
  const when = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20[2-9][0-9])\b/i)

  let month = monthStart(new Date())
  if (when) {
    const d = new Date(`${when[1]} 1, ${when[2]} UTC`)
    if (!isNaN(d.getTime())) month = monthStart(d)
  }
  if (idx) out.push({ series: 'cpi_all', value: +idx[1], unit: 'index 2020M1=100' })
  if (infl) out.push({ series: 'inflation_yoy', value: +infl[1], unit: '%' })
  if (!out.length) throw new Error('gbos_unparseable — enter CPI by hand in the console')

  if (!dry) {
    for (const o of out) {
      await client.from('market_macro').upsert({
        month, ...o, source: 'Gambia Bureau of Statistics', source_url: 'https://www.gbos.gov.gm/cpi.php',
        fetched_at: new Date().toISOString(),
      }, { onConflict: 'month,series' })
    }
  }
  return { status: got.status, seen: out.length, sample: out, rejected: [], isNew: out.length, updated: 0 }
}

/* ---------- cadence ---------- */
function isDue(src: any): boolean {
  if (src.adapter === 'manual') return false
  if (!src.last_ok_at) return true
  const age = Date.now() - new Date(src.last_ok_at).getTime()
  if (src.cadence === 'daily') return age > 20 * 3600e3
  if (src.cadence === 'weekly') return age > 6.5 * 86400e3
  if (src.cadence === 'monthly') return age > 27 * 86400e3
  return false
}

/* ---------- entry ---------- */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const headers = { ...cors, 'Content-Type': 'application/json' }
  const client = sb()

  if (req.method === 'GET') {
    const { data: sources } = await client.from('market_sources')
      .select('key,name,kind,trust,active,cadence,adapter,last_ok_at,last_error,robots_ok').order('sort')
    const { data: runs } = await client.from('source_fetch_runs')
      .select('*').order('started_at', { ascending: false }).limit(30)
    return new Response(JSON.stringify({ sources, runs }), { headers })
  }

  let body: any = {}
  try { body = await req.json() } catch { /* empty body means run:"due" */ }
  const which = body.run || 'due'
  const dry = !!body.dry

  const { data: aliasRows } = await client.from('market_area_alias').select('*')
  const aliases: Alias[] = (aliasRows || []).sort((a, b) => b.alias.length - a.alias.length)

  let q = client.from('market_sources').select('*').eq('active', true).order('sort')
  if (which !== 'due' && which !== 'all') q = q.eq('key', which)
  const { data: sources } = await q
  if (!sources?.length) {
    return new Response(JSON.stringify({ ok: false, error: 'no matching source' }), { status: 404, headers })
  }

  const results: any[] = []
  for (const src of sources) {
    if (which === 'due' && !isDue(src)) continue
    if (src.adapter === 'manual' && which !== src.key) continue

    const started = new Date().toISOString()
    let run: any = null, err: string | null = null
    try {
      if (src.adapter === 'cbg') run = await runCbg(client, dry)
      else if (src.adapter === 'gbos') run = await runGbos(client, dry)
      else if (src.adapter === 'manual') { run = { status: 0, seen: 0, sample: [], rejected: [], isNew: 0, updated: 0 } }
      else run = await runHtmlSource(client, src, aliases, dry)
    } catch (e) {
      err = String((e as Error)?.message || e)
    }

    if (!dry) {
      await client.from('source_fetch_runs').insert({
        source_key: src.key, started_at: started, finished_at: new Date().toISOString(),
        ok: !err, http_status: run?.status ?? null,
        items_seen: run?.seen ?? 0, items_new: run?.isNew ?? 0, items_updated: run?.updated ?? 0,
        items_rejected: run?.rejected?.length ?? 0, error: err,
        sample: err ? { rejected: run?.rejected ?? [] } : { parsed: run?.sample ?? [] },
      })
      await client.from('market_sources').update(
        err ? { last_error: err } : { last_ok_at: new Date().toISOString(), last_error: null },
      ).eq('key', src.key)
    }

    results.push({
      source: src.key, ok: !err, error: err,
      seen: run?.seen ?? 0, new: run?.isNew ?? 0, updated: run?.updated ?? 0,
      rejected: run?.rejected?.length ?? 0,
      sample: dry ? run?.sample ?? [] : undefined,
      rejects: dry ? run?.rejected ?? [] : undefined,
    })
  }

  // One de-dup pass over everything, then let the nightly rollup reprice.
  let deduped = 0
  if (!dry && results.some((r) => r.ok && (r.new || r.updated))) {
    const { data } = await client.rpc('market_dedup')
    deduped = typeof data === 'number' ? data : 0
  }

  return new Response(JSON.stringify({ ok: true, dry, deduped, results }), { headers })
})
