// ============================================================
//  MyKunda — Edge Function: notify-viewing-reminder
//  Stuurt beide partijen een herinnering voor een bevestigde
//  bezichtiging. Wordt aangeroepen door public.send_viewing_reminder_mail(),
//  die vanuit de cron-taak 'viewing-reminders' draait, via pg_net met
//  { viewing_id, phase } waarbij phase '24h' of '2h' is.
//
//  Zelfde kanaal en opzet als notify-message: pg_net -> deze functie ->
//  Resend, met dezelfde huisstijl, dezelfde opt-out (profiles.notify_messages)
//  en dezelfde unsubscribe-link.
//
//  Beveiliging: het endpoint staat open (net als notify-message), maar
//  verstuurt alleen als de bezichtiging bestaat, status 'confirmed' heeft
//  en het gekozen moment daadwerkelijk binnen het venster van de fase valt.
//  Zonder de (niet te raden) viewing-uuid en het juiste tijdvenster gebeurt
//  er niets.
//
//  Secrets: RESEND_API_KEY, FROM_EMAIL (optioneel)
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isReservedTestAddress } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";
const SITE = "https://mykunda.com";
const FUNCTIONS_BASE = "https://jejaerpqltqryqzjvbjp.functions.supabase.co";

/* Constant-tijd vergelijking, zoals in notify-payment en notify-listing. */
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const BRAND = {
  green: "#15463A",
  ink: "#18201D",
  ink2: "#384640",
  muted: "#5C6B64",
  muted2: "#8A958E",
  paper: "#FAF8F3",
  paper2: "#F3F0E8",
  line: "#EFEBE1",
  logo: "https://mykunda.com/images/mykunda-icon.png",
  email: "info@mykunda.com",
  waNumber: "+220 272 0268",
  waLink: "https://wa.me/2202720268",
  font:
    `-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif`,
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-notify-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function toText(html: string): string {
  return html
    .replace(/<div id="preheader"[\s\S]*?<\/div>/i, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => {
      const l = label.replace(/<[^>]+>/g, "").trim();
      if (!l) return href;
      if (/^(mailto|tel):/i.test(href)) return l;
      return href && href.indexOf(l) === -1 ? `${l} (${href})` : l;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h1|h2|h3|h4|table|ul)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&zwnj;/g, "")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .split("\n").map((l) => l.trim())
    .filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "")
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function emailWrap(opts: { heading: string; body: string; cta: string; ctaUrl: string; preheader: string; footer: string; unsubscribeUrl?: string }): string {
  const { heading, body, cta, ctaUrl, preheader, footer, unsubscribeUrl } = opts;
  const unsub = unsubscribeUrl
    ? `<p style="font-size:12px;color:${BRAND.muted2};margin:10px 0 0">Don't want these emails? <a href="${unsubscribeUrl}" style="color:${BRAND.muted2};text-decoration:underline">Turn them off</a>.</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(heading)}</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
<style>
  body,table,td,p,a,li{font-family:${BRAND.font}}
  a{color:${BRAND.green}}
  .card{padding:36px 34px}
  @media only screen and (max-width:620px){
    .wrap{padding:20px 12px !important}
    .card{padding:26px 20px !important}
    .h1{font-size:21px !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.paper2};color:${BRAND.ink};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
<div id="preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper2};opacity:0">${esc(preheader)}${"&zwnj;&nbsp;".repeat(60)}</div>
<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background:${BRAND.paper2}">
  <tr><td align="center" class="wrap" style="padding:32px 16px">
    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%">
      <tr><td style="padding:0 0 22px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px"><a href="${SITE}"><img src="${BRAND.logo}" alt="MyKunda" width="36" height="36" style="border-radius:9px;display:block;border:0"></a></td>
          <td style="font-weight:800;font-size:20px;color:${BRAND.ink};letter-spacing:-.02em"><a href="${SITE}" style="color:${BRAND.ink};text-decoration:none">MyKunda</a></td>
        </tr></table>
      </td></tr>
      <tr><td class="card" style="background:#FFFFFF;border-radius:14px;border:1px solid #EDE9DF;padding:36px 34px">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr><td class="h1" style="font-size:24px;font-weight:800;color:${BRAND.ink};line-height:1.22;letter-spacing:-.01em;padding:0 0 14px">${heading}</td></tr>
          <tr><td style="font-size:15.5px;color:${BRAND.ink2};line-height:1.65">${body}</td></tr>
          <tr><td style="padding:26px 0 0">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${ctaUrl}" style="height:48px;v-text-anchor:middle;width:280px" arcsize="18%" stroke="f" fillcolor="${BRAND.green}"><w:anchorlock/><center style="color:#ffffff;font-family:${BRAND.font};font-size:15px;font-weight:bold">${esc(cta)}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!-- --><a href="${ctaUrl}" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-family:${BRAND.font};font-weight:700;font-size:15px;text-decoration:none;padding:15px 32px;border-radius:9px;mso-hide:all">${esc(cta)}</a><!--<![endif]-->
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 8px 0;text-align:center">
        <p style="font-size:12.5px;color:${BRAND.muted2};line-height:1.55;margin:0">${esc(footer)}</p>
        <p style="font-size:12.5px;color:${BRAND.muted2};margin:10px 0 0">
          <a href="${SITE}" style="color:${BRAND.green};font-weight:700;text-decoration:none">mykunda.com</a> &nbsp;·&nbsp;
          <a href="mailto:${BRAND.email}" style="color:${BRAND.muted2};text-decoration:underline">${BRAND.email}</a> &nbsp;·&nbsp;
          <a href="${BRAND.waLink}" style="color:${BRAND.muted2};text-decoration:underline">WhatsApp ${BRAND.waNumber}</a>
        </p>
        <p style="font-size:12px;color:${BRAND.muted2};margin:10px 0 0">
          <a href="${SITE}/legal-privacy.html" style="color:${BRAND.muted2};text-decoration:underline">Privacy</a> ·
          <a href="${SITE}/legal-terms.html" style="color:${BRAND.muted2};text-decoration:underline">Terms</a> ·
          <a href="${SITE}/legal-cookies.html" style="color:${BRAND.muted2};text-decoration:underline">Cookies</a>
        </p>
        ${unsub}
        <p style="font-size:11.5px;color:${BRAND.muted2};margin:14px 0 0">MyKunda · property platform for The Gambia · Kololi, Serrekunda</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Zaterdag 23 August 2026, 10:00 — altijd in Gambiaanse tijd (UTC+0). */
function formatSlot(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: "Africa/Banjul",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul",
  }).format(d);
  return `${date} at ${time}`;
}

function reminderEmail(o: {
  recipientName?: string | null;
  otherName?: string | null;
  listingTitle?: string | null;
  listingArea?: string | null;
  when: string;
  note?: string | null;
  phase: "24h" | "2h";
  conversationId: string;
  unsubscribeUrl?: string;
}): string {
  const fname = o.recipientName ? esc(String(o.recipientName).trim().split(" ")[0]) : "";
  const other = o.otherName ? esc(String(o.otherName).trim().split(" ")[0]) : "the other party";
  const soon = o.phase === "24h" ? "tomorrow" : "in about two hours";
  const about = o.listingTitle
    ? `<strong>${esc(o.listingTitle)}</strong>${o.listingArea ? " · " + esc(o.listingArea) : ""}`
    : "a property on MyKunda";

  const noteBlock = o.note
    ? `<div style="background:${BRAND.paper};border-left:4px solid ${BRAND.green};border-radius:0 10px 10px 0;padding:15px 20px;margin:18px 0">
         <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Note</p>
         <p style="font-size:15px;color:${BRAND.ink};line-height:1.55;margin:0">${esc(o.note)}</p>
       </div>`
    : "";

  return emailWrap({
    heading: fname ? `${fname}, your viewing is ${soon}` : `Your viewing is ${soon}`,
    preheader: `${o.when} — ${o.listingTitle ?? "viewing on MyKunda"}.`,
    body: `<p style="margin:0 0 6px">You have a viewing ${soon} for ${about}, together with <strong>${other}</strong>.</p>
      <div style="background:${BRAND.paper};border-radius:10px;padding:15px 20px;margin:18px 0">
        <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">When</p>
        <p style="font-size:16px;color:${BRAND.ink};font-weight:700;line-height:1.5;margin:0">${esc(o.when)}</p>
        <p style="font-size:12.5px;color:${BRAND.muted};margin:6px 0 0">Local time in The Gambia (GMT).</p>
      </div>
      ${noteBlock}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Can't make it? Open the conversation and cancel or propose another time, so the other party knows in good time.</p>
      <div style="border-top:1px solid ${BRAND.line};margin-top:22px;padding-top:16px">
        <p style="font-size:14px;color:${BRAND.muted};margin:0"><strong>Stay safe:</strong> meet at the property, bring someone with you if you can, never send money to see a property, and ask to see the title documents.</p>
      </div>`,
    cta: "Open the conversation",
    ctaUrl: `${SITE}/messages.html?c=${encodeURIComponent(o.conversationId)}`,
    footer: "You received this because you agreed a viewing on mykunda.com. You can turn these off in My MyKunda.",
    unsubscribeUrl: o.unsubscribeUrl,
  });
}

async function sendEmail(opts: { to: string; subject: string; html: string; unsubscribeUrl?: string }) {
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
  if (opts.unsubscribeUrl) {
    body.headers = {
      "List-Unsubscribe": `<${opts.unsubscribeUrl}>, <mailto:${BRAND.email}?subject=unsubscribe%20message%20emails>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  /* ÉÉN DEUR (03-09-2026). Enige aanroeper: send_viewing_reminder_mail() uit
     de kwartierlijkse cron, die sinds vandaag de sleutel uit de kluis
     meestuurt. Geen browserpad, dus geen tweede deur. Zonder sleutel in de
     omgeving is de deur dicht; de rij blijft dan staan en wordt het volgende
     kwartier opnieuw geprobeerd — binnen het venster — dus er gaat niets
     verloren, het valt alleen op. */
  if (!SHARED_KEY || !sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { viewing_id, phase } = await req.json().catch(() => ({}));
    if (!viewing_id) return json({ ok: false, error: "missing viewing_id" }, 400);
    if (phase !== "24h" && phase !== "2h") {
      return json({ ok: false, error: "phase must be '24h' or '2h'" }, 400);
    }

    const { data: v, error: vErr } = await db
      .from("viewings")
      .select("id, conversation_id, listing_id, proposer_id, invitee_id, status, chosen_slot, note")
      .eq("id", viewing_id)
      .single();
    if (vErr || !v) return json({ ok: false, error: "viewing not found" }, 404);
    if (v.status !== "confirmed") return json({ ok: true, skipped: "not confirmed" });
    if (!v.chosen_slot) return json({ ok: true, skipped: "no chosen slot" });

    // Venstercontrole — houdt het open endpoint bruikbaar voor cron en
    // waardeloos voor iemand anders.
    const minutesAway = (new Date(v.chosen_slot).getTime() - Date.now()) / 60000;
    const limit = phase === "24h" ? 24 * 60 + 30 : 2 * 60 + 30;
    if (minutesAway < -15 || minutesAway > limit) {
      return json({ ok: true, skipped: "outside reminder window" });
    }

    const { data: listing } = await db
      .from("listings").select("title, area").eq("id", v.listing_id).single();

    const { data: people } = await db
      .from("profiles")
      .select("id, full_name, email, notify_messages, unsubscribe_token")
      .in("id", [v.proposer_id, v.invitee_id]);

    type P = {
      id: string; full_name: string | null; email: string | null;
      notify_messages: boolean | null; unsubscribe_token: string | null;
    };

    const when = formatSlot(v.chosen_slot);
    const subject = phase === "24h"
      ? `Reminder: viewing tomorrow${listing?.title ? ` — ${listing.title}` : ""}`
      : `Reminder: viewing in 2 hours${listing?.title ? ` — ${listing.title}` : ""}`;

    const results: Record<string, string> = {};

    for (const id of [v.proposer_id, v.invitee_id]) {
      const otherId = id === v.proposer_id ? v.invitee_id : v.proposer_id;
      let person = (people ?? []).find((p) => p.id === id) as P | undefined;
      const other = (people ?? []).find((p) => p.id === otherId) as P | undefined;

      /* De opt-out is hier weggehaald op 30-08-2026.
         profiles.notify_messages is de schakelaar voor CHATberichten: "email
         me when someone sends me a message". Wie die uitzet omdat hij niet bij
         elk bericht gemaild wil worden, verloor daarmee ook de herinnering aan
         een afspraak die hij zelf heeft bevestigd — en dat is transactionele
         post, geen nieuwsbrief. Iemand die morgen ergens verwacht wordt hoort
         dat te weten. Wil hij er echt vanaf, dan zegt hij de afspraak af; dat
         kan met één knop in het gesprek.
         De uitschrijflink blijft wel in de mail staan, want die zet alleen de
         berichtmeldingen uit — dat is precies wat hij belooft. */

      if (!person?.email) {
        const { data: authUser } = await db.auth.admin.getUserById(id);
        if (authUser?.user?.email) {
          person = {
            id,
            full_name: person?.full_name ?? (authUser.user.user_metadata?.full_name ?? null),
            email: authUser.user.email,
            notify_messages: person?.notify_messages ?? true,
            unsubscribe_token: person?.unsubscribe_token ?? null,
          };
        }
      }
      if (!person?.email) {
        results[id] = "no email address";
        continue;
      }

      const unsubscribeUrl = person.unsubscribe_token
        ? `${FUNCTIONS_BASE}/unsubscribe?t=${encodeURIComponent(person.unsubscribe_token)}`
        : undefined;

      try {
        await sendEmail({
          to: person.email,
          subject,
          html: reminderEmail({
            recipientName: person.full_name,
            otherName: other?.full_name ?? null,
            listingTitle: listing?.title ?? null,
            listingArea: listing?.area ?? null,
            when,
            note: v.note,
            phase,
            conversationId: v.conversation_id,
            unsubscribeUrl,
          }),
          unsubscribeUrl,
        });
        results[id] = "sent";
      } catch (e) {
        results[id] = `failed: ${String((e as Error)?.message ?? e)}`;
      }
    }

    const anyFailed = Object.values(results).some((r) => r.startsWith("failed"));
    const anySent = Object.values(results).some((r) => r === "sent");

    /* Het stempel wordt hier gezet, ná verzending — niet meer vooraf door de
       cron. run_viewing_reminders() deed dat andersom: eerst
       send_viewing_reminder_mail() (een fire-and-forget pg_net-call waarvan
       de status nooit gelezen werd) en meteen daarna
       `update viewings set reminded_24h_at = now()`. Faalde Resend op dat
       moment, dan stond het stempel er al en werd de herinnering nooit meer
       geprobeerd — de 500 die deze functie netjes teruggeeft verdween in het
       niets.
       Nu blijft de rij zonder stempel staan zolang er niets is verstuurd, en
       pikt de cron van een kwartier later hem gewoon opnieuw op. Binnen het
       venster van 20 tot 24 uur (en van 0 tot 2 uur) levert dat vanzelf een
       aantal herkansingen op, zonder wachtrij en zonder extra machinerie. */
    if (anySent) {
      const kolom = phase === "24h" ? "reminded_24h_at" : "reminded_2h_at";
      const { error: stampErr } = await db
        .from("viewings")
        .update({ [kolom]: new Date().toISOString() })
        .eq("id", v.id);
      if (stampErr) {
        // Niet fataal, maar wel het scenario waarin iemand een tweede
        // herinnering kan krijgen. Daarom luid in de log.
        console.error(`notify-viewing-reminder: ${kolom} niet gezet voor ${v.id}:`, stampErr.message);
      }
    }

    return json({ ok: !anyFailed, phase, stamped: anySent, results }, anyFailed ? 500 : 200);
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    console.error("notify-viewing-reminder error:", message);
    return json({ ok: false, error: message }, 500);
  }
});
