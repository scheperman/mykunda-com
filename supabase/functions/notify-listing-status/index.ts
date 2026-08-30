// ============================================================
//  MyKunda — Edge Function: notify-listing-status
//  Meldt de aanbieder wat er met zijn advertentie is gebeurd nadat hij hem
//  had ingediend. Aangeroepen door de databasetrigger
//  public.notify_listing_status_change() via pg_net, met
//  { listing_id, status, reason? } en de header x-notify-key.
//
//  WAAROM DEZE FUNCTIE BESTAAT (30-08-2026)
//  Een advertentie kent zes momenten: ingediend, in behandeling, goedgekeurd,
//  afgewezen, live, uit de lucht. Er ging er bij precies een een mail uit —
//  het indienen. Erger nog: die mail zei bij een gratis plan "Your listing is
//  live and buyers can find it right now", terwijl createListing() elke rij op
//  `pending_review` zet en de select-policy op listings alleen `active` en
//  `under_offer` aan het publiek toont. De verkoper werd dus verteld dat hij
//  live stond terwijl niemand hem kon vinden, en hoorde daarna nooit meer iets.
//
//  Drie statussen leveren nu een mail op:
//    active    -> "your listing is live"        (de belangrijkste)
//    rejected  -> "we need a bit more"          (met reden, als die er is)
//    archived  -> "your listing has come off"   (met de weg terug)
//  Bewust niet: sold, let en under_offer. Dat zet de verkoper zelf, dus hij
//  weet het al; een mail daarover is ruis.
//
//  Deploy:  supabase functions deploy notify-listing-status --no-verify-jwt
//  Secrets: RESEND_API_KEY, FROM_EMAIL (optioneel), NOTIFY_SHARED_KEY
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  listingLiveEmail,
  listingRejectedEmail,
  listingArchivedEmail,
  toText, isReservedTestAddress,
} from "../_shared/email-template.ts";

const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL   = Deno.env.get("FROM_EMAIL")     || "MyKunda <noreply@mykunda.com>";
const ADMIN_EMAIL  = "admin@mykunda.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY   = Deno.env.get("NOTIFY_SHARED_KEY") || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Zelfde poort als notify-payment en notify-fulfilment: staat de secret niet,
   dan gedraagt de functie zich als voorheen in plaats van stil te stoppen.
   Gemeten 30-08-2026: op dit project is hij gezet (beide functies gaven 401). */
function toegestaan(req: Request): boolean {
  if (!SHARED_KEY) return true;
  return sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY);
}

const STATUS_SUBJECT: Record<string, (t: string) => string> = {
  active:   (t) => `Your listing is live — ${t}`,
  rejected: (t) => `We need a bit more before this goes live — ${t}`,
  archived: (t) => `Your listing has come off MyKunda — ${t}`,
};

async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(opts.to)) {
    throw new Error(`reserved test domain, not sent: ${opts.to}`);
  }

  const payload: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: toText(opts.html),
  };
  if (opts.replyTo) payload.reply_to = opts.replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!toegestaan(req)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!RESEND_KEY) return json({ ok: false, error: "mail_not_configured" }, 503);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const listingId = String(body.listing_id ?? "").trim();
    const status = String(body.status ?? "").trim().toLowerCase();
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 1000) : undefined;

    if (!listingId) return json({ ok: false, error: "missing listing_id" }, 400);
    if (!STATUS_SUBJECT[status]) {
      // sold / let / under_offer / draft / pending_review komen hier binnen als
      // de trigger ooit verbreed wordt; die horen geen mail te geven.
      return json({ ok: true, skipped: "status_without_message", status });
    }

    const { data: row, error } = await db
      .from("listings")
      .select("*, owner:owner_id(full_name,email,phone)")
      .eq("id", listingId)
      .maybeSingle();
    if (error || !row) return json({ ok: false, error: "listing_not_found" }, 404);

    // Status moet nog kloppen: de trigger vuurt asynchroon, en een advertentie
    // die intussen weer is teruggezet hoort geen "hij is live" te krijgen.
    if (String(row.status) !== status) {
      return json({ ok: true, skipped: "status_changed_since", now: row.status });
    }

    const owner = (row as Record<string, unknown>).owner as Record<string, unknown> | null;
    let email = (owner?.email as string | undefined) || undefined;
    if (!email && row.owner_id) {
      const { data: au } = await db.auth.admin.getUserById(String(row.owner_id));
      email = au?.user?.email ?? undefined;
    }
    if (!email) return json({ ok: false, error: "no_seller_email" }, 422);

    /* Elke overgang hooguit een mail, en dat moet de DATABASE afdwingen — niet
       een controle vooraf. Dezelfde claim-eerst-constructie als
       notify-fulfilment, met een unieke index op (listing_id, status) voor
       event_type 'listing_status'. Zet iemand een advertentie op active, dan
       weer op pending_review en dan weer op active, dan gaat er dus een mail
       uit. Dat is met opzet: dat is heen-en-weer van de backoffice, geen
       nieuws voor de verkoper. */
    const { data: claim, error: claimErr } = await db
      .from("email_events")
      .insert({
        event_type: "listing_status",
        recipient: email,
        subject: null,
        payload: { listing_id: listingId, status, ok: null },
      })
      .select("id").single();

    if (claimErr || !claim) {
      if ((claimErr as { code?: string })?.code === "23505") {
        return json({ ok: true, skipped: "already_sent", listing_id: listingId, status });
      }
      console.error("notify-listing-status: kon de claim niet schrijven:", claimErr);
      return json({ ok: false, error: "could_not_claim" }, 500);
    }

    const listing = {
      id: row.id,
      title: row.title,
      area: row.area,
      price: row.price,
      deal: row.kind,
      cat: row.category,
      beds: row.beds,
      baths: row.baths,
      sqm: row.sqm,
      plot: row.plot_sqm,
      plan: row.plan,
      status: row.status,
      negotiable: row.negotiable,
      features: row.features,
      plus: row.plus_code,
      name: owner?.full_name,
      email,
      phone: owner?.phone,
      reason,
    };

    const title = String(listing.title ?? listing.area ?? "your property");
    const subject = STATUS_SUBJECT[status](title);
    const html = status === "active"
      ? listingLiveEmail(listing as never)
      : status === "rejected"
      ? listingRejectedEmail(listing as never)
      : listingArchivedEmail(listing as never);

    try {
      const uit = await sendEmail({ to: email, subject, html, replyTo: ADMIN_EMAIL });
      await db.from("email_events")
        .update({ resend_email_id: uit?.id ?? null, subject, payload: { listing_id: listingId, status, ok: true } })
        .eq("id", claim.id);
      return json({ ok: true, sent_to: email, status });
    } catch (e) {
      /* De claim blijft staan, net als bij notify-fulfilment: bij een storing
         van de mailserver willen we niet dat de volgende statuswissel het nog
         eens probeert. De regel met ok:false is het spoor. */
      await db.from("email_events")
        .update({ subject, reason: String((e as Error).message).slice(0, 500), payload: { listing_id: listingId, status, ok: false } })
        .eq("id", claim.id);
      console.error("notify-listing-status: verzenden mislukt:", e);
      return json({ ok: false, error: "send_failed", detail: String((e as Error).message) }, 502);
    }
  } catch (e) {
    console.error("notify-listing-status error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
