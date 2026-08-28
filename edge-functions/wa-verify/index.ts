// WhatsApp one-time code — proves the number on a listing belongs to the person
// placing it. The cheapest barrier there is against listings that exist only to
// harvest phone calls, and against an account coming straight back after removal.
//
// Deploy: supabase functions deploy wa-verify --no-verify-jwt
//
// Required secrets (same Meta app as wa-notify):
//   WA_PHONE_NUMBER_ID  — Meta Business → WhatsApp → Phone Numbers
//   WA_ACCESS_TOKEN     — System User token with whatsapp_business_messaging
//   WA_OTP_TEMPLATE     — name of the APPROVED authentication template (e.g. "mykunda_otp")
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Without those secrets it answers 503 { configured:false } and the wizard
// carries on without verification instead of blocking every seller.
//
// Body:
//   { action: "send",  phone: "+220…" }                  -> { ok, expires_in }
//   { action: "check", phone: "+220…", code: "123456" }  -> { ok, verified }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

/* A Gambian mobile typed as 7xxxxxx, 2207xxxxxx or +220 7xx xx xx all mean the
   same number. Store one shape so a second attempt finds the first. */
function normalise(raw: string): string {
  let p = String(raw || "").replace(/[\s\-()]/g, "").replace(/^00/, "+");
  if (!p.startsWith("+")) p = p.length === 7 ? "+220" + p : "+" + p;
  return p;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const phoneId = Deno.env.get("WA_PHONE_NUMBER_ID");
  const token = Deno.env.get("WA_ACCESS_TOKEN");
  const template = Deno.env.get("WA_OTP_TEMPLATE");
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  /* Not configured is not an error the seller should see. The page treats this
     as "no verification available" and lets them through. */
  if (!phoneId || !token || !template || !url || !key) {
    return json({ configured: false, error: "wa-verify not configured" }, 503);
  }

  const db = createClient(url, key);
  const salt = key.slice(0, 16); // the code hash is never useful on its own

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const phone = normalise(body.phone || "");
  if (!/^\+\d{8,15}$/.test(phone)) return json({ error: "bad phone" }, 400);

  if (body.action === "send") {
    const { data: allowed } = await db.rpc("claim_phone_otp", { p_phone: phone });
    if (allowed === false) return json({ error: "too_many_codes" }, 429);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + TTL_MINUTES * 60000).toISOString();
    const ins = await db.from("phone_verifications").insert({
      phone, code_hash: await sha256(salt + code), expires_at: expires,
      ip: req.headers.get("x-forwarded-for") || null,
    });
    if (ins.error) return json({ error: ins.error.message }, 500);

    /* An authentication template is the only category Meta allows for a code,
       and it must be approved in the Business Manager before this works. */
    const wa = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone.slice(1),
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: [
            { type: "body", parameters: [{ type: "text", text: code }] },
            { type: "button", sub_type: "url", index: "0",
              parameters: [{ type: "text", text: code }] },
          ],
        },
      }),
    });
    if (!wa.ok) {
      const detail = await wa.text();
      console.warn("wa-verify send failed:", detail.slice(0, 300));
      return json({ error: "send_failed" }, 502);
    }
    return json({ ok: true, expires_in: TTL_MINUTES * 60 });
  }

  if (body.action === "check") {
    const code = String(body.code || "").replace(/\D/g, "");
    if (code.length !== 6) return json({ error: "bad code" }, 400);

    const { data: rows } = await db.from("phone_verifications")
      .select("id, code_hash, attempts, expires_at, verified_at")
      .eq("phone", phone).order("sent_at", { ascending: false }).limit(1);

    const row = rows && rows[0];
    if (!row) return json({ verified: false, error: "no_code" }, 400);
    if (row.attempts >= MAX_ATTEMPTS) return json({ verified: false, error: "too_many_attempts" }, 429);
    if (new Date(row.expires_at) < new Date()) return json({ verified: false, error: "expired" }, 400);

    const ok = row.code_hash === await sha256(salt + code);
    await db.from("phone_verifications")
      .update({ attempts: row.attempts + 1, verified_at: ok ? new Date().toISOString() : null })
      .eq("id", row.id);

    return json({ verified: ok, error: ok ? null : "wrong_code" }, ok ? 200 : 400);
  }

  return json({ error: "unknown action" }, 400);
});
