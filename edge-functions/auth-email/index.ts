// ============================================================
//  MyKunda — Edge Function: auth-email
//  Generates Supabase auth action links server-side with the
//  admin API (supabase.auth.admin.generateLink) and emails them
//  via Resend from noreply@mykunda.com, with the link itself
//  pointing at mykunda.com/auth.html.
//
//  Why: Supabase's own auth mailer sends from + links to your
//  project's *.supabase.co domain unless you buy the "Custom
//  Domain" add-on. Generating the link ourselves and emailing it
//  through Resend gets a correct sender AND link for free.
//
//  2026-08-15 update: signin/signup are now explicit (mode param)
//  instead of being inferred from whether the address exists, and
//  the email_code route looks up existence+confirmation up front
//  via the auth_user_lookup() RPC instead of pattern-matching the
//  error message from generateLink() — that pattern match is what
//  caused an abandoned signup (unconfirmed account) to fall through
//  to Supabase's own mailer (a magic link) instead of a code.
//  Consent is now passed through to the profiles trigger too.
//  Requires backend/auth-flow-fixes.sql to be applied first.
//
//  Deploy:  supabase functions deploy auth-email --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authLinkEmail, authCodeEmail } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL       = "https://mykunda.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECT: Record<string, string> = {
  recovery: "Reset your password — MyKunda",
  magiclink: "Your sign-in link — MyKunda",
  signup: "Confirm your email — MyKunda",
  email_code: "Your MyKunda sign-in code",
};

// Gereserveerde testdomeinen (RFC 2606/6761) hebben geen DNS. Amazon SES houdt
// zo'n mail 14 uur in de wachtrij en boekt daarna een bounce op de reputatie
// van mykunda.com. Nooit versturen dus — testen doe je met delivered@resend.dev.
const RESERVED_EMAIL_DOMAIN =
  /(^|\.)(invalid|test|localhost|example|example\.(com|net|org))$/i;

function isReservedTestAddress(addr: string): boolean {
  const domain = String(addr ?? "").trim().toLowerCase().split("@").pop() ?? "";
  return RESERVED_EMAIL_DOMAIN.test(domain);
}

async function sendEmail(to: string, subject: string, html: string) {
  if (isReservedTestAddress(to)) {
    console.warn(`auth-email: geweigerd, gereserveerd testdomein — ${to}`);
    return true;
  }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("Resend error", errText);
    throw new Error(`Resend ${r.status}: ${errText}`);
  }
  return r.ok;
}

// Very light in-memory throttle (per function instance) against accidental
// double-submits and casual spam. Supabase's built-in auth rate limits don't
// apply here since this calls the admin API directly — for real abuse
// resistance at scale, back this with a DB table instead.
const recent = new Map<string, number>();
function throttled(key: string, windowMs = 60_000): boolean {
  const now = Date.now();
  const last = recent.get(key);
  recent.set(key, now);
  return !!last && now - last < windowMs;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { type, email, password, next, name, mode, consent, consent_marketing } = await req.json();
    if (!type || !email) throw new Error("type and email are required");
    if (!["recovery", "magiclink", "signup", "email_code"].includes(type)) {
      throw new Error("unsupported type: " + type);
    }

    const json = (body: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    const okNoop = json({ ok: true });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // ---- email_code: the 6-digit code the sign-in screen asks for ----
    // generateLink returns both a link AND its one-time code (email_otp);
    // we mail only the code, so the UI's OTP step is what people actually get.
    if (type === "email_code") {
      if (throttled(`email_code:${email}`, 20_000)) return json({ ok: true, verify_type: "email", code_length: 0 });

      // mode is required from the client going forward; default to "signup"
      // only so older cached frontends don't hard-fail mid-rollout.
      const authMode = mode === "signin" ? "signin" : "signup";

      const { data: lookup, error: lookupErr } = await admin.rpc("auth_user_lookup", { p_email: email });
      if (lookupErr) throw lookupErr;
      const row = Array.isArray(lookup) ? lookup[0] : lookup;
      const userExists = !!row?.user_exists;
      const confirmed = !!row?.confirmed;

      // Sign-in tab, unknown address: don't create an account, let the
      // screen offer to switch to Create account instead.
      if (authMode === "signin" && !userExists) {
        return json({ ok: false, no_account: true });
      }
      // Create-account tab, address already has a confirmed account:
      // point them at sign-in instead of silently issuing a new code.
      if (authMode === "signup" && userExists && confirmed) {
        return json({ ok: false, already_exists: true });
      }

      let verifyType: string;
      let res;
      if (userExists && confirmed) {
        verifyType = "magiclink";
        res = await admin.auth.admin.generateLink({
          type: "magiclink", email,
          options: { redirectTo: SITE_URL + "/auth.html" },
        } as any);
      } else {
        // New address, or an existing-but-never-confirmed one: (re)issue a
        // signup confirmation code. This is the fix for the "abandoned
        // signup blocks itself" bug — we no longer rely on magiclink's
        // error message to detect this case.
        verifyType = "signup";
        const meta: Record<string, unknown> = {};
        if (name) meta.full_name = name;
        if (consent === true) meta.consent_contact = true;
        if (consent_marketing === true) meta.consent_marketing = true;
        res = await admin.auth.admin.generateLink({
          type: "signup", email, password: password || crypto.randomUUID(),
          options: { data: meta, redirectTo: SITE_URL + "/auth.html" },
        } as any);
      }
      if (res.error) throw res.error;
      const code = res.data?.properties?.email_otp;
      if (!code) throw new Error("no email_otp returned from generateLink");
      await sendEmail(email, SUBJECT.email_code, authCodeEmail({ code }));
      return json({ ok: true, verify_type: verifyType, code_length: String(code).length });
    }

    if (throttled(`${type}:${email}`)) return okNoop; // pretend success, don't leak throttling

    const genOpts: Record<string, unknown> = {
      type, email,
      options: { redirectTo: SITE_URL + "/auth.html" },
    };
    // signup isn't wired to the UI yet (the sign-up tab uses email_code above) —
    // this path is ready for whenever a separate "Confirm email" link is needed.
    // If/when it is, give it the same mode-aware treatment as email_code.
    if (type === "signup") genOpts.password = password || crypto.randomUUID();

    const { data, error } = await admin.auth.admin.generateLink(genOpts as any);
    if (error) {
      const msg = String((error as any).message || error);
      // Don't reveal whether an email has an account for passwordless flows.
      if ((type === "recovery" || type === "magiclink") && /not.?found|not.?exist/i.test(msg)) {
        return okNoop;
      }
      throw error;
    }

    const hashedToken = data?.properties?.hashed_token;
    if (!hashedToken) throw new Error("no hashed_token returned from generateLink");

    const link = `${SITE_URL}/auth.html?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(type)}`
      + (next ? `&next=${encodeURIComponent(next)}` : "");

    await sendEmail(email, SUBJECT[type] ?? "MyKunda", authLinkEmail({ type, link }));

    return okNoop;
  } catch (e) {
    console.error("auth-email error:", e);
    return new Response(JSON.stringify({ ok: false, error: String((e as any)?.message || e) }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
