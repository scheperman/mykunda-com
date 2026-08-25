// ============================================================
//  MyKunda — Edge Function: notify-payment
//  Checkout finishes → a receipt to the customer and an
//  action-required notification to the backoffice. Before this
//  existed, a paid order produced nothing in writing: the buyer
//  saw a screen they could close, and the team was never told.
//
//  Called from checkout.html with the order it just completed —
//  no database row required, so it works whether or not the
//  payments table has been created yet. When the table IS there
//  (backend/payments.sql) every order is also recorded.
//
//  Deploy:  supabase functions deploy notify-payment --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL / LEAD_EMAIL
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paymentReceiptEmail, paymentBackofficeEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const LEAD_EMAIL = Deno.env.get("LEAD_EMAIL") ?? Deno.env.get("ADMIN_EMAIL") ?? "info@mykunda.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

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
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

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

    // 1) Backoffice first — an order must never be invisible to the team.
    try {
      await sendEmail(
        LEAD_EMAIL,
        `[MyKunda] ${info.awaitingTransfer ? "Bank transfer registered" : "Payment received"} — ${info.plan} · ${info.reference}`,
        paymentBackofficeEmail(info),
        info.email || undefined,
      );
      sent.team = true;
    } catch (e) { errors.push(`team: ${(e as Error).message}`); }

    // 2) Receipt to the customer
    if (info.email) {
      try {
        await sendEmail(
          info.email,
          info.awaitingTransfer
            ? `Your payment reference ${info.reference} — MyKunda`
            : `Your receipt — ${info.plan} — MyKunda`,
          paymentReceiptEmail(info),
          LEAD_EMAIL,
        );
        sent.receipt = true;
      } catch (e) { errors.push(`receipt: ${(e as Error).message}`); }
    }

    // 3) Optional audit row — silently skipped when the table doesn't exist.
    if (SUPABASE_URL && SERVICE_KEY) {
      try {
        const db = createClient(SUPABASE_URL, SERVICE_KEY);
        await db.from("payments").insert({
          reference: info.reference,
          plan: info.plan,
          amount_display: info.amount,
          method: info.method,
          status: info.awaitingTransfer ? "awaiting_transfer" : "paid",
          name: info.name,
          email: info.email,
          phone: info.phone,
          payload: p,
        });
      } catch (_) { /* no payments table — emails already went out */ }
    }

    return json({ ok: errors.length === 0, sent, errors }, errors.length ? 502 : 200);
  } catch (err) {
    console.error("notify-payment error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
