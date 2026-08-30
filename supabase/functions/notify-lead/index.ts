// ============================================================
//  MyKunda — Edge Function: notify-lead
//  Every form on the site writes a row into `leads` and calls
//  this function: a branded team notification to LEAD_EMAIL
//  (reply-to = the visitor, so answering is one click) plus a
//  branded auto-reply to the visitor.
//
//  Both mails go out as HTML + plain text, from the shared
//  templates in ../_shared/email-template.ts. Escaping happens
//  inside those templates — raw values are passed in here.
//
//  Deploy:  supabase functions deploy notify-lead --no-verify-jwt
//  Secrets: RESEND_API_KEY, FROM_EMAIL
//           (LEAD_EMAIL/ADMIN_EMAIL worden bewust NIET gelezen — zie de
//            notitie bij de constante hieronder; niet terugzetten op env.)
//  Optional: run backend/lead-notify-status.sql once so every send
//           is recorded on the lead row (notified_at / notify_error).
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { leadNotificationEmail, leadAutoReplyEmail, toText, isReservedTestAddress } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
/* Hard ingesteld, met opzet — zie notify-viewing voor dezelfde notitie.
   info@mykunda.com bounceerde op 14-08-2026 op de Cloud86-blocklist; een
   env-fallback naar dat adres laat elke lead-melding stil verdwijnen.
   Deze regel liep live al zo; hij hoort in de bron te staan, niet alleen
   op de server. Pas terug naar env als Cloud86 aantoonbaar los is. */
const LEAD_EMAIL = "admin@mykunda.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEAM_LABEL: Record<string, string> = {
  valuation: "valuation request",
  viewing: "viewing request",
  agent_message: "message for an agent",
  area_alert: "area-alert signup",
  contact: "contact message",
  listing_enquiry: "listing enquiry",
  consultation: "consultation booking",
  whatsapp_inbound: "WhatsApp message",
  verification: "ownership check request",
  // agent.html schrijft deze bron al sinds de partnerpagina bestaat, maar hij
  // stond in geen van beide lijsten — de mail viel terug op "enquiry" en op de
  // generieke bedanktekst. (30-08-2026)
  agent_partner: "agency registration",
};

const REPLY_SUBJECT: Record<string, string> = {
  valuation: "Your valuation request — MyKunda",
  viewing: "Your viewing request — MyKunda",
  agent_message: "Your message is with the agent — MyKunda",
  area_alert: "Your area alert is set up — MyKunda",
  contact: "Thank you for contacting MyKunda",
  listing_enquiry: "Your property enquiry — MyKunda",
  consultation: "Your free consultation is booked — MyKunda",
  whatsapp_inbound: "We received your WhatsApp message — MyKunda",
  verification: "Your ownership check request — MyKunda",
  agent_partner: "Your agency registration — MyKunda",
};

/* Een onderwerpregel is een header. Regeleinden en tabs horen er niet in, en
   een naam die iemand zelf invult kan alles bevatten: create_lead staat open
   voor anon en de escaping in de templates geldt alleen voor de body. */
function safeSubject(v: unknown, max = 120): string {
  return String(v ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sendEmail(opts: { to: string; subject: string; html: string; replyTo?: string }) {
  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(opts.to)) {
    throw new Error(`reserved test domain, not sent: ${opts.to}`);
  }

  const body: Record<string, unknown> = {
    from: FROM_EMAIL,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: toText(opts.html),
  };
  if (opts.replyTo) body.reply_to = opts.replyTo;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { lead_id } = await req.json().catch(() => ({}));
    if (!lead_id) return json({ ok: false, error: "missing lead_id" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: lead, error } = await db.from("leads").select("*").eq("id", lead_id).single();
    if (error || !lead) return json({ ok: false, error: "lead not found" }, 404);

    /* ---- Dedupe. Toegevoegd 30-08-2026. ---------------------------------
       notified_at werd wél geschreven en nooit gelezen. Deze functie staat op
       verify_jwt:false en create_lead() is uitvoerbaar door anon en geeft het
       id terug — dus wie de URL kende kon dezelfde lead onbeperkt opnieuw
       POSTen, en elke keer vertrokken er twee mails: één naar een adres naar
       keuze en één naar onze eigen backoffice. Eén lead is nu één ronde. */
    if (lead.notified_at) {
      return json({ ok: true, skipped: "already notified", lead_id: lead.id });
    }

    const info = {
      source: lead.source,
      name: lead.name ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      area: lead.area ?? undefined,
      message: lead.message ?? undefined,
      payload: lead.payload ?? {},
    };
    const label = TEAM_LABEL[lead.source] ?? "enquiry";
    const who = lead.name || lead.email || lead.phone || "a visitor";
    const errors: string[] = [];
    const sent = { team: false, reply: false };

    // 1) Team notification — reply-to the visitor so answering is one click.
    try {
      await sendEmail({
        to: LEAD_EMAIL,
        subject: safeSubject(`[MyKunda] New ${label} — ${who}`),
        html: leadNotificationEmail(info),
        replyTo: lead.email || undefined,
      });
      sent.team = true;
    } catch (e) {
      errors.push(`team: ${(e as Error).message}`);
      console.error("notify-lead team email failed:", e);
    }

    // 2) Auto-reply — attempted even when the team email failed, so the
    //    visitor is never left wondering whether anything arrived.
    if (lead.email) {
      /* Rem per ontvangend adres. Zonder deze regel is een handvol
         create_lead-aanroepen met het adres van een ander genoeg om iemand
         onder te spammen vanaf ons eigen geverifieerde domein — en de
         reputatie van mykunda.com gaat mee. Drie per uur is ruim voor een
         mens die twee formulieren invult, en waardeloos voor een script.
         Hergebruikt claim_auth_email_rate, dezelfde teller als auth-email. */
      let mayReply = true;
      try {
        const { data: allowed, error: rateErr } = await db.rpc("claim_auth_email_rate", {
          p_bucket: `lead_reply:${String(lead.email).toLowerCase()}`,
          p_window_seconds: 3600,
          p_max_hits: 3,
        });
        if (rateErr) throw new Error(rateErr.message);
        mayReply = allowed === true;
      } catch (e) {
        // Faalt de teller zelf, dan blijft de mail belangrijker dan de rem.
        console.warn("notify-lead: rate-teller niet beschikbaar:", (e as Error).message);
      }

      if (!mayReply) {
        errors.push("auto-reply: rate limited (3 per address per hour)");
        console.warn("notify-lead: auto-reply gestopt door de rem voor", lead.email);
      } else {
        try {
          await sendEmail({
            to: lead.email,
            subject: REPLY_SUBJECT[lead.source] ?? "Thank you for contacting MyKunda",
            html: leadAutoReplyEmail(info),
            replyTo: LEAD_EMAIL,
          });
          sent.reply = true;
        } catch (e) {
          errors.push(`auto-reply: ${(e as Error).message}`);
          console.error("notify-lead auto-reply failed:", e);
        }
      }
    } else {
      /* Een lead zonder e-mailadres kreeg notified_at én notify_error null,
         precies alsof er netjes gemaild was. Achteraf was dat niet meer te
         onderscheiden van een geslaagde verzending. */
      errors.push("auto-reply: lead has no email address");
    }

    // 3) Audit trail on the lead row. Silently skipped when
    //    backend/lead-notify-status.sql hasn't been run yet.
    try {
      await db.from("leads").update({
        notified_at: new Date().toISOString(),
        notify_error: errors.length ? errors.join(" | ") : null,
      }).eq("id", lead.id);
    } catch (_) { /* columns not present — not fatal */ }

    /* Alleen een echte verzendfout is een 502. Een lead zonder adres en een
       lead die door de rem is gestopt zijn genoteerd, geen storing. */
    const hardFail = errors.some((e) => !e.startsWith("auto-reply: lead has no email") && !e.startsWith("auto-reply: rate limited"));
    return json({ ok: !errors.length, sent, errors }, hardFail ? 502 : 200);
  } catch (err) {
    console.error("notify-lead error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
