// ============================================================
//  MyKunda — Edge Function: notify-listing
//  A listing is published → branded confirmation to the seller
//  and a detailed notification to the backoffice, both as HTML
//  + plain text from ../_shared/email-template.ts.
//
//  Deploy:  supabase functions deploy notify-listing --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL / LEAD_EMAIL
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { listingConfirmationEmail, listingBackofficeEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEAD_EMAIL = Deno.env.get("LEAD_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "info@mykunda.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html, text: toText(html) };
  if (replyTo) body.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { listing_id, listing_data } = await req.json();
    let listing = listing_data;

    if (listing_id && !listing) {
      const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data, error } = await sb.from("listings").select("*").eq("id", listing_id).single();
      if (error || !data) throw new Error("Listing not found: " + (error?.message || listing_id));
      listing = {
        id: data.id,
        title: data.title,
        area: data.area,
        price: data.price,
        deal: data.kind || data.type,
        cat: data.category || data.cat,
        beds: data.beds,
        baths: data.baths,
        sqm: data.sqm,
        plot: data.plot,
        plan: data.plan,
        name: data.seller_name || data.name,
        email: data.seller_email || data.email,
        phone: data.seller_phone || data.phone,
        plus: data.plus_code || data.plus,
        highlights: data.highlights,
        nearby: data.nearby,
        customFeats: data.custom_feats,
        yearBuilt: data.year_built,
        videoLink: data.video_link,
        status: data.status,
        docType: data.doc_type,
      };
    }

    if (!listing) throw new Error("No listing data provided");

    const planLabel = { basic: "Basic", verified: "Verified", managed: "Managed" }[listing.plan || "basic"] || "New";
    const errors: string[] = [];
    const sent = { backoffice: false, seller: false };

    // 1) Backoffice — always, reply-to the seller
    try {
      await sendEmail(
        LEAD_EMAIL,
        `[MyKunda] New ${planLabel} listing: ${listing.title || "Untitled"} — ${listing.area || "The Gambia"}`,
        listingBackofficeEmail(listing),
        listing.email || undefined,
      );
      sent.backoffice = true;
    } catch (e) { errors.push(`backoffice: ${(e as Error).message}`); }

    // 2) Seller confirmation — attempted even if the backoffice mail failed
    if (listing.email) {
      try {
        await sendEmail(
          listing.email,
          `Your listing is confirmed — ${listing.title || "MyKunda"}`,
          listingConfirmationEmail(listing),
          LEAD_EMAIL,
        );
        sent.seller = true;
      } catch (e) { errors.push(`seller: ${(e as Error).message}`); }
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, sent, errors }), {
      status: errors.length ? 502 : 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-listing error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
