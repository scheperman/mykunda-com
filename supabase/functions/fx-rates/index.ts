// Supabase Edge Function: fx-rates
//
// DE ENIGE PLEK DIE EEN KOERS VASTSTELT.
// ---------------------------------------------------------------------
// De Central Bank of The Gambia publiceert dagelijks één kolom "Rate":
// dalasi per eenheid vreemde valuta. Dat is precies de vorm die we
// bewaren en teruggeven — de dalasi is de ankermunt, al het andere volgt
// er door deling uit. Nergens anders in de site of in een andere edge
// function wordt een koers bepaald, afgeleid of ingebakken.
//
//   D per 1 EUR = eur_gmd            (rechtstreeks van CBG)
//   D per 1 USD = usd_gmd            (rechtstreeks van CBG)
//   D per 1 GBP = gbp_gmd            (rechtstreeks van CBG)
//   EUR -> USD  = eur_gmd / usd_gmd  (kruiskoers, hier berekend)
//
// Deploy:   supabase functions deploy fx-rates --no-verify-jwt
// Schedule: eens per dag, op werkdagen, na publicatie door CBG
//             select cron.schedule(
//               'fx-rates-daily', '0 13 * * 1-5',
//               $$ select net.http_post(
//                    url := 'https://<project>.functions.supabase.co/fx-rates',
//                    headers := '{"Content-Type":"application/json"}'::jsonb,
//                    body := '{"refresh":true}'::jsonb
//                  ) $$
//             );
//
// GET  -> de geldende koers (publiek, 1u cache) — dit leest de site
// POST -> ophalen bij CBG, controleren, opslaan
//
// Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CBG_URL = 'https://www.cbg.gm/indicative-exchange-rates-latest'
const CBG_HOME = 'https://www.cbg.gm/'

// ECB, uitsluitend om een munt aan te vullen die CBG niet noteerde.
// Server-side, dus geen CSP in de browser. Let op: api.frankfurter.app
// stuurt sinds 2026 een 302 naar api.frankfurter.dev — die host staat
// hieronder rechtstreeks, zodat er geen omleiding aan te pas komt.
const ECB_URL = 'https://api.frankfurter.dev/v1/latest?from=EUR&to=USD,GBP'

const CURRENCIES = ['EUR', 'USD', 'GBP'] as const
type Ccy = typeof CURRENCIES[number]

// Een gepubliceerde koers die in één dag meer beweegt dan dit is vrijwel
// altijd een leesfout of een typefout op de bron, geen echte devaluatie.
const MAX_DAILY_MOVE = 0.03
// Absolute zeef — dalasi per eenheid. Alles daarbuiten is onzin.
const PLAUSIBLE: Record<Ccy, [number, number]> = {
  EUR: [50, 200], USD: [40, 180], GBP: [55, 230],
}

const COL: Record<Ccy, string> = { EUR: 'eur_gmd', USD: 'usd_gmd', GBP: 'gbp_gmd' }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function sb() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

/* ---------- CBG scraping ----------
   De pagina zet de koersen neer als een reeks "CODE 00.00". Eén kolom,
   dalasi per eenheid — gecontroleerd 27-08-2026: USD 72.7000,
   EUR 85.7400, GBP 96.3400, plus dertig andere munten.

   \b om de code heen: zonder woordgrens matcht "USD" ook in een woord als
   "USDT" of in een menu-item, en dan lees je het eerste getal dat daar
   toevallig achter staat. */
function parseRates(html: string): Partial<Record<Ccy, number>> {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/,/g, '')
  const out: Partial<Record<Ccy, number>> = {}
  for (const code of CURRENCIES) {
    const m = text.match(new RegExp('\\b' + code + '\\b\\s*:?\\s*([0-9]+(?:\\.[0-9]+)?)'))
    if (!m) continue
    const v = parseFloat(m[1])
    const [lo, hi] = PLAUSIBLE[code]
    if (v >= lo && v <= hi) out[code] = v
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
    } catch (_e) { /* volgende URL */ }
  }
  return null
}

/* ECB-kruiskoers, alleen om een ontbrekende munt aan te vullen. De dalasi
   blijft het anker: ECB's EUR->X wordt met de CBG-eurokoers omgerekend
   naar dalasi per X. Zo staat er nooit een half ECB-, half CBG-antwoord
   op het scherm. */
async function fetchECB(): Promise<Partial<Record<'USD' | 'GBP', number>> | null> {
  try {
    const r = await fetch(ECB_URL, { signal: AbortSignal.timeout(8000) })
    if (!r.ok) return null
    const d = await r.json()
    if (!d?.rates) return null
    const out: Partial<Record<'USD' | 'GBP', number>> = {}
    if (d.rates.USD > 0) out.USD = d.rates.USD
    if (d.rates.GBP > 0) out.GBP = d.rates.GBP
    return Object.keys(out).length ? out : null
  } catch (_e) { return null }
}

async function latestStored(client: ReturnType<typeof sb>) {
  const { data } = await client
    .from('fx_rates').select('*').order('as_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

/* Een handmatige override geldt voor de HELE site, niet voor één browser.
   Hij staat daarom in de database. Bestaat de tabel nog niet, dan gedraagt
   deze functie zich alsof er geen override is — zo kan deze code vooruit
   zonder dat de migratie al gedraaid heeft. */
async function activeOverride(client: ReturnType<typeof sb>) {
  try {
    const { data, error } = await client
      .from('fx_override')
      .select('eur_gmd, note, created_at')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return null
    return data && Number(data.eur_gmd) > 0 ? data : null
  } catch (_e) { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const headers = { ...cors, 'Content-Type': 'application/json' }
  const client = sb()

  /* ---------- LEZEN: dit roept de site aan ---------- */
  if (req.method === 'GET') {
    const row = await latestStored(client)
    if (!row) return new Response(JSON.stringify({ error: 'no rates stored yet' }), { status: 503, headers })

    // Dalasi per eenheid, plus waar elk getal vandaan komt.
    const gmd_per: Record<string, number> = { GMD: 1 }
    const sources: Record<string, string> = { GMD: 'anchor' }
    for (const c of CURRENCIES) {
      const v = Number((row as Record<string, unknown>)[COL[c]])
      if (v > 0) { gmd_per[c] = v; sources[c] = 'cbg' }
    }

    // CBG noteerde een munt niet: aanvullen via ECB, met de CBG-euro als
    // brug. Dit is de enige plek waar dat gebeurt, en het staat er per
    // munt bij in `sources`.
    const missing = CURRENCIES.filter((c) => !(gmd_per[c] > 0))
    if (missing.length && gmd_per.EUR > 0) {
      const ecb = await fetchECB()
      for (const c of missing) {
        const perEur = c === 'USD' ? ecb?.USD : c === 'GBP' ? ecb?.GBP : null
        if (perEur && perEur > 0) { gmd_per[c] = gmd_per.EUR / perEur; sources[c] = 'ecb-cross' }
      }
    }

    const ov = await activeOverride(client)
    if (ov) {
      // De override zet de EUROkoers. De verhouding tot dollar en pond
      // blijft die van CBG: één ingetypt getal hoort niet stilletjes ook
      // de USD/GMD- en GBP/GMD-koers te verzetten.
      const factor = Number(ov.eur_gmd) / gmd_per.EUR
      for (const c of CURRENCIES) if (gmd_per[c] > 0) gmd_per[c] = gmd_per[c] * factor
      for (const c of CURRENCIES) sources[c] = 'manual'
    }

    const stale = (Date.now() - new Date(row.as_at).getTime()) > 7 * 86400000

    return new Response(JSON.stringify({
      // De vorm waar de site op rekent: dalasi per eenheid.
      base: 'GMD',
      gmd_per,
      sources,
      as_at: row.as_at,
      source: ov ? 'manual override' : row.source,
      override: !!ov,
      override_note: ov?.note ?? null,
      stale,
      // --- Oude vorm, per 1 EUR. Blijft staan zolang er browsers met een
      // oude app.min.js in hun service-worker-cache rondlopen. Niet
      // uitbreiden; nieuwe code leest gmd_per. ---
      GMD: gmd_per.EUR > 0 ? gmd_per.EUR : null,
      USD: gmd_per.USD > 0 ? gmd_per.EUR / gmd_per.USD : null,
      GBP: gmd_per.GBP > 0 ? gmd_per.EUR / gmd_per.GBP : null,
    }), { headers: { ...headers, 'Cache-Control': 'public, max-age=3600' } })
  }

  /* ---------- SCHRIJVEN: de dagelijkse cron ---------- */
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

    // Vangrail per munt, niet alleen op de euro. Een pond dat in één dag
    // 12% verspringt is even hard bewijs van een leesfout als een euro.
    const rejected: Array<Record<string, unknown>> = []
    const accepted: Partial<Record<Ccy, number>> = {}
    for (const c of CURRENCIES) {
      const v = rates[c]
      if (!(typeof v === 'number' && v > 0)) continue
      const before = prev ? Number((prev as Record<string, unknown>)[COL[c]]) : 0
      if (before > 0) {
        const move = Math.abs(v / before - 1)
        if (move > MAX_DAILY_MOVE) {
          rejected.push({ ccy: c, proposed: v, previous: before, move_pct: +(move * 100).toFixed(2) })
          continue
        }
      }
      accepted[c] = v
    }

    if (rejected.length) {
      await client.from('fx_rate_rejects').insert(rejected.map((r) => ({
        as_at,
        eur_gmd: r.ccy === 'EUR' ? r.proposed : (accepted.EUR ?? Number(prev?.eur_gmd) ?? 0),
        previous_eur_gmd: r.previous,
        move_pct: r.move_pct,
        source: `${url} (${r.ccy})`,
      })))
    }

    // De euro is het ijkpunt van de site. Wordt die geweigerd, dan
    // verandert er niets — nooit half doorvoeren.
    if (!(typeof accepted.EUR === 'number' && accepted.EUR > 0)) {
      return new Response(JSON.stringify({
        ok: false, reason: 'eur_rejected_or_missing', rejected,
        kept: prev?.eur_gmd ?? null,
        note: 'Gelogd ter beoordeling. Bevestig handmatig in admin als dit echt zo is.',
      }), { status: 409, headers })
    }

    // Een munt die vandaag ontbreekt of geweigerd is: de laatste goede
    // waarde meenemen in plaats van null wegschrijven. Zo'n null werd
    // stroomafwaarts een deling door nul en daarmee een halve koers.
    const row = {
      as_at,
      eur_gmd: accepted.EUR,
      usd_gmd: accepted.USD ?? prev?.usd_gmd ?? null,
      gbp_gmd: accepted.GBP ?? prev?.gbp_gmd ?? null,
      source: 'Central Bank of The Gambia',
      source_url: url,
      fetched_at: new Date().toISOString(),
    }

    if (prev && prev.as_at === as_at &&
        Number(prev.eur_gmd) === Number(row.eur_gmd) &&
        Number(prev.usd_gmd) === Number(row.usd_gmd) &&
        Number(prev.gbp_gmd) === Number(row.gbp_gmd)) {
      return new Response(JSON.stringify({ ok: true, unchanged: true, as_at, ...row }), { headers })
    }

    const { error } = await client.from('fx_rates').upsert(row, { onConflict: 'as_at' })
    if (error) throw error

    return new Response(JSON.stringify({
      ok: true, ...row,
      carried_forward: { usd: accepted.USD == null, gbp: accepted.GBP == null },
      rejected,
    }), { headers })
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), { status: 500, headers })
  }
})
