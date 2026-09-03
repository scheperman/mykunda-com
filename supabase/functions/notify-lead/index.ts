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
import { leadNotificationEmail, leadAutoReplyEmail, leadOwnerEmail, toText, isReservedTestAddress } from "../_shared/email-template.ts";

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

/* Verzendlogboek. Tot 30-08-2026 schreef deze functie niets in email_events:
   op de lead stond alleen notified_at ("we hebben het geprobeerd"), zonder
   ontvanger, onderwerp of Resend-id. Daardoor was notify-health blind voor
   juist de meest voorkomende mail van de site, en was bij een bounce niet
   terug te vinden welke bezoeker zijn antwoord miste. Nooit fataal: mislukt
   het loggen, dan is de mail zelf belangrijker. */
async function logEmail(
  db: ReturnType<typeof createClient>,
  row: {
    event_type: string;
    recipient: string;
    subject: string;
    resend_email_id?: string | null;
    ok: boolean;
    reason?: string | null;
    lead_id?: string;
    source?: string;
  },
) {
  try {
    await db.from("email_events").insert({
      resend_email_id: row.resend_email_id ?? null,
      event_type: row.event_type,
      recipient: row.recipient,
      subject: row.subject,
      reason: row.reason ?? null,
      payload: { ok: row.ok, lead_id: row.lead_id, source: row.source },
    });
  } catch (e) {
    console.warn("notify-lead: email_events niet geschreven:", (e as Error).message);
  }
}

/* ---- WhatsApp aan de aanbieder (03-09-2026) ----------------------------
   Via wa-notify met de goedgekeurde Meta-template `lead_owner`:
     "New enquiry on MyKunda from {{1}} about {{2}}. You can reach them on
      {{3}}. Details and reply tools: mykunda.com/dashboard.html#leads —
      turn these alerts off under Account."
   Een template is verplicht: MyKunda begint het gesprek. Zolang de Cloud API
   niet ingericht is (WA_PHONE_NUMBER_ID / WA_ACCESS_TOKEN ontbreken) doet
   deze functie stil niets — geen fout in de keten, geen regel in het log.
   De uitkomst gaat wél in email_events (event_type lead_owner_wa) zodra er
   echt verzonden is, zodat notify-health een stille Meta-storing ziet. */
const WA_READY = !!(Deno.env.get("WA_PHONE_NUMBER_ID") && Deno.env.get("WA_ACCESS_TOKEN"));
const NOTIFY_SHARED_KEY = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";
function waDigits(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 7) d = "220" + d;          // Gambiaans nummer zonder landcode
  return d.length >= 9 ? d : "";
}
async function sendWhatsApp(to: string, template: string, params: string[]) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/wa-notify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-notify-key": NOTIFY_SHARED_KEY },
    body: JSON.stringify({ to: "+" + to, template, params }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`wa-notify ${r.status}: ${txt.slice(0, 300)}`);
  try { return JSON.parse(txt); } catch { return {}; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    /* skip_team: de teammail overslaan en alleen de auto-reply sturen. Eén
       aanroeper gebruikt dat — de bezichtigingsaanvraag van een ingelogde
       bezoeker, waar notify-viewing de verkoper al mailt mét de knop om een
       tijd te kiezen. Zonder dit kreeg de verkoper twee mails binnen een halve
       seconde over dezelfde aanvraag. Gemeten tijdens reis 3, 30-08-2026. */
    const { lead_id, skip_team } = await req.json().catch(() => ({}));
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
      /* Voor de afmeldlink in de area-alert-bevestiging (unsubscribe?k=area). */
      unsubscribe_token: lead.unsubscribe_token ?? null,
    };
    const label = TEAM_LABEL[lead.source] ?? "enquiry";
    const who = lead.name || lead.email || lead.phone || "a visitor";
    const errors: string[] = [];
    const sent = { team: false, reply: false, owner: false };

    // 1) Team notification — reply-to the visitor so answering is one click.
    const teamSubject = safeSubject(`[MyKunda] New ${label} — ${who}`);
    if (skip_team === true) {
      sent.team = false;
      console.info("notify-lead: teammail overgeslagen op verzoek (skip_team) voor lead", lead.id);
    } else try {
      const res = await sendEmail({
        to: LEAD_EMAIL,
        subject: teamSubject,
        html: leadNotificationEmail(info),
        replyTo: lead.email || undefined,
      });
      sent.team = true;
      await logEmail(db, {
        event_type: "lead_backoffice", recipient: LEAD_EMAIL, subject: teamSubject,
        resend_email_id: (res as { id?: string })?.id ?? null,
        ok: true, lead_id: lead.id, source: lead.source,
      });
    } catch (e) {
      errors.push(`team: ${(e as Error).message}`);
      console.error("notify-lead team email failed:", e);
      await logEmail(db, {
        event_type: "lead_backoffice", recipient: LEAD_EMAIL, subject: teamSubject,
        ok: false, reason: (e as Error).message, lead_id: lead.id, source: lead.source,
      });
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
        const replySubject = REPLY_SUBJECT[lead.source] ?? "Thank you for contacting MyKunda";
        try {
          const res = await sendEmail({
            to: lead.email,
            subject: replySubject,
            html: leadAutoReplyEmail(info),
            replyTo: LEAD_EMAIL,
          });
          sent.reply = true;
          await logEmail(db, {
            event_type: "lead_autoreply", recipient: lead.email, subject: replySubject,
            resend_email_id: (res as { id?: string })?.id ?? null,
            ok: true, lead_id: lead.id, source: lead.source,
          });
        } catch (e) {
          errors.push(`auto-reply: ${(e as Error).message}`);
          console.error("notify-lead auto-reply failed:", e);
          await logEmail(db, {
            event_type: "lead_autoreply", recipient: lead.email, subject: replySubject,
            ok: false, reason: (e as Error).message, lead_id: lead.id, source: lead.source,
          });
        }
      }
    } else {
      /* Een lead zonder e-mailadres kreeg notified_at én notify_error null,
         precies alsof er netjes gemaild was. Achteraf was dat niet meer te
         onderscheiden van een geslaagde verzending. */
      errors.push("auto-reply: lead has no email address");
    }

    // 2b) De eigenaar van de advertentie (03-09-2026). Tot vandaag kreeg alleen
    //     admin@ de teammail en zag de aanbieder de aanvraag pas in zijn
    //     dashboard — terwijl property.html de bezoeker belooft dat de eigenaar
    //     hem ziet en contact opneemt. Alleen voor leads met een advertentie en
    //     een bron waar een aanbieder iets mee moet; achter dezelfde schakelaar
    //     als de berichtmails (profiles.notify_messages) en dezelfde
    //     afmeldlink. Nooit fataal voor de rest van de keten.
    if (lead.listing_id && ["viewing", "listing_enquiry", "agent_message"].includes(String(lead.source))) {
      try {
        const { data: listing } = await db.from("listings")
          .select("id, title, area, owner_id, contact_phone").eq("id", lead.listing_id).single();
        if (listing?.owner_id) {
          type P = { id: string; full_name: string | null; email: string | null; notify_messages: boolean | null; unsubscribe_token: string | null; email_bounced_at: string | null; phone?: string | null; notify_whatsapp?: boolean | null };
          let owner = (await db.from("profiles")
            .select("id, full_name, email, phone, notify_messages, notify_whatsapp, unsubscribe_token, email_bounced_at")
            .eq("id", listing.owner_id).maybeSingle()).data as P | null;
          const ownerProfile = owner;
          if (!owner?.email) {
            const { data: au } = await db.auth.admin.getUserById(listing.owner_id);
            if (au?.user?.email) owner = { id: listing.owner_id, full_name: owner?.full_name ?? (au.user.user_metadata?.full_name ?? null), email: au.user.email, notify_messages: owner?.notify_messages ?? true, unsubscribe_token: owner?.unsubscribe_token ?? null, email_bounced_at: owner?.email_bounced_at ?? null, phone: owner?.phone ?? null, notify_whatsapp: owner?.notify_whatsapp ?? true };
          }
          if (!owner?.email) {
            errors.push("owner: no email address");
          } else if (owner.notify_messages === false) {
            console.info("notify-lead: eigenaar heeft berichtmails uit, lead", lead.id);
          } else if (owner.email_bounced_at) {
            errors.push("owner: address bounced earlier, not sent");
          } else if (owner.email.toLowerCase() === LEAD_EMAIL) {
            // Eigen testadvertenties van de backoffice: de teammail volstaat.
            console.info("notify-lead: eigenaar is de backoffice zelf, geen tweede mail");
          } else {
            const ownerSubject = safeSubject(`${who} ${lead.source === "viewing" ? "wants to view" : "asked about"} ${listing.title ?? "your listing"} — MyKunda`);
            const unsubscribeUrl = owner.unsubscribe_token
              ? `${SUPABASE_URL}/functions/v1/unsubscribe?t=${encodeURIComponent(owner.unsubscribe_token)}`
              : undefined;
            try {
              const res = await sendEmail({
                to: owner.email,
                subject: ownerSubject,
                html: leadOwnerEmail({
                  source: String(lead.source), name: info.name, email: info.email, phone: info.phone,
                  message: info.message, payload: info.payload,
                  listingTitle: listing.title ?? "your listing", listingId: listing.id,
                  ownerName: owner.full_name ?? undefined, unsubscribeUrl,
                }),
                replyTo: lead.email || undefined,
              });
              sent.owner = true;
              await logEmail(db, {
                event_type: "lead_owner", recipient: owner.email, subject: ownerSubject,
                resend_email_id: (res as { id?: string })?.id ?? null,
                ok: true, lead_id: lead.id, source: lead.source,
              });
            } catch (e) {
              errors.push(`owner: ${(e as Error).message}`);
              console.error("notify-lead owner email failed:", e);
              await logEmail(db, {
                event_type: "lead_owner", recipient: owner.email, subject: ownerSubject,
                ok: false, reason: (e as Error).message, lead_id: lead.id, source: lead.source,
              });
            }
          }

          // 2c) Dezelfde aanvraag als WhatsApp-bericht, naast de mail. Het
          //     nummer van de advertentie gaat voor: dat is wat de aanbieder
          //     opgaf als "where buyers reach you"; anders het profielnummer.
          const waTo = waDigits(listing.contact_phone) || waDigits(ownerProfile?.phone);
          const waOn = (ownerProfile?.notify_whatsapp ?? true) !== false;
          const isBackoffice = !!owner?.email && owner.email.toLowerCase() === LEAD_EMAIL;
          if (WA_READY && waTo && waOn && !isBackoffice) {
            const contactLine = info.phone ? String(info.phone) : (info.email ? String(info.email) : "the details in your dashboard");
            const params = [String(who).slice(0, 60), String(listing.title ?? "your listing").slice(0, 60), contactLine.slice(0, 60)];
            try {
              const r = await sendWhatsApp(waTo, "lead_owner", params);
              await logEmail(db, {
                event_type: "lead_owner_wa", recipient: "+" + waTo, subject: "WhatsApp: " + params.join(" · "),
                resend_email_id: (r as { message_id?: string })?.message_id ?? null,
                ok: true, lead_id: lead.id, source: lead.source,
              });
            } catch (e) {
              errors.push(`owner-whatsapp: ${(e as Error).message}`);
              console.error("notify-lead owner WhatsApp failed:", e);
              await logEmail(db, {
                event_type: "lead_owner_wa", recipient: "+" + waTo, subject: "WhatsApp: " + params.join(" · "),
                ok: false, reason: (e as Error).message, lead_id: lead.id, source: lead.source,
              });
            }
          } else if (WA_READY && !waTo) {
            console.info("notify-lead: geen WhatsApp-nummer voor de eigenaar van", listing.id);
          }
        }
      } catch (e) {
        errors.push(`owner: ${(e as Error).message}`);
        console.warn("notify-lead: eigenaarsmail overgeslagen:", (e as Error).message);
      }
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
    const hardFail = errors.some((e) => !e.startsWith("auto-reply: lead has no email") && !e.startsWith("auto-reply: rate limited") && !e.startsWith("owner: no email") && !e.startsWith("owner: address bounced") && !e.startsWith("owner-whatsapp:"));
    return json({ ok: !errors.length, sent, errors }, hardFail ? 502 : 200);
  } catch (err) {
    console.error("notify-lead error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
