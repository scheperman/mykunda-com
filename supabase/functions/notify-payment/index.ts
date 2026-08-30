// ============================================================
//  MyKunda — Edge Function: notify-payment
//  A payment is confirmed → a receipt to the customer and an
//  action-required notification to the backoffice.
//
//  Deploy:  supabase functions deploy notify-payment --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL / LEAD_EMAIL
//
//  *** RECIPIENT OVERRIDE — 2026-08-16 ***
//  info@mykunda.com hard-bounced on 2026-08-14 (Cloud86 blocklist on the
//  receiving side). Between 14-08 and 16-08 this constant pointed at a
//  private Gmail address; it now points at admin@mykunda.com, a working
//  Google Workspace address on the same domain. Backoffice notification ->
//  LEAD_EMAIL; the payment receipt -> the customer's own address.
//  To move back to info@mykunda.com once Cloud86 is resolved, restore:
//    const LEAD_EMAIL = Deno.env.get("LEAD_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "info@mykunda.com";
//
//  *** TOEGANG — 2026-08-23 ***
//  verify_jwt staat op false, dus de Supabase-gateway laat iedereen door.
//  Zonder eigen controle kon dus ook iedereen die het adres kende mail
//  laten versturen vanaf noreply@mykunda.com, naar een adres naar keuze
//  en naar onze eigen backoffice. Dat is een risico voor de
//  afzenderreputatie van het domein, niet alleen voor de inbox.
//
//  Deze functie controleert nu zelf wie er belt. Twee sleutels werken:
//    * de header x-notify-key met de waarde van NOTIFY_SHARED_KEY — zo
//      belt de databasetrigger payments_notify_status via pg_net;
//    * Authorization: Bearer <service role key> — zo blijft een aanroep
//      met supabase-js (functions.invoke) vanuit een andere edge function
//      gewoon werken.
//
//  Zolang NOTIFY_SHARED_KEY NIET in de omgeving staat, laat de functie
//  alles door en waarschuwt ze alleen in de logs. Dat is met opzet: zo
//  breekt er niets op het moment van uitrollen. Het slot gaat pas echt
//  dicht zodra dat secret gezet is.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  paymentReceiptEmail,
  paymentBackofficeEmail,
  toText,
  emailWrap,
  detailTable,
  callout,
  esc,
  BRAND, isReservedTestAddress,
} from "../_shared/email-template.ts";
import type { PaymentInfo } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const LEAD_EMAIL = "admin@mykunda.com";

const SHARED_KEY = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// *** ADMINISTRATIE - 2026-08-23 ***
// Deze functie verstuurt vier soorten mail (de bon, de "niet gelukt"-mail,
// de "referentie verlopen"-mail en de bijbehorende backofficemeldingen) en
// legde daar niets van vast. Alleen send-payment-instructions en
// notify-fulfilment schreven naar email_events.
//
// Dat is meer dan een ontbrekend logboek. resend-webhook koppelt een bounce
// op resend_email_id en schrijft die weg als een LOSSE regel; hij zoekt de
// verzendregel niet op. Zonder verzendregel houd je bij een bounce een
// e-mailadres over en verder niets: geen referentie, geen bestelling, geen
// manier om te zien wiens bon nooit is aangekomen.
//
// Loggen mag nooit de mail tegenhouden. Als de klant zijn bon heeft, is dat
// het belangrijkste dat er gebeurd is; een mislukte insert wordt alleen
// weggeschreven naar de logs.
const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

if (!SHARED_KEY) {
  console.warn(
    "NOTIFY_SHARED_KEY staat niet in de omgeving — notify-payment is open " +
    "voor iedereen die het adres kent. Zet dit secret om dat te sluiten.",
  );
}

// Vergelijking die geen informatie lekt via de duur van de vergelijking.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toegestaan(req: Request): boolean {
  // Nog niet ingeschakeld: gedraag je precies zoals voorheen.
  if (!SHARED_KEY) return true;

  const eigen = req.headers.get("x-notify-key") ?? "";
  if (eigen && timingSafeEqual(eigen, SHARED_KEY)) return true;

  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (SERVICE_KEY && bearer && timingSafeEqual(bearer, SERVICE_KEY)) return true;

  return false;
}

// Uitkomsten waarbij de klant NIET betaald heeft. Zonder outcome in de
// body blijft het gedrag van deze functie precies zoals het was.
const FAILED_OUTCOMES = ["failed", "cancelled", "expired"];

const OUTCOME_LABELS: Record<string, string> = {
  failed: "Payment failed",
  cancelled: "Payment cancelled",
  expired: "Payment reference expired",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(to)) {
    throw new Error(`reserved test domain, not sent: ${to}`);
  }

  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html, text: toText(html) };
  if (replyTo) body.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // Het antwoord gaat mee omhoog: bij succes staat het Resend-id erin (nodig
  // om een bounce later aan deze mail te koppelen), bij een fout de reden.
  const uit = await r.json().catch(() => ({} as Record<string, unknown>));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${JSON.stringify(uit)}`);
  return uit as { id?: string };
}

/* Waar ging deze mail feitelijk heen: naar het adres dat de koper zelf
   opgaf, of naar het account waarmee hij inlogde? Dezelfde vraag en
   dezelfde woorden als in send-payment-instructions, zodat een query over
   email_events beide kanten van de klantmail laat zien.

   Bewust hier opgezocht en niet meegegeven door de trigger: een plek die
   het weet veroudert niet, twee plekken lopen uit elkaar. */
async function adresBronVoor(reference: string, ontvanger: string | null | undefined) {
  if (!ontvanger) return { source: "no_address", plan_id: null as string | null };
  try {
    const { data } = await admin
      .from("payments")
      .select("customer_email, plan_id, metadata")
      .eq("reference", reference)
      .maybeSingle();
    if (!data) return { source: "unknown_reference", plan_id: null as string | null };

    const norm = (v: unknown) => (typeof v === "string" ? v.trim().toLowerCase() : "");
    const klant = norm(data.customer_email);
    const account = norm((data.metadata as Record<string, unknown> | null)?.account_email);
    const naar = norm(ontvanger);

    // caller_supplied hoort niet voor te komen: dat betekent dat er gemaild
    // is naar een adres dat niet bij deze betaling hoort, en dat kan alleen
    // als iemand deze functie rechtstreeks aanroept.
    let source = "caller_supplied";
    if (naar && naar === klant) source = "customer_email";
    else if (naar && naar === account) source = "account";
    return { source, plan_id: (data.plan_id as string | null) ?? null };
  } catch (e) {
    console.error("notify-payment: adresbron niet vast te stellen", String(e));
    return { source: "lookup_failed", plan_id: null as string | null };
  }
}

/* Een regel per verstuurde mail, ook per MISLUKTE mail. Zie het blok
   bovenaan: zonder verzendregel is een bounce niet te herleiden. */
async function logMail(o: {
  eventType: string;
  recipient: string;
  subject: string;
  ok: boolean;
  resendId?: string | null;
  reason?: string | null;
  extra?: Record<string, unknown>;
}) {
  try {
    await admin.from("email_events").insert({
      resend_email_id: o.resendId ?? null,
      event_type: o.eventType,
      recipient: o.recipient,
      subject: o.subject,
      reason: o.ok ? null : String(o.reason ?? "").slice(0, 500),
      payload: { ok: o.ok, ...(o.extra ?? {}) },
    });
  } catch (e) {
    console.error("notify-payment: kon email_events niet schrijven", String(e));
  }
}

// Mislukt, geannuleerd of verlopen. Zelfde gedeelde opmaak als de bon
// (logo, voettekst, plain text via toText), alleen een andere boodschap:
// er is niets afgeschreven en opnieuw beginnen kan gewoon.
function paymentFailedEmail(p: PaymentInfo, outcome: string): string {
  const fname = p.name ? esc(String(p.name).trim().split(" ")[0]) : "";
  const expired = outcome === "expired";

  const intro = expired
    ? `Thanks${fname ? ", " + fname : ""} — your payment reference <strong>${esc(p.reference)}</strong> for <strong>${esc(p.plan)}</strong> has expired, so it can no longer be used. You have not been charged. Nothing is lost — a new reference is created in a minute.`
    : `Thanks${fname ? ", " + fname : ""} — the payment for <strong>${esc(p.plan)}</strong> did not complete, and you have not been charged. Nothing is lost — you can start it again whenever it suits you.`;

  return emailWrap({
    heading: expired ? "Your payment reference has expired" : "Your payment did not go through",
    preheader: expired
      ? `Reference ${p.reference} has expired — a new one takes a minute.`
      : `The payment for ${p.plan} did not complete — you have not been charged.`,
    body: `<p style="margin:0 0 16px">${intro}</p>
      ${detailTable([
        ["Reference", `<strong>${esc(p.reference)}</strong>`],
        ["Service", esc(p.plan)],
        ["Amount", `<strong>${esc(p.amount)}</strong>`],
      ])}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>MyKunda only ever charges listing and service fees.</strong> We never collect a deposit, a down payment or the purchase price of a property. Anyone asking you to send property money through us is not us — tell us straight away.</p>`)}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Not sure what went wrong? Reply to this email with your reference, or WhatsApp <a href="${BRAND.waLink}" style="color:${BRAND.green};font-weight:600">${BRAND.waNumber}</a>.</p>`,
    cta: "Try again",
    ctaUrl: "https://mykunda.com/dashboard.html",
    footer: "You received this because you started a payment on mykunda.com.",
  });
}

/* Terugbetaling. Nieuw op 30-08-2026.
   'refunded' viel bewust buiten de trigger, met als reden: "een terugbetaling
   is boekhoudkundig werk met een eigen bericht, geen automatische bon". Dat
   eigen bericht was alleen nooit gebouwd, en payment_refunds_sync_status() zet
   de status om zonder enige melding. De klant kreeg zijn geld terug zonder één
   regel schriftelijk — en de backoffice had achteraf geen spoor per mail.
   Dit is geen bon: het is een bevestiging dat het geld onderweg is, met de
   termijn die banken en wallets in de praktijk nemen. */
function paymentRefundEmail(p: PaymentInfo, refundAmount?: string): string {
  const fname = p.name ? esc(String(p.name).trim().split(" ")[0]) : "";
  const bedrag = refundAmount || p.amount;
  const perBank = /bank/i.test(String(p.method));
  return emailWrap({
    heading: "Your refund is on its way",
    preheader: `${bedrag} is being returned to you — reference ${p.reference}.`,
    body: `<p style="margin:0 0 16px">Thanks${fname ? ", " + fname : ""} — we have refunded <strong>${esc(bedrag)}</strong> for <strong>${esc(p.plan)}</strong>. It goes back to the ${perBank ? "account you transferred from" : "same method you paid with"}.</p>
      ${detailTable([
        ["Reference", `<strong>${esc(p.reference)}</strong>`],
        ["Service", esc(p.plan)],
        ["Refunded", `<strong>${esc(bedrag)}</strong>`],
        ["Back to", esc(p.method)],
      ])}
      ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>When you will see it.</strong> Mobile money is usually the same day. A card refund takes ${"5 to 10 working days"} to appear on your statement, and a bank transfer depends on your bank. If it has not arrived after that, reply to this email with your reference and we will chase it.</p>`)}
      <p style="margin:16px 0 0;font-size:14px;color:${BRAND.muted}">Keep this email: together with your original receipt it is the full record of this order.</p>`,
    cta: "See this order",
    ctaUrl: `https://mykunda.com/betaling-status.html?ref=${encodeURIComponent(p.reference)}`,
    footer: "You received this because you paid for a service on mykunda.com.",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!toegestaan(req)) {
    console.warn("notify-payment geweigerd: geen geldige sleutel");
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  try {
    const p = await req.json().catch(() => ({}));
    if (!p || !p.reference || !p.plan) return json({ ok: false, error: "missing reference or plan" }, 400);

    const info = {
      name: p.name || undefined,
      email: p.email || undefined,
      phone: p.phone || undefined,
      plan: String(p.plan),
      planNote: p.planNote || undefined,
      reference: String(p.reference),
      amount: String(p.amount ?? ""),
      method: String(p.method ?? "—"),
      awaitingTransfer: !!p.awaitingTransfer,
      bank: p.bank || undefined,
      date: p.date || new Date().toISOString(),
    };

    const errors: string[] = [];
    const sent = { team: false, receipt: false };

    // Een keer opzoeken, daarna hergebruikt door alle logregels hieronder.
    const bron = await adresBronVoor(info.reference, info.email);
    const logExtra = {
      reference: info.reference,
      plan_id: bron.plan_id,
      source: String(p.source ?? "direct"),
    };

    // Mislukte betaling: eigen mail naar de klant en een melding naar de
    // backoffice, daarna klaar. De bon-route hieronder blijft ongemoeid.
    const outcome = String(p.outcome ?? "").toLowerCase();

    /* Terugbetaling: eigen bericht aan de klant, eigen melding aan de
       backoffice. Zie de notitie bij paymentRefundEmail. */
    if (outcome === "refunded") {
      const refundBedrag = typeof p.refund_amount === "string" ? p.refund_amount : undefined;

      const teamOnderwerp = `[MyKunda] Refund sent — ${info.plan} · ${info.reference}`;
      try {
        const uit = await sendEmail(
          LEAD_EMAIL,
          teamOnderwerp,
          paymentRefundEmail(info, refundBedrag),
          info.email || undefined,
        );
        sent.team = true;
        await logMail({
          eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: teamOnderwerp,
          ok: true, resendId: uit?.id ?? null, extra: { ...logExtra, outcome },
        });
      } catch (e) {
        errors.push(`team: ${(e as Error).message}`);
        await logMail({
          eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: teamOnderwerp,
          ok: false, reason: (e as Error).message, extra: { ...logExtra, outcome },
        });
      }

      if (info.email) {
        const onderwerp = `Your refund — ${info.plan} — MyKunda`;
        try {
          const uit = await sendEmail(info.email, onderwerp, paymentRefundEmail(info, refundBedrag), LEAD_EMAIL);
          sent.receipt = true;
          await logMail({
            eventType: "payment_refund_notice", recipient: info.email, subject: onderwerp,
            ok: true, resendId: uit?.id ?? null,
            extra: { ...logExtra, outcome, address_source: bron.source },
          });
        } catch (e) {
          errors.push(`klant: ${(e as Error).message}`);
          await logMail({
            eventType: "payment_refund_notice", recipient: info.email, subject: onderwerp,
            ok: false, reason: (e as Error).message,
            extra: { ...logExtra, outcome, address_source: bron.source },
          });
        }
      }

      return json({ ok: errors.length === 0, outcome, sent, errors }, errors.length ? 502 : 200);
    }

    if (FAILED_OUTCOMES.includes(outcome)) {
      {
        const onderwerp = `[MyKunda] ${OUTCOME_LABELS[outcome]} — ${info.plan} · ${info.reference}`;
        try {
          // outcome gaat mee: zonder die parameter kreeg de backoffice bij een
          // MISLUKTE betaling een groene "Payment received / Status: Paid /
          // Activate this order"-mail. Zie de notitie bij paymentBackofficeEmail.
          const uit = await sendEmail(LEAD_EMAIL, onderwerp, paymentBackofficeEmail(info, outcome as "failed" | "cancelled" | "expired"), info.email || undefined);
          sent.team = true;
          await logMail({
            eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: onderwerp,
            ok: true, resendId: uit?.id ?? null, extra: { ...logExtra, outcome },
          });
        } catch (e) {
          errors.push(`team: ${(e as Error).message}`);
          await logMail({
            eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: onderwerp,
            ok: false, reason: (e as Error).message, extra: { ...logExtra, outcome },
          });
        }
      }

      if (info.email) {
        const onderwerp = outcome === "expired"
          ? `Your payment reference has expired — MyKunda`
          : `Your payment did not go through — MyKunda`;
        try {
          const uit = await sendEmail(info.email, onderwerp, paymentFailedEmail(info, outcome), LEAD_EMAIL);
          sent.receipt = true;
          await logMail({
            eventType: "payment_failed_notice", recipient: info.email, subject: onderwerp,
            ok: true, resendId: uit?.id ?? null,
            extra: { ...logExtra, outcome, address_source: bron.source },
          });
        } catch (e) {
          errors.push(`failure notice: ${(e as Error).message}`);
          await logMail({
            eventType: "payment_failed_notice", recipient: info.email, subject: onderwerp,
            ok: false, reason: (e as Error).message,
            extra: { ...logExtra, outcome, address_source: bron.source },
          });
        }
      }

      return json({ ok: errors.length === 0, outcome, sent, errors }, errors.length ? 502 : 200);
    }

    {
      const onderwerp = `[MyKunda] ${info.awaitingTransfer ? "Bank transfer registered" : "Payment received"} — ${info.plan} · ${info.reference}`;
      try {
        const uit = await sendEmail(LEAD_EMAIL, onderwerp, paymentBackofficeEmail(info), info.email || undefined);
        sent.team = true;
        await logMail({
          eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: onderwerp,
          ok: true, resendId: uit?.id ?? null,
          extra: { ...logExtra, awaiting_transfer: info.awaitingTransfer },
        });
      } catch (e) {
        errors.push(`team: ${(e as Error).message}`);
        await logMail({
          eventType: "payment_backoffice", recipient: LEAD_EMAIL, subject: onderwerp,
          ok: false, reason: (e as Error).message,
          extra: { ...logExtra, awaiting_transfer: info.awaitingTransfer },
        });
      }
    }

    if (info.email) {
      const onderwerp = info.awaitingTransfer
        ? `Your payment reference ${info.reference} — MyKunda`
        : `Your receipt — ${info.plan} — MyKunda`;
      try {
        const uit = await sendEmail(info.email, onderwerp, paymentReceiptEmail(info), LEAD_EMAIL);
        sent.receipt = true;
        await logMail({
          eventType: "payment_receipt", recipient: info.email, subject: onderwerp,
          ok: true, resendId: uit?.id ?? null,
          extra: { ...logExtra, amount: info.amount, method: info.method,
                   awaiting_transfer: info.awaitingTransfer, address_source: bron.source },
        });
      } catch (e) {
        errors.push(`receipt: ${(e as Error).message}`);
        await logMail({
          eventType: "payment_receipt", recipient: info.email, subject: onderwerp,
          ok: false, reason: (e as Error).message,
          extra: { ...logExtra, amount: info.amount, method: info.method,
                   awaiting_transfer: info.awaitingTransfer, address_source: bron.source },
        });
      }
    }

    return json({ ok: errors.length === 0, sent, errors }, errors.length ? 502 : 200);
  } catch (err) {
    console.error("notify-payment error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
