// ============================================================
//  MyKunda — Edge Function: wa-verify
//  Proves that the WhatsApp number on a listing belongs to the person
//  placing it. The cheapest barrier there is against listings that exist
//  only to harvest phone calls.
//
//  The direction is deliberately reversed. We do NOT send a code to a
//  number somebody typed and hope it is theirs: the seller sends us a
//  code that is on their screen, and Meta tells us which number it came
//  from. Two things follow from that:
//    · no approved Meta template is needed — a template is only required
//      when the business opens the conversation;
//    · the number is proven by Meta's routing instead of believed from a
//      form field, and inbound messages cost nothing.
//
//  Flow:  start  →  seller sends "MYKUNDA-XXXXXXXX" on WhatsApp
//                →  wa-inbound matches it and fills in the number
//                →  status returns { verified, phone }
//
//  Deploy: supabase functions deploy wa-verify --no-verify-jwt
//  Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, WA_BUSINESS_NUMBER
//
//  Access: a real signed-in user only. verify_jwt is off to match the rest
//  of the project, but the anon key is public, so the gate that matters is
//  the getUser() check below — without it anyone could spend this function.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const TTL_MINUTES = 15;
/* No O/0/I/1: the code is pre-filled in the link, but somebody will read it
   out over the phone anyway. 32^8 is about 10^12 — guessing one is not a way in. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function makeCode(): string {
  const bytes = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const waNumber = (Deno.env.get("WA_BUSINESS_NUMBER") || "").replace(/[^\d]/g, "");

  /* Not configured is not an error the seller should see: the wizard reads a
     503 as "no verification available" and lets them publish without it. */
  if (!url || !key || !waNumber) {
    return json({ configured: false, error: "wa-verify not configured" }, 503);
  }

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  const action = body.action || "";

  /* The probe the wizard uses to decide whether to show the block at all.
     It answers before the auth check so a signed-out visitor still learns
     that the feature exists — it reveals nothing else. */
  if (action === "probe") return json({ configured: true, ok: true });

  const db = createClient(url, key);
  const salt = key.slice(0, 16);

  /* The gate that matters. The anon key is public and would otherwise be
     enough to spend this function; a real user token is not. */
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const { data: userRes } = await db.auth.getUser(token);
  const user = userRes && userRes.user;
  if (!user || !user.id) return json({ error: "sign_in_required" }, 401);

  if (action === "start") {
    const { data: allowed } = await db.rpc("claim_phone_otp", { p_user: user.id });
    if (allowed === false) return json({ error: "too_many_codes" }, 429);

    const code = makeCode();
    const expires = new Date(Date.now() + TTL_MINUTES * 60000).toISOString();
    const ins = await db.from("phone_verifications").insert({
      user_id: user.id,
      code_hash: await sha256(salt + code),
      expires_at: expires,
      channel: "inbound",
      ip: req.headers.get("x-forwarded-for") || null,
    }).select("id").single();
    if (ins.error) return json({ error: ins.error.message }, 500);

    const text = `MYKUNDA-${code}`;
    return json({
      ok: true,
      code: text,
      /* Opens WhatsApp with the message already written. On a phone this is
         two taps; the seller never types the code. */
      wa_link: `https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`,
      expires_in: TTL_MINUTES * 60,
    });
  }

  if (action === "status") {
    const { data: rows } = await db.from("phone_verifications")
      .select("phone, verified_at, expires_at")
      .eq("user_id", user.id).order("sent_at", { ascending: false }).limit(1);
    const row = rows && rows[0];
    if (!row) return json({ verified: false, error: "no_code" });
    if (row.verified_at) return json({ verified: true, phone: row.phone });
    if (new Date(row.expires_at) < new Date()) return json({ verified: false, error: "expired" });
    return json({ verified: false, waiting: true });
  }

  return json({ error: "unknown action" }, 400);
});
