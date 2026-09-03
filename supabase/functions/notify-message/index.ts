// ============================================================
//  MyKunda — Edge Function: notify-message
//  Meldt de ontvanger per e-mail dat er een nieuw bericht klaarstaat
//  in Messages. Wordt aangeroepen door de database-trigger
//  public.messages_after_insert() via pg_net, met { message_id }.
//
//  Volgorde van controles (bewust in deze volgorde):
//    1. staat de melding al genoteerd?      → niets doen
//    2. heeft de ontvanger ze uitgezet?     → niets doen
//       (profiles.notify_messages = false)
//    3. is er een e-mailadres?              → anders noteren en stoppen
//    4. throttle claimen (max 1 per gesprek per ontvanger per 15 min)
//    5. versturen
//  Zo wordt de throttle nooit "opgebrand" door een mail die toch
//  niet verstuurd werd.
//
//  Deploy:  supabase functions deploy notify-message --no-verify-jwt
//  Secrets: RESEND_API_KEY, FROM_EMAIL (optioneel)
//
//  Bewust NIET in de mail: het e-mailadres of telefoonnummer van de
//  afzender. Contactgegevens worden pas gedeeld als iemand zelf
//  antwoordt — zie de Privacy Policy. De mail bevat alleen een
//  voornaam, de listing en een korte preview van de tekst.
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

/* Constant-tijd vergelijking, zoals in notify-payment en notify-listing. */
function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
const FUNCTIONS_BASE = "https://jejaerpqltqryqzjvbjp.functions.supabase.co";

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

function escLines(v: unknown): string {
  return esc(v).replace(/\r?\n/g, "<br>");
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

/** Zelfde opzet als _shared/email-template.ts: lichte kaart, bulletproof knop. */
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

function newMessageEmail(o: {
  recipientName?: string | null;
  senderName?: string | null;
  senderIsBuyer: boolean;
  listingTitle?: string | null;
  listingArea?: string | null;
  preview: string;
  conversationId: string;
  unsubscribeUrl?: string;
}): string {
  const fname = o.recipientName ? esc(String(o.recipientName).trim().split(" ")[0]) : "";
  const who = o.senderName
    ? esc(String(o.senderName).trim().split(" ")[0])
    : (o.senderIsBuyer ? "A buyer" : "The seller");
  const about = o.listingTitle
    ? `about <strong>${esc(o.listingTitle)}</strong>${o.listingArea ? " · " + esc(o.listingArea) : ""}`
    : "on MyKunda";

  const quote = o.preview
    ? `<div style="background:${BRAND.paper};border-left:4px solid ${BRAND.green};border-radius:0 10px 10px 0;padding:15px 20px;margin:18px 0">
         <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Message</p>
         <p style="font-size:15px;color:${BRAND.ink};line-height:1.55;margin:0">${escLines(o.preview)}</p>
       </div>`
    : "";

  return emailWrap({
    heading: fname ? `${fname}, you have a new message` : "You have a new message",
    preheader: `${who} sent you a message ${o.listingTitle ? "about " + o.listingTitle : "on MyKunda"}.`,
    body: `<p style="margin:0 0 6px"><strong>${who}</strong> sent you a message ${about}. Open MyKunda to read it and reply.</p>
      ${quote}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Replying to this email does not reach the sender — use the button so your conversation stays inside MyKunda.</p>
      <div style="border-top:1px solid ${BRAND.line};margin-top:22px;padding-top:16px">
        <p style="font-size:14px;color:${BRAND.muted};margin:0"><strong>Stay safe:</strong> never send money to see a property, and ask to see the title documents. Our team can check them for you.</p>
      </div>`,
    cta: "Read and reply",
    ctaUrl: `${SITE}/messages.html?c=${encodeURIComponent(o.conversationId)}`,
    footer: "You received this because someone messaged you about a property on mykunda.com. You can turn these off in My MyKunda.",
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
  // List-Unsubscribe: mailclients tonen dan hun eigen uitschrijfknop, en
  // één klik daarin doet een POST — precies wat de unsubscribe-functie
  // verwacht. Scheelt spamklachten, wat de deliverability beschermt.
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

  /* ÉÉN DEUR (03-09-2026). Deze functie heeft maar één aanroeper: de trigger
     messages_after_insert(), die sinds vandaag de sleutel uit de kluis
     meestuurt, zoals de triggers voor betalingen en advertenties al deden.
     Er is geen browserpad, dus ook geen tweede deur. Tot vandaag kon wie de
     URL en een message_id kende de mail "je hebt een bericht" opnieuw laten
     uitgaan; de rem van 15 minuten in de trigger hielp daar niet tegen, want
     die zit vóór de aanroep, niet erin. Ontbreekt de sleutel in de omgeving,
     dan is de deur dicht — liever een mail die niet vertrekt en opvalt dan
     een poort die stil openstaat. */
  if (!SHARED_KEY || !sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  let claimedConversation: string | null = null;
  let claimedRecipient: string | null = null;

  try {
    const { message_id } = await req.json().catch(() => ({}));
    if (!message_id) return json({ ok: false, error: "missing message_id" }, 400);

    const { data: msg, error: msgErr } = await db
      .from("messages")
      .select("id, conversation_id, sender_id, body, created_at, notified_at")
      .eq("id", message_id)
      .single();
    if (msgErr || !msg) return json({ ok: false, error: "message not found" }, 404);
    if (msg.notified_at) return json({ ok: true, skipped: "already notified" });

    const { data: conv, error: convErr } = await db
      .from("conversations")
      .select("id, listing_id, buyer_id, seller_id")
      .eq("id", msg.conversation_id)
      .single();
    if (convErr || !conv) return json({ ok: false, error: "conversation not found" }, 404);

    const senderIsBuyer = conv.buyer_id === msg.sender_id;
    const recipientId: string = senderIsBuyer ? conv.seller_id : conv.buyer_id;

    const { data: people } = await db
      .from("profiles")
      .select("id, full_name, email, notify_messages, unsubscribe_token")
      .in("id", [recipientId, msg.sender_id]);

    type P = {
      id: string; full_name: string | null; email: string | null;
      notify_messages: boolean | null; unsubscribe_token: string | null;
    };
    let recipient = (people ?? []).find((p) => p.id === recipientId) as P | undefined;
    const sender = (people ?? []).find((p) => p.id === msg.sender_id) as P | undefined;

    // 1) Heeft de ontvanger deze meldingen uitgezet? Dan niets versturen.
    if (recipient && recipient.notify_messages === false) {
      await db.from("messages")
        .update({ notified_at: new Date().toISOString(), notify_error: "recipient opted out of message emails" })
        .eq("id", msg.id);
      return json({ ok: true, skipped: "opted out" });
    }

    // 2) Vangnet: profiel zonder e-mail — haal het adres bij auth op.
    if (!recipient?.email) {
      const { data: authUser } = await db.auth.admin.getUserById(recipientId);
      if (authUser?.user?.email) {
        recipient = {
          id: recipientId,
          full_name: recipient?.full_name ?? (authUser.user.user_metadata?.full_name ?? null),
          email: authUser.user.email,
          notify_messages: recipient?.notify_messages ?? true,
          unsubscribe_token: recipient?.unsubscribe_token ?? null,
        };
      }
    }

    if (!recipient?.email) {
      await db.from("messages")
        .update({ notified_at: new Date().toISOString(), notify_error: "recipient has no email address" })
        .eq("id", msg.id);
      return json({ ok: false, error: "recipient has no email address" }, 422);
    }

    // 3) Throttle — atomair geclaimd in de database, pas nu we zeker weten
    //    dat er ook echt iets te versturen valt.
    const { data: claimed, error: claimErr } = await db.rpc("claim_message_notification", {
      p_conversation_id: conv.id,
      p_recipient_id: recipientId,
    });
    if (claimErr) throw new Error(`claim failed: ${claimErr.message}`);
    if (!claimed) {
      await db.from("messages")
        .update({ notified_at: new Date().toISOString(), notify_error: "throttled (15 min window)" })
        .eq("id", msg.id);
      return json({ ok: true, skipped: "throttled" });
    }
    claimedConversation = conv.id;
    claimedRecipient = recipientId;

    let listingTitle: string | null = null;
    let listingArea: string | null = null;
    if (conv.listing_id) {
      const { data: listing } = await db
        .from("listings")
        .select("title, area")
        .eq("id", conv.listing_id)
        .single();
      listingTitle = listing?.title ?? null;
      listingArea = listing?.area ?? null;
    }

    const trimmed = String(msg.body ?? "").trim();
    const preview = trimmed.slice(0, 300) + (trimmed.length > 300 ? "…" : "");

    const unsubscribeUrl = recipient.unsubscribe_token
      ? `${FUNCTIONS_BASE}/unsubscribe?t=${encodeURIComponent(recipient.unsubscribe_token)}`
      : undefined;

    await sendEmail({
      to: recipient.email,
      subject: listingTitle
        ? `New message about ${listingTitle} — MyKunda`
        : "You have a new message — MyKunda",
      html: newMessageEmail({
        recipientName: recipient.full_name,
        senderName: sender?.full_name ?? null,
        senderIsBuyer,
        listingTitle,
        listingArea,
        preview,
        conversationId: conv.id,
        unsubscribeUrl,
      }),
      unsubscribeUrl,
    });

    await db.from("messages")
      .update({ notified_at: new Date().toISOString(), notify_error: null })
      .eq("id", msg.id);

    return json({ ok: true, sent_to: recipient.email });
  } catch (err) {
    const message = String((err as Error)?.message ?? err);
    console.error("notify-message error:", message);
    // Stempel terugdraaien zodat het volgende bericht opnieuw probeert.
    if (claimedConversation && claimedRecipient) {
      try {
        await db.rpc("reset_message_notification", {
          p_conversation_id: claimedConversation,
          p_recipient_id: claimedRecipient,
        });
      } catch (_) { /* niet fataal */ }
    }
    return json({ ok: false, error: message }, 500);
  }
});
