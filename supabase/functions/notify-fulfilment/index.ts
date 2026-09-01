// =====================================================================
// MyKunda - notify-fulfilment
// ---------------------------------------------------------------------
// Vertelt de KOPER hoe zijn titelcontrole ervoor staat.
//
// Waarom deze functie bestaat: payments.status gaat over geld en daar
// hing alle klantmail aan. Zodra de bon verstuurd was, hoorde de koper
// niets meer - terwijl het werk dan pas begint. Op verify.html staat met
// zoveel woorden dat we bewust geen doorlooptijd beloven en dat de koper
// altijd mag vragen waar het staat. Dan is stilte na de bon precies de
// verkeerde keuze.
//
// De tweede as is payments.fulfilment_status, gezet vanuit de Orders-
// weergave in de admin console. Deze functie hangt aan die kolom, niet
// aan de betaalstatus.
//
// WAT ER BEWUST NIET IN ZIT
//   - 'cancelled' stuurt niets. Een geannuleerde of terugbetaalde
//     bestelling is boekhoudkundig werk met een eigen gesprek; een
//     automatische mail zou daar dwars doorheen kunnen lopen.
//   - 'new' stuurt niets. Dat is de begintoestand, geen gebeurtenis.
//   - Alleen titelcontroles. Een Boost heeft geen werkstroom en de koper
//     zou niet weten waar de mail over gaat. De trigger filtert daarop,
//     en deze functie controleert het nog een keer zelf.
//
// Elke fase gaat hooguit EEN keer de deur uit. Zet iemand een bestelling
// heen en weer, dan krijgt de klant daar geen mail van - dat is een
// vergissing van de backoffice, geen nieuws voor de koper.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { isReservedTestAddress } from "../_shared/email-template.ts";

const SITE = "https://mykunda.com";
const FROM = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const REPLY_TO = "admin@mykunda.com";

const SHARED_KEY  = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// De fasen waar een koper iets aan heeft, met de tekst die erbij hoort.
const STAGES: Record<string, {
  heading: string; preheader: string; lead: string; body: string; cta: string;
}> = {
  in_progress: {
    heading: "We have started your check",
    preheader: "Your ownership check is under way.",
    lead: "Your payment is in and the work has begun.",
    body:
      `<p style="margin:0 0 12px">Here is what happens now. We read the documents that exist for the property, we run the searches that belong to the check you bought, and where the check includes it we go and look at the land itself.</p>
       <p style="margin:0 0 12px">We deliberately do not put a date on it, and we would be wary of anyone who does. Registry offices, surveyors and sellers in The Gambia move at their own pace, and a check that waits on a third party cannot be hurried by promising you a deadline. What we do promise: we have started, you can ask where it stands at any moment, and if something is blocked you hear it from us rather than finding out later.</p>
       <p style="margin:0">Reply to this email if anything changes on your side &mdash; a deposit deadline, a new document, a seller who suddenly wants to move fast. That is exactly the kind of thing that changes how we prioritise your check.</p>`,
    cta: "See where your check stands",
  },
  report_sent: {
    heading: "Your report is on its way",
    preheader: "The findings of your ownership check have been sent.",
    lead: "The check is finished and the report has been sent to you.",
    body:
      `<p style="margin:0 0 12px">It comes as a separate email, because a report is a document and not a status line. If it has not reached you within a few minutes, look in your spam folder first and then reply here &mdash; we will send it again.</p>
       <p style="margin:0 0 12px">Read it with your lawyer, not instead of one. This check is built to be handed straight to them so they start from evidence rather than from scratch; it does not replace the final title search and conveyancing at completion.</p>
       <p style="margin:0">Treat the findings as a snapshot of the day we looked. Registry records change, so if months pass between this report and completion, ask your lawyer to run the search again before money moves.</p>`,
    cta: "See this order",
  },
  done: {
    heading: "Your check is complete",
    preheader: "Your ownership check is closed.",
    lead: "Everything we owed you on this order has been delivered.",
    body:
      `<p style="margin:0 0 12px">We are closing it in our system. That is bookkeeping, not a door shutting: if a question comes up about the report next week or next month, reply to this email and we will pick it back up.</p>
       <p style="margin:0"><strong>One thing worth repeating.</strong> MyKunda only ever charges for listings and services. We never collect deposits, down payments or the purchase price of a property &mdash; those belong in the escrow account of your lawyer or notary. Anyone who tells you otherwise, using our name, is not us.</p>`,
    cta: "See this order",
  },
};

const BRAND = {
  green: "#15463A", amber: "#DD8A45", ink: "#18201D", ink2: "#384640",
  muted: "#5C6B64", muted2: "#8A958E", paper: "#FAF8F3", paper2: "#F3F0E8",
  line: "#EFEBE1", logo: "https://mykunda.com/images/mykunda-icon.png",
  email: "info@mykunda.com", waNumber: "+220 272 0268", waLink: "https://wa.me/2202720268",
  font: `-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif`,
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
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
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&mdash;/g, "-")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .split("\n").map((l) => l.trim())
    .filter((l, i, a) => l !== "" || (a[i - 1] ?? "") !== "")
    .join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Zelfde kaart, knop en voettekst als de andere MyKunda-mails. */
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

function bouwMail(o: {
  stage: string; ref: string; plan: string; naam: string | null; waar: string | null;
}): string {
  const s = STAGES[o.stage];
  const rij = (l: string, w: string) =>
    `<tr>
       <td style="padding:9px 16px 9px 0;color:${BRAND.muted};font-size:14px;white-space:nowrap;border-bottom:1px solid ${BRAND.line}">${esc(l)}</td>
       <td style="padding:9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};border-bottom:1px solid ${BRAND.line}">${esc(w)}</td>
     </tr>`;

  const groet = o.naam ? `<p style="margin:0 0 14px">Hello ${esc(o.naam)},</p>` : "";

  const body = `${groet}
    <p style="margin:0 0 6px;font-size:16px;color:${BRAND.ink};font-weight:600">${esc(s.lead)}</p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin:18px 0 20px">
      ${rij("Your reference", o.ref)}
      ${rij("Service", o.plan)}
      ${o.waar ? rij("Property", o.waar) : ""}
    </table>

    ${s.body}`;

  return emailWrap({
    heading: s.heading,
    preheader: `${s.preheader} · ${o.ref}`,
    body,
    cta: s.cta,
    ctaUrl: `${SITE}/betaling-status.html?ref=${encodeURIComponent(o.ref)}`,
    footer: "You received this because you ordered an ownership check on mykunda.com.",
  });
}

// Zelfde slot als notify-payment: staat het secret niet in de omgeving,
// dan laten we alles door en waarschuwen we alleen, zodat er niets breekt
// op het moment van uitrollen.
function toegestaan(req: Request): boolean {
  if (!SHARED_KEY) return true;
  const k = req.headers.get("x-notify-key") ?? "";
  if (k && k === SHARED_KEY) return true;
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return !!token && !!SERVICE_KEY && token === SERVICE_KEY;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  if (!toegestaan(req)) {
    console.warn("notify-fulfilment geweigerd: geen geldige sleutel");
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!SHARED_KEY) {
    console.warn("NOTIFY_SHARED_KEY staat niet in de omgeving - notify-fulfilment is open voor iedereen die het adres kent.");
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ ok: false, error: "mail_not_configured" }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }

  const ref = String(p.reference ?? "").toUpperCase().trim();
  const stage = String(p.stage ?? "").trim();

  if (!/^MK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/.test(ref)) {
    return json({ ok: false, error: "invalid_reference" }, 400);
  }
  if (!STAGES[stage]) {
    // Geen fout: 'new' en 'cancelled' horen hier gewoon niets te doen.
    return json({ ok: true, skipped: "stage_without_message", stage }, 200);
  }

  const { data: betaling } = await admin
    .from("payments")
    .select("reference, status, plan_id, customer_email, metadata, fulfilment_status")
    .eq("reference", ref)
    .maybeSingle();

  if (!betaling) return json({ ok: false, error: "not_found" }, 404);

  // Alleen als er ook echt betaald is. Werk aan een onbetaalde bestelling
  // hoort niet te bestaan, en een mail erover al helemaal niet.
  if (betaling.status !== "succeeded") {
    return json({ ok: true, skipped: "not_paid", status: betaling.status }, 200);
  }

  // Tweede controle op het producttype, los van de trigger. Wie deze
  // functie ooit met de hand aanroept, mag een Boost-koper geen mail over
  // een titelcontrole sturen.
  const { data: plan } = await admin
    .from("listing_plans").select("name, kind").eq("id", betaling.plan_id).maybeSingle();
  if (!plan || plan.kind !== "title_check") {
    return json({ ok: true, skipped: "not_a_title_check", plan_id: betaling.plan_id }, 200);
  }

  const ontvanger = betaling.customer_email;
  if (!ontvanger) {
    console.error("notify-fulfilment: geen customer_email op", ref);
    return json({ ok: false, error: "no_email_address", reference: ref }, 400);
  }

  // Elke fase hooguit een keer — en dat moet de DATABASE afdwingen, niet
  // een controle vooraf. Twee statuswijzigingen binnen dezelfde seconde
  // lazen allebei de logtabel voordat de ander erin had geschreven, en
  // stuurden allebei dezelfde mail (gemeten 23-08-2026, 0,4 seconde uit
  // elkaar). Daarom claimen we de plek eerst met een insert: op
  // email_events ligt een unieke index over referentie + fase, dus wie de
  // regel wint stuurt de mail en de ander krijgt hier een conflict.
  const { data: claim, error: claimErr } = await admin
    .from("email_events")
    .insert({
      event_type: "fulfilment_progress",
      recipient: ontvanger,
      subject: null,
      payload: { reference: ref, stage, ok: null },
    })
    .select("id")
    .single();

  if (claimErr || !claim) {
    // 23505 = unieke index geraakt: een ander verzoek was ons voor.
    if ((claimErr as any)?.code === "23505") {
      return json({ ok: true, skipped: "already_sent", reference: ref, stage }, 200);
    }
    console.error("notify-fulfilment kon de regel niet claimen", claimErr);
    return json({ ok: false, error: "could_not_claim", reference: ref, stage }, 500);
  }

  const meta = (betaling.metadata ?? {}) as Record<string, any>;
  const intake = (meta.ownership_intake ?? {}) as Record<string, any>;
  // De naam en het pand zoals de KOPER ze opgaf. Het account waarmee hij
  // inlogde kan van iemand anders zijn.
  const naam = typeof intake.name === "string" && intake.name.trim() ? intake.name.trim() : null;
  const waar = typeof intake.where === "string" && intake.where.trim() ? intake.where.trim() : null;
  const planNaam = plan.name ?? betaling.plan_id ?? "Ownership check";

  const onderwerp = `${STAGES[stage].heading} — ${ref} — MyKunda`;
  const html = bouwMail({ stage, ref, plan: planNaam, naam, waar });

  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(ontvanger)) {
    console.warn(`notify-fulfilment: gereserveerd testdomein, niet verstuurd — ${ontvanger}`);
    return json({ ok: false, error: "reserved_test_domain", reference: ref, stage }, 422);
  }

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

  const uit = await res.json().catch(() => ({}));

  // De geclaimde regel afmaken met wat er werkelijk gebeurd is.
  await admin.from("email_events").update({
    resend_email_id: uit?.id ?? null,
    subject: onderwerp,
    reason: res.ok ? null : JSON.stringify(uit).slice(0, 500),
    payload: { reference: ref, stage, ok: res.ok },
  }).eq("id", claim.id);

  if (!res.ok) {
    // De claim blijft staan. Dat is met opzet: bij een fout van de
    // mailserver willen we niet dat de volgende statuswissel het nog een
    // keer probeert en de klant alsnog een late mail krijgt over een fase
    // die allang voorbij is. De mislukking staat in email_events en op
    // die manier zichtbaar in de administratie.
    console.error("notify-fulfilment resend fout", res.status, uit);
    return json({ ok: false, error: "send_failed", reference: ref, stage }, 502);
  }

  return json({ ok: true, sent_to: ontvanger, reference: ref, stage }, 200);
});
