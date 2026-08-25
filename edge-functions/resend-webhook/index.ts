// ============================================================
//  MyKunda — Edge Function: resend-webhook
//  Receives delivery events from Resend (bounces, complaints,
//  delays, failures, suppressions) so deliverability problems
//  are visible in real time instead of only in the Resend
//  dashboard. Logs every event and alerts info@mykunda.com on
//  bounces / complaints / failures.
//
//  Deploy:  supabase functions deploy resend-webhook --no-verify-jwt
//  Run once: backend/email-events.sql (creates email_events table
//            + email_bounced_at/email_bounce_reason on leads)
//  Secrets: RESEND_WEBHOOK_SECRET (signing secret shown when the
//           webhook was created in Resend — Settings → Webhooks)
//           reuses RESEND_API_KEY / ADMIN_EMAIL / FROM_EMAIL
//
//  Configured in Resend to POST here for: email.bounced,
//  email.complained, email.delivery_delayed, email.failed,
//  email.suppressed.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { emailEventAlertEmail, toText } from "../_shared/email-template.ts";

const WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") || "info@mykunda.com";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Events that page the team immediately — the rest are logged only.
const ALERT_ON = new Set(["email.bounced", "email.complained", "email.failed"]);

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64encode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Resend signs webhooks the same way Svix does: base64(HMAC-SHA256(secret, "id.timestamp.body")).
async function verifySvix(id: string, timestamp: string, body: string, signatureHeader: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return false;
  const secretBytes = b64decode(WEBHOOK_SECRET.replace(/^whsec_/, ""));
  const signedContent = `${id}.${timestamp}.${body}`;
  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent)));
  const expected = b64encode(sigBytes);
  return signatureHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    return !!sig && timingSafeEqual(sig, expected);
  });
}

async function sendAlert(subject: string, html: string) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html, text: toText(html) }),
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const body = await req.text();
  const svixId = req.headers.get("svix-id") || "";
  const svixTimestamp = req.headers.get("svix-timestamp") || "";
  const svixSignature = req.headers.get("svix-signature") || "";

  if (!svixId || !svixTimestamp || !svixSignature || !(await verifySvix(svixId, svixTimestamp, body, svixSignature))) {
    return new Response("Invalid signature", { status: 401 });
  }
  // Reject stale payloads (>5 min old) to block replay.
  const tsMs = Number(svixTimestamp) * 1000;
  if (!tsMs || Math.abs(Date.now() - tsMs) > 5 * 60 * 1000) {
    return new Response("Stale timestamp", { status: 401 });
  }

  let event: any;
  try { event = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }

  const type: string = event.type || "unknown";
  const data = event.data || {};
  const recipient: string | null = Array.isArray(data.to) ? data.to[0] : data.to || null;
  const reason: string | null =
    data.bounce?.message || data.failed?.reason || data.complaint?.feedback_type || data.reason || null;

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY);
    await sb.from("email_events").insert({
      resend_email_id: data.email_id || null,
      event_type: type.replace("email.", ""),
      recipient,
      subject: data.subject || null,
      reason,
      payload: event,
    });

    if (recipient && (type === "email.bounced" || type === "email.complained")) {
      await sb.from("leads")
        .update({ email_bounced_at: new Date().toISOString(), email_bounce_reason: type.replace("email.", "") })
        .eq("email", recipient);
    }

    if (ALERT_ON.has(type)) {
      const html = emailEventAlertEmail({ type, recipient, subject: data.subject, reason, emailId: data.email_id });
      await sendAlert(`[MyKunda] Email ${type.replace("email.", "")}: ${recipient || "unknown recipient"}`, html);
    }
  } catch (e) {
    console.error("resend-webhook processing error:", e);
    // Still ack below — Resend retries on non-2xx, and a DB/send hiccup here
    // shouldn't turn into a retry storm once the error is in the logs.
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
