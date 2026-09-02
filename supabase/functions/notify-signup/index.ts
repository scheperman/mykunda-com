// ============================================================
//  MyKunda — Edge Function: notify-signup
//  Fires once per account, the moment it is confirmed:
//   1) a branded welcome email to the new user (from noreply@)
//   2) an internal "New account created" notification to the team
//  Idempotent: profiles.welcomed_at is stamped after the first send,
//  and any later call for the same user is a no-op. That makes it
//  safe to call from BOTH the database trigger and the browser.
//
//  27-08-2026: de trigger on_auth_user_signup_notify vuurt nu ook op INSERT
//  wanneer email_confirmed_at al gevuld is. Daarmee dekt de database ook de
//  Google-aanmeldingen; die kwamen al bevestigd binnen, dus de oude AFTER
//  UPDATE-trigger sloeg ze over en de browser was de enige verzender. De
//  aanroep vanuit auth.html blijft staan als vangnet (en om consent eerst weg
//  te schrijven) — welcomed_at zorgt dat er hoe dan ook één mail uitgaat.
//
//  Deploy:  supabase functions deploy notify-signup --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
//  Requires: backend/notify-signup.sql (welcomed_at column + trigger)
//
//  02-09-2026: de welkomsttekst voor rol 'agent' wijst naar het bedrijfsprofiel
//  (dashboard.html#company). Uitgerold met de Supabase CLI, die sinds vandaag
//  op de pc staat en de vier bestanden zelf meeneemt — index.ts plus de drie
//  in _shared/. Nagemeten met een echte proefaanmelding: de mail bevat de rij
//  "Set up your company profile" bovenaan.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { welcomeEmail, signupBackofficeEmail, toText, isReservedTestAddress } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const TEAM_EMAIL     = "admin@mykunda.com";   // same override as notify-lead (info@ bounces via Cloud86)
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sendEmail(o: { to: string; subject: string; html: string; replyTo?: string }) {
  /* Gereserveerde testdomeinen nooit versturen — zie isReservedTestAddress
     in _shared/email-template.ts. Amazon SES houdt zo'n mail veertien uur
     vast en boekt daarna een bounce op de reputatie van mykunda.com.
     Deze guard stond tot 30-08-2026 alleen in auth-email. */
  if (isReservedTestAddress(o.to)) {
    throw new Error(`reserved test domain, not sent: ${o.to}`);
  }

  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [o.to], subject: o.subject, html: o.html, text: toText(o.html) };
  if (o.replyTo) body.reply_to = o.replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

/** Spoor in public.email_events, net als de betaal- en leadmails. Loggen mag
 *  nooit een verstuurde mail alsnog laten mislukken. */
async function logSignupEmail(db: any, o: {
  event_type: string; recipient: string; subject: string;
  resend_email_id: string | null; payload?: Record<string, unknown>;
}) {
  try {
    const { error } = await db.from("email_events").insert({
      resend_email_id: o.resend_email_id,
      event_type: o.event_type,
      recipient: o.recipient,
      subject: o.subject,
      payload: o.payload ?? {},
    });
    if (error) throw error;
  } catch (e) {
    console.error("email_events loggen faalde (de mail is wél verstuurd):", String((e as Error)?.message ?? e));
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { user_id } = await req.json().catch(() => ({}));
    if (!user_id || typeof user_id !== "string") return json({ ok: false, error: "missing user_id" }, 400);

    const db = createClient(SUPABASE_URL, SERVICE_KEY);

    // Only ever act on a confirmed auth user — never on a half-finished sign-up.
    const { data: au, error: auErr } = await db.auth.admin.getUserById(user_id);
    if (auErr || !au?.user) return json({ ok: false, error: "user not found" }, 404);
    const user = au.user;
    if (!user.email || !user.email_confirmed_at) return json({ ok: true, skipped: "unconfirmed" });

    // Idempotency guard: claim the send by stamping welcomed_at where it is still null.
    const { data: claimed, error: claimErr } = await db
      .from("profiles")
      .update({ welcomed_at: new Date().toISOString() })
      .eq("id", user_id)
      .is("welcomed_at", null)
      .select("id, full_name, email, role, consent_contact, consent_marketing, consent_at, created_at")
      .maybeSingle();
    if (claimErr) throw claimErr;
    if (!claimed) return json({ ok: true, skipped: "already_welcomed" });

    const info = {
      id: user.id,
      name: claimed.full_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? undefined,
      email: user.email,
      provider: (user.app_metadata?.provider as string) ?? "email",
      consentContact: !!claimed.consent_contact,
      consentAt: claimed.consent_at ?? undefined,
      consentMarketing: !!claimed.consent_marketing,
      createdAt: user.created_at,
      /* De rol die de bezoeker bij het aanmelden koos. Bij de e-mailcode-route
         staat hij hier al goed: handle_new_user() schrijft hem uit de
         signup-metadata. Bij Google zet set-role hem pas ná het aanmaken, en
         deze functie vuurt al vanuit de databasetrigger — die krijgt dan
         'buyer' te zien. Bewuste keuze: liever een iets algemenere mail dan
         een mail die niet komt. */
      role: (claimed.role as string) ?? undefined,
    };

    const errors: string[] = [];
    // Aparte vlag voor de KLANTmail. De claim hieronder werd tot 30-08-2026
    // alleen vrijgegeven als beide mails faalden; lukte de teammail en
    // mislukte de welkomstmail, dan bleef welcomed_at staan en probeerde
    // niemand het ooit nog — pg_net doet geen retry. De nieuwe gebruiker
    // kreeg dan nooit een welkomstmail, en niets liet dat zien.
    let welcomeSent = false;
    try {
      const subject = "Welcome to MyKunda — your account is ready";
      const sent = await sendEmail({ to: info.email, subject, html: welcomeEmail(info), replyTo: TEAM_EMAIL });
      await logSignupEmail(db, {
        event_type: "signup_welcome", recipient: info.email, subject,
        resend_email_id: sent?.id ? String(sent.id) : null,
        payload: { provider: info.provider, consent_contact: info.consentContact, consent_marketing: info.consentMarketing },
      });
      welcomeSent = true;
    } catch (e) { errors.push(`welcome: ${(e as Error).message}`); console.error("notify-signup welcome failed:", e); }
    try {
      const teamSubject = `[MyKunda] New account — ${info.name || info.email}`;
      const teamSent = await sendEmail({ to: TEAM_EMAIL, subject: teamSubject, html: signupBackofficeEmail(info), replyTo: info.email });
      await logSignupEmail(db, {
        event_type: "signup_backoffice", recipient: TEAM_EMAIL, subject: teamSubject,
        resend_email_id: teamSent?.id ? String(teamSent.id) : null,
        payload: { internal: true, provider: info.provider, user_id: info.id },
      });
    } catch (e) { errors.push(`team: ${(e as Error).message}`); console.error("notify-signup team failed:", e); }

    /* De claim wordt vrijgegeven zodra de KLANTmail niet is aangekomen —
       ongeacht hoe het de teammail verging. De teammelding is intern en mag
       nooit de reden zijn dat een nieuwe gebruiker zijn welkomstmail
       misloopt; hij komt bovendien in email_events te staan, dus een dubbele
       teammelding bij een herkansing is zichtbaar en onschadelijk. */
    if (!welcomeSent) {
      await db.from("profiles").update({ welcomed_at: null }).eq("id", user_id);
    }
    return json({ ok: errors.length === 0, errors }, errors.length ? 502 : 200);
  } catch (err) {
    console.error("notify-signup error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
