// ============================================================
//  MyKunda — Edge Function: notify-viewing
//  Three moments, three branded emails:
//   · buyer requests a viewing  → seller/team notification
//                               + confirmation to the buyer
//   · seller accepts the time   → confirmation to the buyer
//   · seller proposes slots     → email to the buyer
//
//  Deploy:  supabase functions deploy notify-viewing --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
//  LET OP: LEAD_EMAIL is hier bewust NIET uit de omgeving gelezen — zie de
//  notitie bij de constante hieronder. Zet die regel niet terug.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { viewingNotificationEmail, viewingConfirmationEmail, viewingConfirmedEmail, viewingSlotsEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
/* Interne meldingen gaan naar admin@mykunda.com, hard ingesteld en met opzet.
   info@mykunda.com bounceerde op 14-08-2026 op de Cloud86-blocklist; met een
   env-fallback naar dat adres verdwijnt elke melding van een bezichtiging
   zonder dat iemand het merkt. Ook geen Deno.env.get("LEAD_EMAIL") ervoor:
   staat die secret niet (of verkeerd) gezet, dan valt hij terug in dezelfde
   fout. Terugzetten op env pas als Cloud86 aantoonbaar los is én de secret
   gecontroleerd is — dezelfde afspraak als in notify-lead. */
const LEAD_EMAIL     = "admin@mykunda.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html, text: toText(html) };
  if (replyTo) body.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("Resend error", errText);
    throw new Error(`Resend ${r.status}: ${errText}`);
  }
  return r.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { viewing_id } = await req.json();
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: v, error } = await db
      .from("viewings_legacy_v0")
      .select("*, listings(title, area, owner_id, agent_id)")
      .eq("id", viewing_id).single();
    if (error || !v) throw new Error("viewing not found");

    const title = v.listings?.title ?? "your property";
    const sent = { team: false, buyer: false };
    const errors: string[] = [];

    if (v.status === "requested") {
      // → team / seller, reply-to the buyer
      try {
        await sendEmail(
          LEAD_EMAIL,
          `[MyKunda] New viewing request — ${title}`,
          viewingNotificationEmail({
            buyer_name: v.buyer_name,
            title,
            area: v.listings?.area,
            requested_slot: v.requested_slot,
            buyer_email: v.buyer_email,
            buyer_phone: v.buyer_phone,
          }),
          v.buyer_email || undefined,
        );
        sent.team = true;
      } catch (e) { errors.push(`team: ${(e as Error).message}`); }

      // → the buyer gets a confirmation, so the request never feels ignored
      if (v.buyer_email) {
        try {
          await sendEmail(
            v.buyer_email,
            `Your viewing request — ${title}`,
            viewingConfirmationEmail({
              buyer_name: v.buyer_name,
              title,
              area: v.listings?.area,
              requested_slot: v.requested_slot,
            }),
            LEAD_EMAIL,
          );
          sent.buyer = true;
        } catch (e) { errors.push(`buyer: ${(e as Error).message}`); }
      }
    } else if (v.status === "confirmed" && v.buyer_email) {
      // The seller accepted in the dashboard — the buyer only hears it here.
      try {
        await sendEmail(
          v.buyer_email,
          `Viewing confirmed — ${title}`,
          viewingConfirmedEmail({
            buyer_name: v.buyer_name,
            title,
            area: v.listings?.area,
            slot: v.chosen_slot ?? v.requested_slot,
          }),
          LEAD_EMAIL,
        );
        sent.buyer = true;
      } catch (e) { errors.push(`buyer: ${(e as Error).message}`); }
    } else if (v.status === "slots_proposed" && v.buyer_email) {
      try {
        await sendEmail(
          v.buyer_email,
          `New viewing times for ${title} — MyKunda`,
          viewingSlotsEmail({ title, proposed_slots: v.proposed_slots ?? [] }),
          LEAD_EMAIL,
        );
        sent.buyer = true;
      } catch (e) { errors.push(`buyer: ${(e as Error).message}`); }
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, sent, errors }), {
      status: errors.length ? 502 : 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-viewing error:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
