// =====================================================================
// MyKunda - send-payment-instructions
// ---------------------------------------------------------------------
// Mailt de klant zijn referentie en de bankgegevens. De klant staat bij
// de bank, niet achter zijn laptop - zonder mail is hij de referentie
// kwijt tegen de tijd dat hij daadwerkelijk overmaakt, en dan komt zijn
// betaling op de handmatige stapel terecht.
//
// Twee manieren om binnen te komen:
//   1. de klant zelf, met zijn Supabase-token - alleen zijn EIGEN
//      betaling, en hooguit vijf keer per betaling;
//   2. intern, met de service-role sleutel - zo roept create-payment
//      deze functie aan zodra er een bankoverschrijving is aangemaakt,
//      zodat de klant de gegevens altijd per mail krijgt en niet alleen
//      op het scherm.
//
// Bij die INTERNE aanroep gaat er sinds 23-08-2026 ook een melding naar
// de backoffice. Dat was het enige moment in de hele betaalstroom waarop
// er niets naar binnen kwam: de klant kreeg zijn bankgegevens, maar
// niemand bij MyKunda wist dat er een overschrijving onderweg was. Bij
// een vraag van de klant om zijn instructies OPNIEUW te sturen gaat die
// melding bewust niet mee - dat is geen nieuwe bestelling.
//
// HUISBANK: GUARANTY TRUST BANK (GAMBIA) LTD. Tussen 23-08-2026 en
// 25-08-2026 stond hier Ecobank; dat is op 25-08-2026 teruggedraaid - de
// rekening voor bankoverschrijvingen is en blijft die van GT Bank.
// Dezelfde gegevens gaan naar het scherm van de klant via create-payment.
// Sinds 30-08-2026 lezen beide functies ze uit ../_shared/bank.ts, zodat
// er nog maar één plek is om te wijzigen.
//
// De mail gebruikt dezelfde opmaak als alle andere MyKunda-mails:
// dezelfde kleuren, hetzelfde logo, dezelfde voettekst. Juist de mail
// met een rekeningnummer erin moet er onmiskenbaar uitzien als MyKunda.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
// Eén bron voor de bankrekening — zie ../_shared/bank.ts.
import { BANK, USD } from "../_shared/bank.ts";
import { isReservedTestAddress } from "../_shared/email-template.ts";

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://mykunda.com,https://www.mykunda.com"
).split(",").map((s) => s.trim()).filter(Boolean);

const FROM = Deno.env.get("PAYMENTS_FROM") ?? "MyKunda <payments@mykunda.com>";
const REPLY_TO = "admin@mykunda.com";

// Waar de melding voor de backoffice heen gaat. Bewust hetzelfde adres
// als in notify-payment en bewust NIET uit LEAD_EMAIL: info@mykunda.com
// is op 14-08-2026 hard gebounced (blokkade aan de ontvangende kant) en
// een omgevingsvariabele die daar nog naar wijst zou deze melding stil
// laten verdwijnen. Verhuist de mailbox terug, pas dan beide functies aan.
const BACKOFFICE = "admin@mykunda.com";

const GELDIG_DAGEN = Number(Deno.env.get("BANK_REFERENCE_DAYS") ?? "21");
const MAX_MAILS = 5;
const SITE = "https://mykunda.com";

// Bevestigd met de brief "RE: BANKING RELATIONSHIP" van Guaranty Trust
// Bank (Gambia) Limited van 18-08-2026: filiaal Kairaba (code 201),
// rekening 005201300100074795, SWIFT GTBGGMGM.
//
// De tenaamstelling staat twee keer in die brief en niet identiek: het
// dalasi-blok zegt "EDWIN SCHEPERMAN T/A MY KUNDA.COM" (met spatie), het
// USD-correspondentblok "EDWIN SCHEPERMAN T/A MYKUNDA.COM" (zonder).
// Hier staat de versie ZONDER spatie - dat is de begunstigde die meegaat
// bij internationale overboekingen, waar een afwijkende naam tot
// handmatige controle of afwijzing leidt.
//
// GTBGGMGMXXX is de elfcijferige vorm van GTBGGMGM (hoofdkantoor).
// Sommige buitenlandse banken eisen elf tekens, dus beide staan in de
// mail. Gambia kent geen IBAN - een klant die daarom gevraagd wordt,
// heeft genoeg aan SWIFT plus rekeningnummer. Voor USD loopt het via de
// correspondent in Londen, zie USD hieronder.
/* De rekening en de USD-correspondentgegevens stonden hier hardgecodeerd,
   met dezelfde reeks in create-payment. Sinds 30-08-2026 is er één bron:
   ../_shared/bank.ts (geïmporteerd bovenaan). Wijzig daar, en rol deze
   functie én create-payment opnieuw uit. */

// Dezelfde merkwaarden als _shared/email-template.ts.
const BRAND = {
  green: "#15463A",
  amber: "#DD8A45",
  ink: "#18201D",
  ink2: "#384640",
  muted: "#5C6B64",
  muted2: "#8A958E",
  paper: "#FAF8F3",
  paper2: "#F3F0E8",
  line: "#EFEBE1",
  logo: "https://mykunda.com/images/mykunda-icon.png",
  email: "info@mykunda.com",
  waNumber: "+220 228 2717",
  waLink: "https://wa.me/2202282717",
  font: `-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif`,
};

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...headers, "Content-Type": "application/json" },
  });
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Platte-tekstversie naast de HTML - beter leesbaar en beter voor de spamscore. */
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

/** Zelfde kaart, knop en voettekst als _shared/email-template.ts. */
function emailWrap(o: { heading: string; body: string; cta: string; ctaUrl: string; preheader: string; footer: string }): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(o.heading)}</title>
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
<div id="preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${BRAND.paper2};opacity:0">${esc(o.preheader)}${"&zwnj;&nbsp;".repeat(60)}</div>
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
          <tr><td class="h1" style="font-size:24px;font-weight:800;color:${BRAND.ink};line-height:1.22;letter-spacing:-.01em;padding:0 0 14px">${o.heading}</td></tr>
          <tr><td style="font-size:15.5px;color:${BRAND.ink2};line-height:1.65">${o.body}</td></tr>
          <tr><td style="padding:26px 0 0">
            <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${o.ctaUrl}" style="height:48px;v-text-anchor:middle;width:280px" arcsize="18%" stroke="f" fillcolor="${BRAND.green}"><w:anchorlock/><center style="color:#ffffff;font-family:${BRAND.font};font-size:15px;font-weight:bold">${esc(o.cta)}</center></v:roundrect><![endif]-->
            <!--[if !mso]><!-- --><a href="${o.ctaUrl}" style="display:inline-block;background:${BRAND.green};color:#ffffff;font-family:${BRAND.font};font-weight:700;font-size:15px;text-decoration:none;padding:15px 32px;border-radius:9px;mso-hide:all">${esc(o.cta)}</a><!--<![endif]-->
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:24px 8px 0;text-align:center">
        <p style="font-size:12.5px;color:${BRAND.muted2};line-height:1.55;margin:0">${esc(o.footer)}</p>
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
        <p style="font-size:11.5px;color:${BRAND.muted2};margin:14px 0 0">MyKunda · property platform for The Gambia · Kololi, Serrekunda</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function bouwMail(o: { ref: string; bedrag: string; plan: string; vervalt: string }): string {
  const rij = (l: string, w: string) =>
    `<tr>
       <td style="padding:9px 16px 9px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;border-bottom:1px solid ${BRAND.line}">${esc(l)}</td>
       <td style="padding:9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};border-bottom:1px solid ${BRAND.line}">${esc(w)}</td>
     </tr>`;

  const body = `<p style="margin:0 0 6px">Transfer the amount below to our Guaranty Trust Bank account and quote the reference exactly as shown. Without the reference we cannot match your payment to your account.</p>

    <div style="background:${BRAND.paper};border-left:4px solid ${BRAND.amber};border-radius:0 10px 10px 0;padding:16px 20px;margin:20px 0">
      <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Your reference</p>
      <p style="font-size:26px;font-weight:800;letter-spacing:.06em;color:${BRAND.ink};margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${esc(o.ref)}</p>
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 8px">
      ${rij("Amount", "D " + o.bedrag)}
      ${rij("For", o.plan)}
      ${rij("Bank", BANK.bank)}
      ${rij("Account name", BANK.account_name)}
      ${rij("Account number", BANK.account_number)}
      ${rij("Currency", BANK.currency)}
      ${rij("SWIFT / BIC", BANK.swift + " (11 characters: " + BANK.swift_11 + ")")}
      ${rij("Branch", BANK.branch)}
      ${rij("Bank address", BANK.address)}
    </table>

    <p style="margin:14px 0 0;font-size:14px;color:${BRAND.muted}">Sending from abroad? The Gambia does not use IBAN — the SWIFT code and the account number above are all your bank needs. Transfer charges are on top of the amount shown.</p>

    <div style="background:${BRAND.paper};border-radius:10px;padding:14px 18px;margin:14px 0 0">
      <p style="font-size:12px;color:${BRAND.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Paying in USD</p>
      <p style="font-size:13.5px;color:${BRAND.ink2};line-height:1.6;margin:0">Only if your bank sends dollars, give them the correspondent bank as well: <strong>${esc(USD.intermediary_bank)}</strong>, SWIFT <strong>${esc(USD.intermediary_swift)}</strong>, for the account of <strong>${esc(USD.beneficiary_bank)}</strong> (SWIFT ${esc(USD.beneficiary_swift)}, account ${esc(USD.beneficiary_bank_account)}). The beneficiary name and account number stay exactly as above.</p>
    </div>

    <p style="margin:18px 0 0">We confirm your payment by hand once it appears on our statement, usually within 1–2 working days. You get a receipt by email as soon as that is done.</p>
    <p style="margin:12px 0 0;font-size:14px;color:${BRAND.muted}">This reference stays valid until <strong>${esc(o.vervalt)}</strong>. If you have not paid by then, start again on the site and you get a fresh one.</p>

    <div style="border-top:1px solid ${BRAND.line};margin-top:22px;padding-top:16px">
      <p style="font-size:14px;color:${BRAND.muted};margin:0"><strong>Stay safe:</strong> MyKunda only ever charges listing and service fees. We never collect deposits, down payments or the purchase price of a property — those go to the escrow account of your lawyer or notary. Anyone asking you to send purchase money to this account is not us.</p>
    </div>`;

  return emailWrap({
    heading: "How to pay by bank transfer",
    preheader: `Reference ${o.ref} · D ${o.bedrag} · GT Bank`,
    body,
    /* Wees de klant naar zijn eigen bestelling in plaats van naar het
       dashboard in het algemeen. Daar staat wat er met deze referentie
       gebeurt — en zodra de overschrijving is afgeletterd, ook de bon. Zonder
       die link moest hij de mail bewaren om ooit nog iets over MK-XXXXXXX te
       kunnen opzoeken. (31-08-2026) */
    cta: "See this order",
    ctaUrl: `${SITE}/betaling-status.html?ref=${encodeURIComponent(o.ref)}`,
    footer: "You received this because you chose to pay by bank transfer on mykunda.com.",
  });
}

// Melding aan de backoffice: er is een bankoverschrijving geregistreerd.
// Er is op dit moment nog NIETS ontvangen - dit is een seintje om het
// afschrift in de gaten te houden, niet een bevestiging van een betaling.
// Dezelfde toon en opmaak als de "Action required"-mails uit
// notify-payment, zodat de backoffice ze naast elkaar herkent.
function bouwBackofficeMail(o: {
  ref: string; bedrag: string; plan: string; vervalt: string; klant: string | null;
}): string {
  const rij = (l: string, w: string) =>
    `<tr>
       <td style="padding:9px 16px 9px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;border-bottom:1px solid ${BRAND.line}">${esc(l)}</td>
       <td style="padding:9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};border-bottom:1px solid ${BRAND.line}">${esc(w)}</td>
     </tr>`;

  const body = `<div style="background:#FBF1E6;border-left:4px solid ${BRAND.amber};border-radius:0 10px 10px 0;padding:15px 20px;margin:0 0 18px">
      <p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>Action required.</strong> Watch the GT Bank account for <strong>D ${esc(o.bedrag)}</strong> with reference <strong>${esc(o.ref)}</strong>, then confirm the statement line in the admin console. Nothing has been received yet.</p>
    </div>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:0 0 8px">
      ${rij("Reference", o.ref)}
      ${rij("Service", o.plan)}
      ${rij("Amount due", "D " + o.bedrag)}
      ${rij("Method", "Bank transfer")}
      ${rij("Account", BANK.bank + " · " + BANK.account_number)}
      ${rij("Status", "Awaiting bank transfer")}
      ${rij("Reference valid until", o.vervalt)}
      ${rij("Customer", o.klant ?? "unknown")}
    </table>

    <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">The customer has been sent the bank details and this reference. Reply to this email to reach them directly.</p>`;

  return emailWrap({
    heading: "Bank transfer registered",
    preheader: `D ${o.bedrag} · ${o.plan} · ${o.ref} — awaiting transfer`,
    body,
    cta: "Open admin console",
    ctaUrl: `${SITE}/admin.html?ref=${encodeURIComponent(o.ref)}`,
    footer: "Internal notification from the MyKunda website.",
  });
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "mail_not_configured" }, 503, headers);

  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401, headers);

  // Interne aanroep vanuit create-payment: zelfde sleutel als de functie
  // zelf gebruikt, dus alleen bereikbaar vanaf onze eigen kant.
  const internal = token === SERVICE_KEY;

  let userId: string | null = null;
  let userEmail: string | null = null;
  if (!internal) {
    const { data: userData } = await admin.auth.getUser(token);
    if (!userData?.user) return json({ error: "unauthorized" }, 401, headers);
    userId = userData.user.id;
    userEmail = userData.user.email ?? null;
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, headers); }

  const ref = String(body.reference ?? "").toUpperCase().trim();
  if (!/^MK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/.test(ref)) {
    return json({ error: "invalid_reference" }, 400, headers);
  }

  let q = admin.from("payments")
    .select("reference, status, method, amount_minor, created_at, customer_email, plan_id, user_id")
    .eq("reference", ref);
  if (!internal) q = q.eq("user_id", userId!);

  const { data: betaling } = await q.maybeSingle();

  if (!betaling) return json({ error: "not_found" }, 404, headers);
  if (betaling.method !== "bank_transfer") return json({ error: "not_a_bank_transfer" }, 400, headers);
  if (betaling.status !== "pending") return json({ error: "payment_not_open", status: betaling.status }, 409, headers);

  /* Niet eindeloos opnieuw kunnen versturen — maar tel alleen wat er ECHT uit
     is gegaan. Tot 30-08-2026 telde deze query ook de mislukte pogingen mee:
     de logregel wordt namelijk geschreven ongeacht de uitkomst, met
     payload.ok op false. Vijf Resend-fouten op rij — een storing van een half
     uur is genoeg — en de klant kreeg voorgoed 429 terwijl hij nul mails had
     ontvangen en zijn betaalreferentie kwijt was. Dat is precies de klant die
     dit endpoint nodig heeft. Nu telt alleen ok:true mee. */
  const { count } = await admin.from("email_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "payment_instructions")
    .eq("payload->>reference", ref)
    .eq("payload->>ok", "true");
  if ((count ?? 0) >= MAX_MAILS) {
    return json({ error: "sent_too_often", max: MAX_MAILS }, 429, headers);
  }

  // customer_email is sinds 23-08-2026 het adres dat de klant zelf opgaf
  // op het formulier, en create-payment vult het altijd. De terugval
  // hieronder hoort dus nooit meer aan te slaan.
  //
  // Hij blijft wel staan: een klant die per bank betaalt en deze mail
  // niet krijgt, is zijn referentie kwijt tegen de tijd dat hij bij de
  // bank staat, en dan belandt zijn geld op de handmatige stapel. Beter
  // een mail naar het accountadres dan geen mail.
  //
  // Maar hij mag niet STIL gebeuren. Precies deze terugval liet de
  // klantmail eerder naar admin@mykunda.com gaan terwijl er een ander
  // adres was ingevuld, zonder dat er ergens iets van te zien was.
  const schoon = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  let ontvanger = schoon(betaling.customer_email);
  let adresBron = "customer_email";

  if (!ontvanger) {
    ontvanger = schoon(userEmail);
    if (ontvanger) adresBron = "account_session";
  }
  if (!ontvanger && betaling.user_id) {
    const { data: authUser } = await admin.auth.admin.getUserById(betaling.user_id);
    ontvanger = schoon(authUser?.user?.email);
    if (ontvanger) adresBron = "account_lookup";
  }
  if (ontvanger && adresBron !== "customer_email") {
    console.error(
      `send-payment-instructions: customer_email ontbreekt op ${ref} - ` +
      `teruggevallen op het accountadres via ${adresBron}. Dit hoort niet te ` +
      `gebeuren; controleer create-payment.`,
    );
  }

  const { data: plan } = await admin.from("listing_plans")
    .select("name").eq("id", betaling.plan_id).maybeSingle();

  const planNaam = plan?.name ?? betaling.plan_id ?? "MyKunda service";
  // Ruwe waarde voor de administratie in email_events — die blijft "3500.00".
  const bedrag = (betaling.amount_minor / 100).toFixed(2);
  /* Wat de KLANT leest. Tot 31-08-2026 stond hier hetzelfde "D 3500.00" als in
     de administratie: geen duizendtalscheiding en twee nullen die niets zeggen.
     Bij een Verified van D16.000 werd dat "D 16000.00" — een bedrag dat je aan
     de balie van de bank verkeerd overschrijft. De bon en de mislukt-mail uit
     notify_payment_status_change schrijven al "D 3,500"; dit is dezelfde vorm,
     zodat de twee mails over dezelfde bestelling elkaar niet tegenspreken. */
  const bedragTekst = Number(betaling.amount_minor / 100)
    .toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  const vervalt = new Date(
    new Date(betaling.created_at).getTime() + GELDIG_DAGEN * 86_400_000,
  ).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" });

  // --- melding aan de backoffice ---------------------------------------
  // Alleen bij de interne aanroep: dat is het moment waarop de bestelling
  // ontstaat. Vraagt de klant later zelf zijn instructies opnieuw op, dan
  // is dat geen nieuwe bestelling en hoeft er niets naar binnen.
  //
  // Deze mail gaat BEWUST voor de klantmail en los daarvan: ook als de
  // klant geen bruikbaar adres blijkt te hebben, of als Resend zijn mail
  // weigert, moet de backoffice weten dat er een referentie leeft. Een
  // fout hier mag de klantmail nooit tegenhouden - hij wordt alleen
  // gelogd.
  if (internal) {
    try {
      const boHtml = bouwBackofficeMail({
        ref, bedrag: bedragTekst, plan: planNaam, vervalt, klant: ontvanger ?? null,
      });
      const boRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [BACKOFFICE],
          reply_to: ontvanger ?? REPLY_TO,
          subject: `[MyKunda] Bank transfer registered — ${planNaam} · ${ref}`,
          html: boHtml,
          text: toText(boHtml),
        }),
      });
      const boUit = await boRes.json().catch(() => ({}));
      await admin.from("email_events").insert({
        resend_email_id: boUit?.id ?? null,
        event_type: "payment_backoffice",
        recipient: BACKOFFICE,
        subject: `[MyKunda] Bank transfer registered — ${planNaam} · ${ref}`,
        reason: boRes.ok ? null : JSON.stringify(boUit).slice(0, 500),
        payload: { reference: ref, amount_gmd: bedrag, ok: boRes.ok },
      });
      if (!boRes.ok) console.error("backoffice-melding mislukt", boRes.status, boUit);
    } catch (e) {
      console.error("backoffice-melding onbereikbaar", String(e));
    }
  }

  if (!ontvanger) return json({ error: "no_email_address" }, 400, headers);

  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(ontvanger)) {
    console.warn(`send-payment-instructions: gereserveerd testdomein, niet verstuurd — ${ontvanger}`);
    return json({ error: "reserved_test_domain" }, 422, headers);
  }

  const onderwerp = `Payment instructions — ${ref} — MyKunda`;
  const html = bouwMail({ ref, bedrag: bedragTekst, plan: planNaam, vervalt });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [ontvanger],
      reply_to: REPLY_TO,
      subject: onderwerp,
      html,
      text: toText(html),
    }),
  });

  const uitkomst = await res.json().catch(() => ({}));

  await admin.from("email_events").insert({
    resend_email_id: uitkomst?.id ?? null,
    event_type: "payment_instructions",
    recipient: ontvanger,
    subject: onderwerp,
    reason: res.ok ? null : JSON.stringify(uitkomst).slice(0, 500),
    // address_source maakt in de administratie zichtbaar of deze mail naar
    // het opgegeven adres ging of naar het account. Zo is een terugval
    // achteraf terug te vinden met een query in plaats van in de logs.
    payload: { reference: ref, amount_gmd: bedrag, ok: res.ok, internal, address_source: adresBron },
  });

  if (!res.ok) {
    console.error("resend fout", res.status, uitkomst);
    return json({ error: "send_failed" }, 502, headers);
  }

  return json({ ok: true, sent_to: ontvanger, reference: ref }, 200, headers);
});
