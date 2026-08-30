// ============================================================
//  MyKunda — Edge Function: notify-listing
//  Sends emails when a new property listing is submitted:
//   1. Confirmation email to the seller
//   2. Backoffice notification to ADMIN_EMAIL
//
//  Deploy: supabase functions deploy notify-listing --no-verify-jwt
//
//  *** RECIPIENT OVERRIDE — 2026-08-16 ***
//  info@mykunda.com hard-bounced on 2026-08-14: "554 5.7.1 Service
//  unavailable; Client host [54.240.6.247] blocked using bl.cloud86-dnsbl.io".
//  mykunda.com's DNS (NS/SOA) is hosted at Cloud86, who run that blocklist.
//  Between 14-08 and 16-08 this constant pointed at a private Gmail address;
//  it now points at admin@mykunda.com (working Google Workspace address on
//  the same domain). Seller confirmation -> the seller; backoffice
//  notification -> ADMIN_EMAIL. To move back to info@mykunda.com once
//  Cloud86 is resolved, restore:
//    const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "info@mykunda.com";
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listingConfirmationEmail, listingBackofficeEmail, toText } from "../_shared/email-template.ts";

const RESEND_KEY   = Deno.env.get("RESEND_API_KEY") || "";
const FROM_EMAIL   = Deno.env.get("FROM_EMAIL")     || "MyKunda <noreply@mykunda.com>";
const ADMIN_EMAIL  = "admin@mykunda.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY   = Deno.env.get("NOTIFY_SHARED_KEY") || "";

/* Constant-tijd vergelijking, zoals in notify-payment. */
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

/* Same helper as notify-lead / notify-signup: HTML + plain text, and a
   non-2xx from Resend throws instead of silently becoming {ok:true}. */
async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
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
  try {
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    /* ---- Poort. Tot 30-08-2026 was er geen enkele.  ------------------------
       Deze functie stond open: verify_jwt staat uit (nodig voor de preflight),
       er werd geen sleutel gelezen, en het listing_data-pad accepteerde een
       willekeurig e-mailadres van de aanroeper. Wie de URL kende, kon dus een
       geloofwaardige MyKunda-mail sturen naar wie hij wilde, vanaf ons eigen
       geverifieerde domein — en er ook nog eentje in onze backoffice laten
       landen. Gemeten op 30-08-2026: POST zonder sleutel gaf 200.

       Twee wegen naar binnen, allebei bewezen:
         · x-notify-key            → interne aanroeper (zoals notify-payment)
         · Authorization: Bearer   → een ingelogde gebruiker die aantoonbaar
                                     eigenaar is van deze listing
       En in beide gevallen komt het ontvangstadres uit de DATABASE, nooit uit
       de payload. listing_data mag de mail verrijken, maar bepaalt niet meer
       wie hem krijgt. Een vervalst verzoek kan daarmee hoogstens een mail over
       de eigen advertentie naar het eigen adres uitlokken.                  */
    const listingId = (body.listing_id as string | undefined) || undefined;
    if (!listingId) return json({ ok: false, reason: "missing_listing_id" }, 400);

    const internal = !!SHARED_KEY && sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY);

    const { data: row, error } = await db
      .from("listings")
      .select("*, owner:owner_id(full_name,email,phone)")
      .eq("id", listingId)
      .maybeSingle();

    if (error || !row) {
      console.warn("notify-listing: listing not found for", listingId, error);
      return json({ ok: false, reason: "listing_not_found" }, 404);
    }

    if (!internal) {
      const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!token) return json({ ok: false, error: "unauthorized" }, 401);
      const { data: who } = await db.auth.getUser(token);
      const uid = who?.user?.id;
      // De anon-sleutel is openbaar en levert hier geen gebruiker op — precies
      // de bedoeling: alleen een echte sessie komt langs deze regel.
      if (!uid) return json({ ok: false, error: "unauthorized" }, 401);
      if (String((row as Record<string, unknown>).owner_id ?? "") !== uid) {
        return json({ ok: false, error: "not_your_listing" }, 403);
      }
    }

    const owner = (row as Record<string, unknown>).owner as Record<string, unknown> | null;

    /* De database wint over de payload voor alles wat bepaalt wíé er mailt en
       wie hem krijgt; listing_data mag alleen de details aanvullen die nog
       niet in kolommen staan (highlights, nearby, docType, condition …). */
    const extra = (body.listing_data && typeof body.listing_data === "object")
      ? { ...(body.listing_data as Record<string, unknown>) }
      : {};
    delete extra.email;
    delete extra.id;

    const listing: Record<string, unknown> = {
      ...extra,
      id: row.id,
      title: row.title ?? extra.title,
      area: row.area ?? extra.area,
      price: row.price ?? extra.price,
      deal: row.kind,
      cat: row.category,
      beds: row.beds,
      baths: row.baths,
      sqm: row.sqm,
      plot: row.plot_sqm,
      plan: row.plan,
      status: row.status,
      negotiable: row.negotiable,
      features: row.features ?? extra.features,
      plus: row.plus_code ?? extra.plus,
      name: owner?.full_name ?? extra.name,
      phone: owner?.phone ?? extra.phone,
    };

    const title = String(listing.title ?? listing.area ?? "property");

    if (!RESEND_KEY) {
      // Geen mailprovider is een storing, geen geslaagde afhandeling. Dit gaf
      // tot 30-08-2026 {ok:true} met status 200 terug.
      console.error("notify-listing: RESEND_API_KEY ontbreekt — er is niets verstuurd.");
      return json({ ok: false, error: "mail_not_configured" }, 503);
    }

    /* Het adres van de verkoper komt uit het profiel, met dezelfde
       auth-terugval als notify-viewing gebruikt. */
    let email = (owner?.email as string | undefined) || undefined;
    if (!email && row.owner_id) {
      const { data: au } = await db.auth.admin.getUserById(String(row.owner_id));
      email = au?.user?.email ?? undefined;
    }
    listing.email = email;

    if (!email) {
      console.warn("notify-listing: no seller email for listing", listing.id);
      return json({ ok: false, reason: "no_seller_email" }, 422);
    }

    const planKey = String(listing.plan || "basic").toLowerCase();
    const needsAction = planKey !== "basic";
    const planLabel = planKey === "managed" ? "Managed" : planKey === "verified" ? "Verified" : "Basic";

    const errors: string[] = [];
    const sent = { seller: false, admin: false };

    /* Verzendlogboek. Deze functie schreef als enige mailfunctie niets weg,
       dus bij een bounce hield je een adres over en verder niets — precies het
       probleem dat in notify-payment al beschreven staat. Loggen mag nooit de
       mail tegenhouden, dus alle fouten worden hier geslikt. */
    const logMail = async (o: {
      eventType: string; recipient: string; subject: string;
      ok: boolean; resendId?: string | null; reason?: string;
    }) => {
      try {
        await db.from("email_events").insert({
          resend_email_id: o.resendId ?? null,
          event_type: o.eventType,
          recipient: o.recipient,
          subject: o.subject,
          reason: o.ok ? null : (o.reason ?? "").slice(0, 500),
          payload: { listing_id: String(listing.id), plan: planKey, ok: o.ok, internal },
        });
      } catch (_) { /* nooit fataal */ }
    };

    // 1) Seller confirmation. reply_to = ADMIN_EMAIL, because this mail
    //    literally invites the seller to reply with corrections.
    const sellerSubject = `Your MyKunda listing has been received — ${title}`;
    try {
      const uit = await sendEmail({
        to: email,
        subject: sellerSubject,
        html: listingConfirmationEmail(listing as any),
        replyTo: ADMIN_EMAIL,
      });
      sent.seller = true;
      await logMail({ eventType: "listing_confirmation", recipient: email, subject: sellerSubject, ok: true, resendId: uit?.id ?? null });
    } catch (e) {
      errors.push(`seller: ${(e as Error).message}`);
      console.error("notify-listing seller email failed:", e);
      await logMail({ eventType: "listing_confirmation", recipient: email, subject: sellerSubject, ok: false, reason: (e as Error).message });
    }

    // 2) Backoffice notification. Attempted even when the seller mail failed,
    //    and reply_to = the seller so answering is one click (as in notify-lead).
    const adminSubject = needsAction
      ? `⚡ Action required — New ${planLabel} listing: ${title}`
      : `New listing submitted — ${title}`;
    try {
      const uit = await sendEmail({
        to: ADMIN_EMAIL,
        subject: adminSubject,
        html: listingBackofficeEmail(listing as any),
        replyTo: email || undefined,
      });
      sent.admin = true;
      await logMail({ eventType: "listing_backoffice", recipient: ADMIN_EMAIL, subject: adminSubject, ok: true, resendId: uit?.id ?? null });
    } catch (e) {
      errors.push(`admin: ${(e as Error).message}`);
      console.error("notify-listing backoffice email failed:", e);
      await logMail({ eventType: "listing_backoffice", recipient: ADMIN_EMAIL, subject: adminSubject, ok: false, reason: (e as Error).message });
    }

    return json({ ok: errors.length === 0, sent, errors }, errors.length ? 502 : 200);
  } catch (e) {
    console.error("notify-listing error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
