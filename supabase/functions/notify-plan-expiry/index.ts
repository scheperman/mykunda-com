// ============================================================
//  MyKunda — Edge Function: notify-plan-expiry
//  Meldt een aanbieder dat een Boost of een Verified-periode op zijn
//  advertentie afloopt, en later dat hij afgelopen is.
//
//  Tot 30-08-2026 ging hier niets over. apply_paid_plan() zette
//  listings.boosted_until en verified_until bij een betaling, en daarna hoorde
//  de klant er nooit meer iets van — ook niet dat de dertig dagen waaraan hij
//  betaald had voorbij waren. Dit is de enige plek in MyKunda met directe
//  herhaalomzet, dus dat was een gat aan twee kanten.
//
//  Wie krijgt een mail:
//    · de eigenaar van de advertentie (listings.owner_id)
//    · profiles.notify_plan_expiry is niet uitgezet
//    · profiles.email_bounced_at is leeg
//    · de advertentie staat publiek (active of under_offer)
//  Bewust NIET achter consent_marketing: dit gaat over iets wat de ontvanger
//  zelf gekocht heeft. Er zit wel een eigen afmeldschakelaar op, want er staat
//  ook een verlengknop in de mail.
//
//  Wanneer:
//    Boost (30 dagen)   → 3 dagen vooraf, en tot 2 dagen erna
//    Verified (180 dgn) → 14 dagen vooraf, en tot 2 dagen erna
//  De aanlooptijd is een keuze, geen meting: bij een product van dertig dagen
//  is twee weken vooraf te vroeg om iets te betekenen, bij een van een half
//  jaar is drie dagen te laat om nog iets te regelen. Het venster erna is twee
//  dagen zodat een gemiste cron-run niet betekent dat er niets meer uitgaat.
//
//  Eén mail per persoon per run, met alles wat er speelt eronder — niet één
//  mail per advertentie. Ontdubbeld door de unieke index
//  email_events_plan_expiry_once op (listing_id, product, phase, until):
//  verlengt iemand, dan schuift de einddatum op en is de volgende afloop een
//  ander bericht.
//
//  Deploy:  supabase functions deploy notify-plan-expiry --no-verify-jwt
//  Cron:    30 8 * * *  →  select public.run_plan_expiry_notices()
//  Secrets: RESEND_API_KEY, FROM_EMAIL, NOTIFY_SHARED_KEY
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isReservedTestAddress, planExpiryEmail, toText } from "../_shared/email-template.ts";
import type { ExpiryItem } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY     = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";

const FUNCTIONS_BASE = SUPABASE_URL.replace(/\/+$/, "") + "/functions/v1";

const DAG = 86400000;
/** Hoeveel dagen vooraf we waarschuwen, per product. */
const VOORAF: Record<"boost" | "verified", number> = { boost: 3, verified: 14 };
/** Hoeveel dagen na afloop we het nog melden. */
const NA = 2;
/** Een run is een run, geen mailing. */
const MAX_OWNERS_PER_RUN = 200;

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

/** Hele dagen tot een moment; negatief als het voorbij is. */
function dagenTot(iso: string, nu: number): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return NaN;
  return Math.ceil((t - nu) / DAG);
}

/** Valt deze einddatum in een venster waarover we iets melden? */
function fase(iso: string | null, product: "boost" | "verified", nu: number): "soon" | "ended" | null {
  if (!iso) return null;
  const d = dagenTot(iso, nu);
  if (isNaN(d)) return null;
  if (d > 0) return d <= VOORAF[product] ? "soon" : null;
  return d >= -NA ? "ended" : null;
}

async function sendEmail(o: { to: string; subject: string; html: string; unsubscribeUrl?: string }) {
  if (isReservedTestAddress(o.to)) throw new Error(`reserved test domain, not sent: ${o.to}`);
  const body: Record<string, unknown> = {
    from: FROM_EMAIL, to: [o.to], subject: o.subject, html: o.html, text: toText(o.html),
  };
  /* Er staat een verlengknop in, dus hij hoort een afmeldkop te dragen — en
     die moet naar de schakelaar voor DEZE mail wijzen, niet naar die voor
     berichtmeldingen. Vandaar k=plans. */
  if (o.unsubscribeUrl) {
    body.headers = {
      "List-Unsubscribe": `<${o.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return await r.json();
}

interface Kandidaat extends ExpiryItem {
  ownerId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!toegestaan(req)) return json({ ok: false, error: "forbidden" }, 403);

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    /* dry_run laat alles draaien maar claimt niets en verstuurt niets. */
    const dryRun = (body as { dry_run?: boolean }).dry_run === true;
    const nu = Date.now();

    /* ---- 1. advertenties met een einddatum in beeld ----
       De ruime vensters staan in de query zodat de database het meeste
       wegfiltert; fase() hakt daarna precies af. */
    const vanaf = new Date(nu - (NA + 1) * DAG).toISOString();
    const tot   = new Date(nu + (Math.max(VOORAF.boost, VOORAF.verified) + 1) * DAG).toISOString();

    const { data: rows, error } = await db
      .from("listings")
      .select("id, owner_id, title, area, status, boosted_until, verified_until")
      .in("status", ["active", "under_offer"])
      .or(`and(boosted_until.gte.${vanaf},boosted_until.lte.${tot}),and(verified_until.gte.${vanaf},verified_until.lte.${tot})`);
    if (error) return json({ ok: false, error: error.message }, 500);

    const kandidaten: Kandidaat[] = [];
    for (const r of rows ?? []) {
      if (!r.owner_id) continue;
      for (const [product, until] of [
        ["boost", r.boosted_until as string | null],
        ["verified", r.verified_until as string | null],
      ] as [("boost" | "verified"), string | null][]) {
        const f = fase(until, product, nu);
        if (!f || !until) continue;
        kandidaten.push({
          ownerId: String(r.owner_id),
          listingId: String(r.id),
          title: r.title ?? undefined,
          area: r.area ?? undefined,
          product, phase: f, until,
          days: dagenTot(until, nu),
        });
      }
    }
    if (!kandidaten.length) return json({ ok: true, listings: rows?.length ?? 0, owners: 0, sent: 0 });

    /* ---- 2. per eigenaar bundelen ---- */
    const perOwner = new Map<string, Kandidaat[]>();
    for (const k of kandidaten) {
      const lijst = perOwner.get(k.ownerId) ?? [];
      lijst.push(k);
      perOwner.set(k.ownerId, lijst);
    }

    const ownerIds = [...perOwner.keys()].slice(0, MAX_OWNERS_PER_RUN);
    const { data: profielen } = await db
      .from("profiles")
      .select("id, full_name, email, notify_plan_expiry, email_bounced_at, unsubscribe_token")
      .in("id", ownerIds);
    const profielVan = new Map((profielen ?? []).map((p) => [String(p.id), p]));

    let sent = 0;
    const overgeslagen: Record<string, number> = {};
    const skip = (reden: string) => { overgeslagen[reden] = (overgeslagen[reden] ?? 0) + 1; };
    const zouSturen: unknown[] = [];

    for (const ownerId of ownerIds) {
      const items = perOwner.get(ownerId)!;
      const p = profielVan.get(ownerId) as Record<string, unknown> | undefined;
      if (!p) { skip("no_profile"); continue; }
      if (p.notify_plan_expiry === false) { skip("opted_out"); continue; }
      if (p.email_bounced_at) { skip("bounced"); continue; }

      let email = (p.email as string | null) ?? null;
      if (!email) {
        const { data: au } = await db.auth.admin.getUserById(ownerId);
        email = au?.user?.email ?? null;
      }
      if (!email) { skip("no_email"); continue; }

      /* ---- 3. claimen vóór versturen ----
         De unieke index is de enige waarheid over "is dit al gemeld". Wat niet
         geclaimd kan worden, gaat niet mee in de mail. */
      const geclaimd: { item: Kandidaat; claimId: string }[] = [];
      for (const item of items) {
        if (dryRun) { geclaimd.push({ item, claimId: "" }); continue; }
        const payload = {
          listing_id: item.listingId, product: item.product,
          phase: item.phase, until: item.until, ok: null as boolean | null,
        };
        const { data: claim, error: claimErr } = await db
          .from("email_events")
          .insert({ event_type: "plan_expiry", recipient: email, subject: null, payload })
          .select("id").single();
        if (claimErr || !claim) {
          if ((claimErr as { code?: string })?.code === "23505") skip("already_sent");
          else console.error("notify-plan-expiry: claim mislukt:", claimErr);
          continue;
        }
        geclaimd.push({ item, claimId: String(claim.id) });
      }
      if (!geclaimd.length) continue;

      const mee = geclaimd.map((g) => g.item);
      /* Aflopend eerst wat al voorbij is, dan wat het kortst nog loopt. */
      mee.sort((a, b) => (a.phase === b.phase ? a.days - b.days : a.phase === "ended" ? -1 : 1));

      const unsubscribeUrl = p.unsubscribe_token
        ? `${FUNCTIONS_BASE}/unsubscribe?t=${encodeURIComponent(String(p.unsubscribe_token))}&k=plans`
        : undefined;

      const eerste = mee[0];
      const woord = (p2: "boost" | "verified") => (p2 === "boost" ? "Boost" : "Verified check");
      const allesAf = mee.every((m) => m.phase === "ended");
      const subject = mee.length === 1
        ? (eerste.phase === "ended"
            ? `Your ${woord(eerste.product)} has ended`
            : `Your ${woord(eerste.product)} runs out ${eerste.days <= 0 ? "today" : `in ${eerste.days} day${eerste.days === 1 ? "" : "s"}`}`)
        : allesAf
          ? `${mee.length} things on your listings have ended`
          : `${mee.length} things on your listings need a look`;

      const html = planExpiryEmail({
        name: (p.full_name as string | null) ?? undefined,
        items: mee,
        unsubscribeUrl,
      });

      if (dryRun) { zouSturen.push({ to: email, subject, items: mee }); continue; }

      try {
        const uit = await sendEmail({ to: email, subject, html, unsubscribeUrl });
        sent++;
        for (const g of geclaimd) {
          await db.from("email_events")
            .update({
              resend_email_id: uit?.id ?? null, subject,
              payload: { listing_id: g.item.listingId, product: g.item.product, phase: g.item.phase, until: g.item.until, ok: true },
            })
            .eq("id", g.claimId);
        }
      } catch (e) {
        /* De claim blijft staan, net als bij notify-listing-status: bij een
           storing van de mailserver willen we niet dat de volgende run het nog
           eens probeert en er alsnog twee uitgaan. De regel met ok:false is
           het spoor. */
        console.error("notify-plan-expiry: verzenden mislukt:", e);
        for (const g of geclaimd) {
          await db.from("email_events")
            .update({
              subject, reason: String((e as Error).message).slice(0, 500),
              payload: { listing_id: g.item.listingId, product: g.item.product, phase: g.item.phase, until: g.item.until, ok: false },
            })
            .eq("id", g.claimId);
        }
      }
    }

    return json({
      ok: true,
      listings: rows?.length ?? 0,
      candidates: kandidaten.length,
      owners: ownerIds.length,
      sent,
      skipped: overgeslagen,
      ...(dryRun ? { dry_run: true, would_send: zouSturen } : {}),
    });
  } catch (e) {
    console.error("notify-plan-expiry error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
