// Supabase Edge Function: fx-rates
//
// Pulls the Central Bank of The Gambia daily valuation rates (cbg.gm) — the
// official published rate — and stores them. GMD is not in the ECB feed that
// frankfurter.app uses, so this is the only trustworthy automatic source.
//
// Deploy:   supabase functions deploy fx-rates --no-verify-jwt
// Schedule: once a day, on weekdays, after CBG publishes (they post in the
//           morning Banjul time; 13:00 UTC is a safe slot)
//             select cron.schedule(
//               'fx-rates-daily', '0 13 * * 1-5',
//               $$ select net.http_post(
//                    url := 'https://<project>.functions.supabase.co/fx-rates',
//                    headers := '{"Content-Type":"application/json"}'::jsonb,
//                    body := '{"refresh":true}'::jsonb
//                  ) $$
//             );
//
// GET  → latest stored rates (public, cached 1h) — this is what the site reads
// POST → fetch from CBG, validate, store, return the result
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CBG_URL = 'https://www.cbg.gm/indicative-exchange-rates-latest'
const CBG_HOME = 'https://www.cbg.gm/'

// A published rate that moves more than this in one day is almost always a
// parse error or a typo on the source page, not a real devaluation.
const MAX_DAILY_MOVE = 0.03
// Absolute sanity envelope — dalasi per euro. Anything outside is nonsense.
const PLAUSIBLE = { EUR: [50, 200], USD: [40, 180], GBP: [55, 230] }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

/* ---------- CBG scraping ----------
   The page renders the rates as a run of "CODE: 00.00" pairs. We read the
   dalasi-per-unit value for the three currencies the site shows. */
function parseRates(html: string): Record<string, number> {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/,/g, '')
  const out: Record<string, number> = {}
  for (const code of ['USD', 'EUR', 'GBP']) {
    const m = text.match(new RegExp(code + '\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)'))
    if (m) {
      const v = parseFloat(m[1])
      const [lo, hi] = PLAUSIBLE[code as keyof typeof PLAUSIBLE]
      if (v >= lo && v <= hi) out[code] = v
    }
  }
  return out
}

function parseAsAt(html: string): string | null {
  const text = html.replace(/<[^>]+>/g, ' ')
  // "Daily Valuation Rates - As at July 25, 2026"
  const m = text.match(/As\s+at\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/)
  if (!m) return null
  const d = new Date(m[1].replace(',', ''))
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

async function fetchCBG() {
  for (const url of [CBG_URL, CBG_HOME]) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': 'MyKunda/1.0 (+https://mykunda.com)' },
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) continue
      const html = await r.text()
      const rates = parseRates(html)
      if (rates.EUR) return { rates, asAt: parseAsAt(html), url }
    } catch (_e) { /* try the next URL */ }
  }
  return null
}

async function latestStored(client: ReturnType<typeof sb>) {
  const { data } = await client
    .from('fx_rates').select('*').order('as_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const headers = { ...cors, 'Content-Type': 'application/json' }
  const client = sb()

  /* ---------- READ: what the website calls ---------- */
  if (req.method === 'GET') {
    const row = await latestStored(client)
    if (!row) return new Response(JSON.stringify({ error: 'no rates stored yet' }), { status: 503, headers })
    return new Response(JSON.stringify({
      base: 'EUR',
      // dalasi (and dollars/pounds) per 1 euro
      GMD: row.eur_gmd,
      USD: row.eur_gmd / row.usd_gmd,
      GBP: row.eur_gmd / row.gbp_gmd,
      as_at: row.as_at,
      source: row.source,
      stale: (Date.now() - new Date(row.as_at).getTime()) > 7 * 86400000,
    }), { headers: { ...headers, 'Cache-Control': 'public, max-age=300' } })
  }

  /* ---------- WRITE: the daily cron ---------- */
  try {
    const prev = await latestStored(client)
    const got = await fetchCBG()

    if (!got) {
      return new Response(JSON.stringify({
        ok: false, reason: 'cbg_unreachable_or_unparseable', kept: prev?.as_at ?? null,
      }), { status: 502, headers })
    }

    const { rates, asAt, url } = got
    const as_at = asAt || new Date().toISOString().slice(0, 10)

    // Guardrail: refuse an implausible jump and keep the last good value.
    if (prev?.eur_gmd) {
      const move = Math.abs(rates.EUR / prev.eur_gmd - 1)
      if (move > MAX_DAILY_MOVE) {
        await client.from('fx_rate_rejects').insert({
          as_at, eur_gmd: rates.EUR, previous_eur_gmd: prev.eur_gmd,
          move_pct: +(move * 100).toFixed(2), source: url,
        })
        return new Response(JSON.stringify({
          ok: false, reason: 'move_exceeds_tolerance',
          move_pct: +(move * 100).toFixed(2), proposed: rates.EUR,
          kept: prev.eur_gmd, note: 'Logged for review. Confirm manually in admin if this is real.',
        }), { status: 409, headers })
      }
    }

    // Same publication date and same value? Nothing to do.
    if (prev && prev.as_at === as_at && prev.eur_gmd === rates.EUR) {
      return new Response(JSON.stringify({ ok: true, unchanged: true, as_at, eur_gmd: rates.EUR }), { headers })
    }

    const row = {
      as_at,
      eur_gmd: rates.EUR,
      usd_gmd: rates.USD ?? null,
      gbp_gmd: rates.GBP ?? null,
      source: 'Central Bank of The Gambia',
      source_url: url,
      fetched_at: new Date().toISOString(),
    }
    const { error } = await client.from('fx_rates').upsert(row, { onConflict: 'as_at' })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, ...row }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500, headers })
  }
})
