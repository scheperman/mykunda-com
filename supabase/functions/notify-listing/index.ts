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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    let listing: Record<string, unknown>;
    const hasListingData = body.listing_data && typeof body.listing_data === "object"
      && Object.keys(body.listing_data as object).length > 0;

    if (hasListingData) {
      listing = { ...(body.listing_data as Record<string, unknown>) };
    } else {
      const listingId = body.listing_id as string | undefined;
      if (!listingId) return json({ ok: false, reason: "missing_listing_id" });

      const { data: row, error } = await db
        .from("listings")
        .select("*, owner:owner_id(full_name,email,phone)")
        .eq("id", listingId)
        .maybeSingle();

      if (error || !row) {
        console.warn("notify-listing: listing not found for", listingId, error);
        return json({ ok: false, reason: "listing_not_found" }, 404);
      }

      const owner = (row as Record<string, unknown>).owner as Record<string, unknown> | null;
      listing = {
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
        email: owner?.email,
        phone: owner?.phone,
      };
    }

    const title = String(listing.title ?? listing.area ?? "property");
    const email = listing.email as string | undefined;

    if (!RESEND_KEY) {
      console.log("No RESEND_API_KEY — emails not sent.");
      return json({ ok: true, skipped: "no email provider" });
    }

    if (!email) {
      if (hasListingData) {
        return json({ error: "email required" }, 400);
      }
      console.warn("notify-listing: no seller email for listing", listing.id);
      return json({ ok: false, reason: "no_seller_email" }, 422);
    }

    const planKey = String(listing.plan || "basic").toLowerCase();
    const needsAction = planKey !== "basic";
    const planLabel = planKey === "managed" ? "Managed" : planKey === "verified" ? "Verified" : "Basic";

    const errors: string[] = [];
    const sent = { seller: false, admin: false };

    // 1) Seller confirmation. reply_to = ADMIN_EMAIL, because this mail
    //    literally invites the seller to reply with corrections.
    try {
      await sendEmail({
        to: email,
        subject: `Your MyKunda listing has been received — ${title}`,
        html: listingConfirmationEmail(listing as any),
        replyTo: ADMIN_EMAIL,
      });
      sent.seller = true;
    } catch (e) {
      errors.push(`seller: ${(e as Error).message}`);
      console.error("notify-listing seller email failed:", e);
    }

    // 2) Backoffice notification. Attempted even when the seller mail failed,
    //    and reply_to = the seller so answering is one click (as in notify-lead).
    try {
      await sendEmail({
        to: ADMIN_EMAIL,
        subject: needsAction
          ? `⚡ Action required — New ${planLabel} listing: ${title}`
          : `New listing submitted — ${title}`,
        html: listingBackofficeEmail(listing as any),
        replyTo: email || undefined,
      });
      sent.admin = true;
    } catch (e) {
      errors.push(`admin: ${(e as Error).message}`);
      console.error("notify-listing backoffice email failed:", e);
    }

    return json({ ok: errors.length === 0, sent, errors }, errors.length ? 502 : 200);
  } catch (e) {
    console.error("notify-listing error:", e);
    return json({ error: (e as Error).message }, 500);
  }
});
