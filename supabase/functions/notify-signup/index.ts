// ============================================================
//  MyKunda — Edge Function: notify-signup
//  Fires once per account, the moment it is confirmed:
//   1) a branded welcome email to the new user (from noreply@)
//   2) an internal "New account created" notification to the team
//  Idempotent: profiles.welcomed_at is stamped after the first send,
//  and any later call for the same user is a no-op. That makes it
//  safe to call from BOTH the database trigger (email-code sign-ups)
//  and the browser (Google sign-ups, after consent is stored).
//
//  Deploy:  supabase functions deploy notify-signup --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
//  Requires: backend/notify-signup.sql (welcomed_at column + trigger)
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { welcomeEmail, signupBackofficeEmail, toText } from "../_shared/email-template.ts";

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
      .select("id, full_name, email, consent_contact, consent_marketing, consent_at, created_at")
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
    };

    const errors: string[] = [];
    try {
      await sendEmail({ to: info.email, subject: "Welcome to MyKunda — your account is ready", html: welcomeEmail(info), replyTo: TEAM_EMAIL });
    } catch (e) { errors.push(`welcome: ${(e as Error).message}`); console.error("notify-signup welcome failed:", e); }
    try {
      await sendEmail({ to: TEAM_EMAIL, subject: `[MyKunda] New account — ${info.name || info.email}`, html: signupBackofficeEmail(info), replyTo: info.email });
    } catch (e) { errors.push(`team: ${(e as Error).message}`); console.error("notify-signup team failed:", e); }

    // If nothing at all went out, release the claim so a retry can send.
    if (errors.length === 2) {
      await db.from("profiles").update({ welcomed_at: null }).eq("id", user_id);
    }
    return json({ ok: errors.length === 0, errors }, errors.length ? 502 : 200);
  } catch (err) {
    console.error("notify-signup error:", err);
    return json({ ok: false, error: String((err as Error)?.message ?? err) }, 500);
  }
});
