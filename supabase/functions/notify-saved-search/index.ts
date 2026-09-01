// ============================================================
//  MyKunda — Edge Function: notify-saved-search
//  Stuurt een zoeker de nieuwe advertenties die op zijn bewaarde
//  zoekopdrachten passen. Eén mail per persoon, met de zoekopdrachten
//  eronder gegroepeerd — niet één mail per zoekopdracht.
//
//  Tot 30-08-2026 verzamelde MyKunda wél zoekopdrachten en alerts, maar
//  stuurde er niets over. De knop bestond, de belofte stond in de
//  welkomstmail, en er gebeurde niets. Dit is de ontbrekende helft.
//
//  Wie krijgt er een mail:
//    · saved_searches.channel = 'email'                (per zoekopdracht aan)
//    · profiles.consent_marketing = true               (hoofdschakelaar aan)
//    · profiles.email_bounced_at is leeg               (adres doet het nog)
//    · en er is minstens één nieuwe treffer.
//  Alle vier moeten kloppen. Eén ervan uit betekent geen mail.
//
//  Wat is "nieuw": een advertentie die publiek is gegaan ná het laatste
//  bericht over die zoekopdracht (saved_searches.last_alert_at), of ná het
//  opslaan van de zoekopdracht als er nog nooit iets is gestuurd. Het moment
//  van live gaan komt uit de 'listed'-gebeurtenis die listings_price_event()
//  al schrijft — niet uit created_at, want tussen aanmaken en goedkeuren
//  zitten één tot twee werkdagen en die advertenties zou een zoekopdracht
//  van gisteren anders missen.
//
//  De matcher hieronder is een letterlijke omzetting van filtered() in
//  search.html. Wijzigt daar een filter, dan moet dat hier mee — anders mailt
//  MyKunda iets wat de zoekpagina niet zou tonen. Dat is de prijs van een
//  serverzijdige alert; de alternatieven (de zoekpagina headless draaien, of
//  het filter in SQL herbouwen) zijn allebei erger.
//
//  Deploy:  supabase functions deploy notify-saved-search --no-verify-jwt
//  Cron:    0 8 * * *  →  select public.run_saved_search_alerts()
//  Secrets: RESEND_API_KEY, FROM_EMAIL, NOTIFY_SHARED_KEY
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isReservedTestAddress, savedSearchAlertEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY     = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";

const SITE       = "https://mykunda.com";
const PHOTO_BASE = SUPABASE_URL.replace(/\/+$/, "") + "/storage/v1/object/public/listing-photos/";

/* Een mail is een uitnodiging, geen catalogus. */
const MAX_PER_SEARCH  = 4;
const MAX_SEARCHES    = 4;
const MAX_USERS_PER_RUN = 200;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
// Zelfde poort als de andere interne functies.
function toegestaan(req: Request): boolean {
  if (!SHARED_KEY) return true;
  return sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY);
}

/* ============================================================
   De matcher — één op één met filtered() in search.html.
   ============================================================ */

/* Uit search.html: banden in meters, en de terugval voor advertenties zonder
   gemeten afstand. */
const BEACH_BAND_MAX: Record<string, number> = { beachfront: 150, walking: 1200, near: 5000 };
function listingSeaMetres(p: any): number {
  if (typeof p.beach_m === "number") return p.beach_m;
  const b = (p.cat === "land" ? p.land_beach : p.beach) || "inland";
  return b === "beachfront" ? 120 : (b === "walking" ? 900 : 9999);
}
function matchBeachBand(p: any, band: string): boolean {
  const m = listingSeaMetres(p);
  return band === "inland" ? m > BEACH_BAND_MAX.near : m <= (BEACH_BAND_MAX[band] ?? Infinity);
}
/* MK_DOC_TYPES uit app.js. listings.doc_type bewaart het LABEL, niet de code —
   daarom vergelijkt search.html met de labelkant van deze tabel, en wij ook. */
const MK_DOC_TYPE_BY_CODE: Record<string, string> = {
  freehold: "Freehold (with title deed)",
  leasehold: "Leasehold",
  customary: "Customary / family land",
  sporting: "Sporting lease",
};
function matchServ(p: any, code: string): boolean {
  switch (code) {
    case "nawec_water":  return p.water === "nawec" || p.water === "both";
    case "backup_power": return p.power === "solar" || p.power === "generator" || p.power === "both";
    case "plot_power":   return p.electricity === "present";
    case "plot_water":   return p.land_water === "borehole" || p.land_water === "nawec";
    case "tarmac":       return p.road === "tarmac";
    case "fenced":       return p.fencing === "partial" || p.fencing === "full";
    case "lowflood":     return p.flood_risk !== "high";
    default: return true;
  }
}
function matchAvailableFrom(p: any, val: string): boolean {
  if (!p.available_from) return val === "now";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const avail = new Date(p.available_from + "T00:00:00");
  if (val === "now") return avail <= today;
  if (val === "month")   { const d = new Date(today); d.setDate(d.getDate() + 30); return avail <= d; }
  if (val === "quarter") { const d = new Date(today); d.setDate(d.getDate() + 90); return avail <= d; }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return avail <= new Date(val + "T00:00:00");
  return true;
}

/* Databaserij → de kaartvorm waar de filters op werken (dbListingToCard in
   supabase.js). Let op twee dingen die bewust worden overgenomen in plaats van
   gerepareerd, omdat de alert hetzelfde moet zeggen als de zoekpagina:
     · er is geen kolom listings.beach, dus p.beach is altijd leeg en valt
       terug op 'inland' — precies zoals in de browser;
     · isNew staat altijd aan, dus het kenmerk "New" filtert niets weg. */
function rowToCard(r: any) {
  const photos = (r.listing_media || []).filter((m: any) => !m.is_document)
    .sort((a: any, b: any) => (a.sort ?? 0) - (b.sort ?? 0));
  const seg = r.segment || "residential";
  return {
    /* type is de naam die de matcher gebruikt (zoals op de zoekpagina); kind is
       de naam die het e-mailsjabloon gebruikt (AlertListing). Dezelfde waarde
       onder twee namen, want de kaart gaat ongewijzigd de mail in — zonder
       kind bleef het achtervoegsel achter een huurprijs stilletjes weg. */
    id: r.id, cat: r.category, type: r.kind, kind: r.kind, segment: seg,
    title: r.title || "", street: r.street || "", area: r.area || "",
    price: Number(r.price) || 0,
    price_period: r.price_period || null,
    beds: r.beds || 0, baths: r.baths || 0, sqm: r.sqm || 0, plot: r.plot_sqm || 0,
    features: r.features || [], tag: (r.features && r.features[0]) || "",
    isNew: true,
    verified: !!r.is_verified_title,
    condition: r.condition || "good",
    furnished: r.furnished || "unfurnished",
    security: r.security || "none",
    beach: "inland",
    land_beach: r.land_beach || "inland",
    beach_m: typeof r.beach_m === "number" ? r.beach_m : null,
    water: r.water || "nawec", power: r.power || "no", road: r.road || "laterite",
    electricity: r.electricity || "none", land_water: r.land_water || "none",
    fencing: r.fencing || "none", flood_risk: r.flood_risk || "no",
    doc_type: r.doc_type || "", year_built: r.year_built || null,
    available_from: r.available_from || null,
    units: r.units || 0, parking: r.parking_spaces || 0,
    current_use: r.current_use || "", fit_out: r.fit_out || "",
    img: photos.length ? PHOTO_BASE + String(photos[0].storage_path).split("/").map(encodeURIComponent).join("/") : "",
  };
}

/* Het maandequivalent, letterlijk mkMonthlyPrice() uit app.js. Een budget is
   per maand ingevuld, dus wordt er per maand vergeleken; een huur per nacht,
   week of jaar wordt daarvoor omgerekend. Verandert dit hier of daar, dan MOET
   het allebei mee — een alert die iets belooft wat de zoekpagina niet toont is
   erger dan geen alert. */
const PRICE_PER_YEAR: Record<string, number> = { night: 365, week: 52, month: 12, year: 1 };
function maandPrijs(p: any): number {
  const v = Number(p && p.price) || 0;
  if (!p || p.type !== "rent") return v;
  return v * (PRICE_PER_YEAR[p.price_period] || 12) / 12;
}

/* De volgorde en de vergelijkingen zijn die van filtered() in search.html. */
function isLandSearch(f: any): boolean {
  return Array.isArray(f.cats) && f.cats.length === 1 && f.cats[0] === "land";
}
function matches(p: any, f: any): boolean {
  if ((p.segment || "residential") !== (f.seg || "residential")) return false;
  if (f.type && f.type !== "any" && p.type !== f.type) return false;
  if (f.q && String(f.q).trim()) {
    const q = String(f.q).trim().toLowerCase();
    if (!((p.area + " " + p.street + " " + p.title).toLowerCase().includes(q))) return false;
  }
  if (f.pMin && !(maandPrijs(p) >= +f.pMin)) return false;
  if (f.pMax && !(maandPrijs(p) <= +f.pMax)) return false;
  if (f.beds && !(p.beds >= f.beds)) return false;
  if (f.furn === "unfurnished") {
    const t = ((p.tag || "") + " " + (p.features || []).join(" ")).toLowerCase();
    if (!(p.furnished ? p.furnished === "unfurnished" : !/furnished/.test(t))) return false;
  }
  if (Array.isArray(f.cats) && f.cats.length && !f.cats.includes(p.cat)) return false;
  if (f.cond && f.cond !== "any" && p.condition !== f.cond) return false;
  if (f.beachP && f.beachP !== "any" && !matchBeachBand(p, f.beachP)) return false;
  const land = isLandSearch(f);
  if (f.baths && !land && !((p.baths || 0) >= f.baths)) return false;
  if (f.sqm && !land && !((p.sqm || 0) >= +f.sqm)) return false;
  if (f.plot && land && !((p.plot || 0) >= +f.plot)) return false;
  if (f.plotmax && land && !((p.plot || 0) <= +f.plotmax)) return false;
  if (f.year && !land && !((p.year_built || 0) >= +f.year)) return false;
  if (f.units && !((p.units || 0) >= +f.units)) return false;
  if (f.parking && !((p.parking || 0) >= +f.parking)) return false;
  if (f.fitout && p.fit_out !== f.fitout) return false;
  if (f.use && p.current_use !== f.use) return false;
  if (Array.isArray(f.titles) && f.titles.length
      && !f.titles.some((t: string) => MK_DOC_TYPE_BY_CODE[t] === p.doc_type)) return false;
  if (f.verified && !p.verified) return false;
  if (Array.isArray(f.serv) && f.serv.length
      && !f.serv.every((sv: string) => matchServ(p, sv))) return false;
  if (f.from && !matchAvailableFrom(p, f.from)) return false;
  for (const x of (f.feats || [])) {
    const tag = (p.tag || "").toLowerCase();
    const fs: string[] = p.features || [];
    let ok: boolean;
    if (x === "new") ok = !!p.isNew;
    else if (x === "pool") ok = /pool/i.test(p.tag || "") || fs.some((y) => /pool/i.test(y));
    else if (x === "Furnished") ok = p.furnished === "furnished" || p.furnished === "semi" || tag.includes("furnished");
    else if (x === "Gated") ok = p.security === "gated" || p.security === "wall" || tag.includes("gated");
    else if (x === "Beachfront") ok = p.beach === "beachfront" || p.land_beach === "beachfront" || tag.includes("beachfront");
    else ok = tag.includes(String(x).toLowerCase()) || fs.some((y) => String(y).toLowerCase().includes(String(x).toLowerCase()));
    if (!ok) return false;
  }
  return true;
}

/* Naam en link van een zoekopdracht — dezelfde regels als dashboard.html, zodat
   de mail hem net zo noemt als het scherm. */
function searchName(row: any): string {
  if (row.label) return String(row.label);
  const f = row.filters || {};
  const bits = [f.seg === "commercial" ? "Commercial" : "Homes"];
  bits.push(f.type === "rent" ? "to rent" : (f.type === "sale" ? "for sale" : "any deal"));
  if (f.q) bits.push("in " + f.q);
  else if (row.area) bits.push("in " + row.area);
  return bits.join(" ");
}
function searchUrl(row: any): string {
  const f = row.filters || {};
  const u = f.url && String(f.url).includes("search.html") ? String(f.url) : "search.html";
  return SITE + "/" + u.replace(/^\/+/, "");
}

/* ============================================================
   Versturen en loggen
   ============================================================ */
async function sendEmail(o: { to: string; subject: string; html: string }) {
  if (isReservedTestAddress(o.to)) throw new Error(`reserved test domain, not sent: ${o.to}`);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL, to: [o.to], subject: o.subject, html: o.html, text: toText(o.html),
      /* Dit is de enige mail van MyKunda die je puur voor je plezier krijgt, dus
         hij hoort een afmeldkop te hebben. De link is dezelfde als onderaan de
         mail en zet zowel de toestemming als elke losse zoekopdracht uit. */
      headers: {
        "List-Unsubscribe": `<${SITE}/dashboard.html?alerts=off>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return await r.json();
}

async function logAlert(db: any, o: { recipient: string; subject: string; id: string | null; payload: Record<string, unknown> }) {
  try {
    await db.from("email_events").insert({
      resend_email_id: o.id, event_type: "saved_search_alert",
      recipient: o.recipient, subject: o.subject, payload: o.payload,
    });
  } catch (e) {
    console.error("email_events loggen faalde (de mail is wél verstuurd):", String((e as Error)?.message ?? e));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!toegestaan(req)) return json({ ok: false, error: "forbidden" }, 403);

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    /* dry_run laat de hele molen draaien maar verstuurt niets en stempelt
       niets. Handig om te zien wat er zou uitgaan. */
    const dryRun = (body as { dry_run?: boolean }).dry_run === true;

    // ---- 1. zoekopdrachten die een mail mogen krijgen ----
    const { data: searches, error: sErr } = await db
      .from("saved_searches")
      .select("id, user_id, label, filters, area, channel, created_at, last_alert_at, profiles!inner(id, email, full_name, consent_marketing, email_bounced_at)")
      .eq("channel", "email");
    if (sErr) throw sErr;

    const eligible = (searches ?? []).filter((s: any) => {
      const p = s.profiles;
      return p && p.email && p.consent_marketing === true && !p.email_bounced_at && !isReservedTestAddress(p.email);
    });
    if (!eligible.length) return json({ ok: true, searches: 0, users: 0, sent: 0 });

    // ---- 2. het huidige aanbod, één keer ----
    const { data: rows, error: lErr } = await db
      .from("listings")
      .select("id,title,area,street,price,price_period,kind,category,segment,beds,baths,sqm,plot_sqm,features,condition,furnished,security,land_beach,beach_m,water,power,electricity,land_water,road,fencing,flood_risk,doc_type,year_built,available_from,units,parking_spaces,current_use,fit_out,is_verified_title,created_at,listing_media(storage_path,is_document,sort)")
      .in("status", ["active", "under_offer"]);
    if (lErr) throw lErr;
    if (!rows || !rows.length) return json({ ok: true, searches: eligible.length, users: 0, sent: 0, note: "geen actief aanbod" });

    /* Wanneer ging een advertentie live? De trigger listings_price_event()
       schrijft daar een 'listed'-rij voor. Ontbreekt die (oudere rij), dan is
       created_at de beste schatting die we hebben. */
    const { data: listedRows } = await db
      .from("listing_price_events")
      .select("listing_id, occurred_at")
      .eq("event", "listed")
      .in("listing_id", rows.map((r: any) => r.id));
    const liveSince: Record<string, string> = {};
    (listedRows ?? []).forEach((e: any) => {
      const cur = liveSince[e.listing_id];
      if (!cur || e.occurred_at < cur) liveSince[e.listing_id] = e.occurred_at;
    });

    const cards = rows.map((r: any) => ({ card: rowToCard(r), live: liveSince[r.id] || r.created_at }));

    // ---- 3. per zoekopdracht: wat is er nieuw sinds de vorige mail? ----
    type Bucket = {
      email: string; name: string; searchIds: string[];
      groups: { label: string; url: string; listings: any[]; more: number }[];
      total: number;
    };
    const perUser = new Map<string, Bucket>();

    for (const s of eligible) {
      const since = s.last_alert_at || s.created_at;
      const hits = cards
        .filter((c) => c.live > since && matches(c.card, s.filters || {}))
        .sort((a, b) => (a.live < b.live ? 1 : -1));
      if (!hits.length) continue;

      const u = perUser.get(s.user_id) ?? {
        email: s.profiles.email,
        name: s.profiles.full_name || "",
        searchIds: [], groups: [], total: 0,
      };
      /* Meer dan vier zoekopdrachten met treffers: de rest krijgt geen blok in
         deze mail, maar wordt ook NIET gestempeld — dan komt hij morgen alsnog
         aan de beurt in plaats van stilletjes overgeslagen te worden. */
      if (u.groups.length < MAX_SEARCHES) {
        u.groups.push({
          label: searchName(s),
          url: searchUrl(s),
          listings: hits.slice(0, MAX_PER_SEARCH).map((h) => h.card),
          more: Math.max(0, hits.length - MAX_PER_SEARCH),
        });
        u.searchIds.push(s.id);
        u.total += hits.length;
      }
      perUser.set(s.user_id, u);
    }

    const users = [...perUser.entries()].filter(([, u]) => u.groups.length).slice(0, MAX_USERS_PER_RUN);
    if (dryRun) {
      return json({
        ok: true, dry_run: true, searches: eligible.length, users: users.length,
        preview: users.map(([id, u]) => ({
          user_id: id, email: u.email, total: u.total,
          groups: u.groups.map((g) => ({ label: g.label, listings: g.listings.map((l: any) => l.title), more: g.more })),
        })),
      });
    }

    // ---- 4. versturen ----
    let sent = 0;
    const errors: string[] = [];
    for (const [userId, u] of users) {
      const subject = u.total === 1
        ? "A new property matching your saved search — MyKunda"
        : `${u.total} new properties matching your saved searches — MyKunda`;
      try {
        const res = await sendEmail({
          to: u.email, subject,
          html: savedSearchAlertEmail({ name: u.name, groups: u.groups, total: u.total }),
        });
        sent++;
        /* Pas stempelen als de mail echt weg is. Mislukt hij, dan staat deze
           zoekopdracht er morgen gewoon weer bij — liever een dag later dan
           helemaal niet. */
        await db.from("saved_searches")
          .update({ last_alert_at: new Date().toISOString() })
          .in("id", u.searchIds);
        await logAlert(db, {
          recipient: u.email, subject, id: res?.id ? String(res.id) : null,
          payload: { user_id: userId, searches: u.searchIds.length, listings: u.total },
        });
      } catch (e) {
        const msg = String((e as Error)?.message ?? e);
        errors.push(`${u.email}: ${msg}`);
        console.error("notify-saved-search:", msg);
      }
    }

    return json({ ok: errors.length === 0, searches: eligible.length, users: users.length, sent, errors },
                 errors.length ? 502 : 200);
  } catch (err) {
    console.error("notify-saved-search error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
