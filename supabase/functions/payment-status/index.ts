// =====================================================================
// MyKunda - payment-status
// ---------------------------------------------------------------------
// De bedankpagina vraagt hier de status op in plaats van te vertrouwen
// op het feit dat de klant is teruggekeerd. Nodig omdat op een wegvallende
// 4G-verbinding twee dingen misgaan:
//   1. de klant komt nooit terug op de return_url, of
//   2. hij is er eerder dan de webhook van Waychit.
// In beide gevallen is de database de waarheid, niet de browser.
//
// verify_jwt staat op false bij de gateway; het token wordt hieronder zelf
// gecontroleerd zodat de CORS-preflight niet stukloopt.
//
// *** VOORTGANG NA DE BETALING - 23-08-2026 ***
// Deze functie ging alleen over geld. Bij een titelcontrole is dat pas de
// helft: als de betaling rond is, begint het werk. Op verify.html staat
// dat we bewust geen doorlooptijd beloven en dat de koper op elk moment
// mag vragen waar het staat - dan hoort die vraag hier beantwoord te
// worden, en niet alleen per mail.
//
// De voortgangsvelden komen ALLEEN mee bij een title_check. Een Boost
// heeft geen werkstroom; daar zou "Not started yet" een belofte suggereren
// die niet bestaat.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://mykunda.com,https://www.mykunda.com"
).split(",").map((s) => s.trim()).filter(Boolean);

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Wat de klant op het scherm te zien krijgt per status.
const COPY: Record<string, { done: boolean; nl: string; en: string }> = {
  pending:    { done: false, nl: "We wachten op je betaling.",                   en: "Waiting for your payment." },
  processing: { done: false, nl: "We bevestigen je betaling. Dit kan een paar minuten duren.", en: "Confirming your payment. This can take a few minutes." },
  succeeded:  { done: true,  nl: "Betaling ontvangen. Bedankt!",                 en: "Payment received. Thank you!" },
  failed:     { done: true,  nl: "De betaling is niet gelukt. Er is niets afgeschreven.", en: "The payment did not go through. You have not been charged." },
  cancelled:  { done: true,  nl: "Je hebt de betaling afgebroken.",              en: "You cancelled the payment." },
  expired:    { done: true,  nl: "De betaling is verlopen. Probeer het opnieuw.", en: "The payment expired. Please try again." },
  refunded:   { done: true,  nl: "Dit bedrag is terugbetaald.",                  en: "This amount has been refunded." },
};

// De tweede as: hoe ver het WERK is. NULL leest als 'new'.
//
// Bij 'in_progress' staat er met opzet geen datum en geen schatting. Dat
// is dezelfde belofte als op verify.html: registratiekantoren, landmeters
// en verkopers in Gambia gaan hun eigen tempo, en een deadline noemen die
// je niet in de hand hebt is erger dan geen deadline noemen.
const PROGRESS: Record<string, { nl: string; en: string; step: number }> = {
  new:         { step: 1, nl: "Betaald. We beginnen zo aan je controle.",  en: "Paid. We are about to start your check." },
  in_progress: { step: 2, nl: "Je controle loopt.",                        en: "Your check is under way." },
  report_sent: { step: 3, nl: "Je rapport is verstuurd.",                  en: "Your report has been sent." },
  done:        { step: 4, nl: "Afgerond.",                                 en: "Complete." },
  cancelled:   { step: 0, nl: "Deze opdracht is gestopt.",                 en: "This order was stopped." },
};
const PROGRESS_STEPS = 4;

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });

  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401, headers);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401, headers);

  const url = new URL(req.url);
  let reference = url.searchParams.get("ref") ?? "";
  if (!reference && req.method === "POST") {
    try { reference = String(((await req.json()) as any)?.reference ?? ""); } catch { /* leeg */ }
  }
  if (!reference) return json({ error: "reference_required" }, 400, headers);

  // Alleen de eigen betaling. De filter op user_id staat hier expliciet,
  // ook al draait deze functie met service_role en omzeilt hij RLS.
  const { data: payment } = await admin
    .from("payments")
    .select("reference, status, method, amount_minor, currency, paid_at, created_at, plan_id, fulfilment_status, fulfilment_updated_at")
    .eq("reference", reference)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (!payment) return json({ error: "not_found" }, 404, headers);

  const copy = COPY[payment.status] ?? COPY.processing;

  // Voortgang alleen bij een betaalde titelcontrole.
  let voortgang: Record<string, unknown> = {};
  if (payment.status === "succeeded") {
    const { data: plan } = await admin
      .from("listing_plans").select("kind").eq("id", payment.plan_id).maybeSingle();
    if (plan?.kind === "title_check") {
      const fase = payment.fulfilment_status ?? "new";
      const p = PROGRESS[fase] ?? PROGRESS.new;
      voortgang = {
        progress: fase,
        progress_step: p.step,
        progress_steps: PROGRESS_STEPS,
        progress_nl: p.nl,
        progress_en: p.en,
        progress_updated_at: payment.fulfilment_updated_at ?? null,
      };
    }
  }

  return json({
    reference: payment.reference,
    status: payment.status,
    settled: copy.done,
    message_nl: copy.nl,
    message_en: copy.en,
    amount_gmd: payment.amount_minor / 100,
    currency: payment.currency,
    method: payment.method,
    plan_id: payment.plan_id,
    paid_at: payment.paid_at,
    created_at: payment.created_at,
    ...voortgang,
    // Hoe lang de bedankpagina mag blijven pollen voordat hij zegt
    // "we mailen je zodra het rond is".
    retry_after_seconds: copy.done ? null : 5,
  }, 200, headers);
});
