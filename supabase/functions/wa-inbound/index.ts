// ============================================================
//  MyKunda — Edge Function: wa-inbound
//  Meta webhook for WhatsApp. An inbound message becomes a lead,
//  the team gets the same branded notification as any web form,
//  and the sender gets an immediate WhatsApp acknowledgement.
//
//  Fixed Aug 2026: this function used to POST {type,name,phone,
//  message} to notify-lead, which only accepts {lead_id} — so an
//  inbound WhatsApp message reached nobody. It now inserts the
//  lead first and passes that id.
//
//  Deploy: supabase functions deploy wa-inbound --no-verify-jwt
//
//  Meta Business → WhatsApp → Configuration → Webhook:
//    Callback URL: https://<project>.supabase.co/functions/v1/wa-inbound
//    Verify token: WA_VERIFY_TOKEN secret · subscribe to: messages
//
//  Also handles number verification: a message of the form MYKUNDA-XXXXXXXX
//  is a seller proving that this WhatsApp number is theirs (see wa-verify).
//  Those never become leads.
//
//  Secrets: WA_VERIFY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//           WA_APP_SECRET (optional but strongly advised — signature check)
//  Note: run backend/whatsapp-lead-source.sql once so 'whatsapp_inbound'
//  exists in the lead_source enum. Until then this falls back to
//  'contact' rather than dropping the message.
//
//  NOTE: the WhatsApp acknowledgement below calls the 'wa-notify' function,
//  which is deployed and live. The call stays wrapped in a try/catch, so a
//  hiccup there is logged as a warning and nothing else: leads are still
//  created and the team is still notified via notify-lead either way.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappAutoReply } from "../_shared/email-template.ts";

// Follow-ups are appended to leads.message, so cap the total length to keep
// the column (and the notification email) from growing without limit.
const MAX_MESSAGE_CHARS = 4000;

serve(async (req) => {
  // Meta verifies the webhook with a GET
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN") || "mykunda_wa_verify";
    if (mode === "subscribe" && token === verifyToken) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  try {
    /* Meta signs every webhook POST. Until now nothing checked that, which
       means anyone who knows the URL can post a payload and have it become a
       lead. That mattered less when the worst case was a junk enquiry; now
       that number verification hangs off this function, a forged payload
       could confirm a number that is not the sender's.

       Set WA_APP_SECRET (Meta → App → Settings → Basic → App Secret) and this
       becomes a hard gate. Without it the function behaves exactly as before,
       so setting the secret is the only step and nothing breaks in between. */
    const raw = await req.text();
    const appSecret = Deno.env.get("WA_APP_SECRET");
    if (appSecret) {
      const sig = (req.headers.get("x-hub-signature-256") || "").replace(/^sha256=/, "");
      const mac = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(appSecret),
        { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
      );
      const digest = await crypto.subtle.sign("HMAC", mac, new TextEncoder().encode(raw));
      const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
      let same = sig.length === expected.length;
      for (let i = 0; i < expected.length && same; i++) same = sig[i] === expected[i] ? same : false;
      if (!same) {
        console.warn("wa-inbound: bad signature, ignoring payload");
        return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
      }
    }
    const body = JSON.parse(raw);
    const value = body.entry?.[0]?.changes?.[0]?.value;

    if (!value || !value.messages || !value.messages.length) {
      // Status update or other non-message event — acknowledge
      return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
    }

    const message = value.messages[0];
    const contact = value.contacts?.[0];
    const from = message.from; // phone number without +
    const msgText = message.text?.body || message.caption || "";
    const contactName = contact?.profile?.name || "";
    const phoneFormatted = "+" + from;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // ---- Number verification -------------------------------------------
    // A message that is only a MyKunda code is not an enquiry: it is somebody
    // proving that this WhatsApp number is theirs (see wa-verify). It gets
    // confirmed and the function stops here — no lead, no team email, no
    // auto-reply about a property nobody asked about. Anything else falls
    // through to the lead path untouched.
    const codeMatch = msgText.match(/MYKUNDA[-\s]?([A-Z2-9]{8})/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      const hashBuf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(supabaseKey.slice(0, 16) + code),
      );
      const hash = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

      const { data: pending } = await sb.from("phone_verifications")
        .select("id, expires_at, verified_at")
        .eq("code_hash", hash).order("sent_at", { ascending: false }).limit(1);

      const row = pending?.[0];
      const fresh = !!row && !row.verified_at && new Date(row.expires_at) > new Date();
      if (fresh) {
        await sb.from("phone_verifications")
          .update({ phone: phoneFormatted, verified_at: new Date().toISOString() })
          .eq("id", row!.id);
      }
      try {
        await fetch(`${supabaseUrl}/functions/v1/wa-notify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: phoneFormatted,
            text: fresh
              ? `Thank you — ${phoneFormatted} is now confirmed as your WhatsApp number on MyKunda. You can go back to the page you were on.`
              : "That code has expired or was already used. Please start again on MyKunda and we will give you a new one.",
          }),
        });
      } catch (e) {
        console.warn("wa-verify ack failed:", (e as Error).message);
      }
      return new Response(JSON.stringify({ ok: true, verification: fresh ? "confirmed" : "stale" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const payload = {
      wa_message_id: message.id,
      wa_from: from,
      wa_contact_name: contactName,
      wa_timestamp: message.timestamp,
    };

    // Same sender within 5 minutes = same conversation, not a new lead.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: existing } = await sb
      .from("leads")
      .select("id, message")
      .eq("phone", phoneFormatted)
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    let leadId: string | null = existing?.[0]?.id ?? null;
    const isFollowUp = !!leadId;
    // A follow-up only earns a new notification when it actually adds text —
    // otherwise ten stray lines would mean ten emails.
    let followUpAddsText = false;

    if (leadId) {
      // Classic WhatsApp habit: "Hi" first, the real question second. Appending
      // instead of overwriting keeps both, so the question reaches the team.
      const previous: string = existing?.[0]?.message ?? "";
      const addition = msgText.trim();
      const alreadyThere = !addition ||
        previous.split("\n").some((line) => line.trim() === addition);
      followUpAddsText = !alreadyThere;
      let merged = previous;
      if (followUpAddsText) {
        merged = previous ? `${previous}\n${addition}` : addition;
        // Keep the newest text when it no longer fits — that is the part the
        // team still needs to read.
        if (merged.length > MAX_MESSAGE_CHARS) {
          merged = "…\n" + merged.slice(-(MAX_MESSAGE_CHARS - 2));
        }
      }
      await sb.from("leads").update({ message: merged, payload }).eq("id", leadId);
    } else {
      const row = {
        name: contactName || null,
        phone: phoneFormatted,
        message: msgText,
        payload,
      };
      // 'whatsapp_inbound' needs the enum value; fall back to 'contact' so a
      // message is never lost because a migration hasn't been run yet.
      let ins = await sb.from("leads").insert({ ...row, source: "whatsapp_inbound" }).select("id").single();
      if (ins.error) {
        console.warn("wa-inbound: whatsapp_inbound source rejected, falling back to contact —", ins.error.message);
        ins = await sb.from("leads")
          .insert({ ...row, source: "contact", payload: { ...payload, channel: "whatsapp" } })
          .select("id").single();
      }
      if (ins.error) throw new Error("lead insert failed: " + ins.error.message);
      leadId = ins.data?.id ?? null;
    }

    // Team notification — the branded email, same as any web form. A follow-up
    // within the 5-minute window is notified too (with the appended message),
    // but only when it actually added text.
    if (leadId && (!isFollowUp || followUpAddsText)) {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/notify-lead`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ lead_id: leadId }),
        });
        if (!r.ok) console.warn("notify-lead responded", r.status, await r.text());
      } catch (e) {
        console.warn("notify-lead call failed:", (e as Error).message);
      }
    }

    // Acknowledge on WhatsApp itself. The inbound message opens a 24-hour
    // window, so a plain-text reply is allowed without a Meta template.
    if (!isFollowUp) {
      try {
        await fetch(`${supabaseUrl}/functions/v1/wa-notify`, {
          method: "POST",
          headers: { Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ to: phoneFormatted, text: whatsappAutoReply(contactName) }),
        });
      } catch (e) {
        console.warn("wa-notify auto-reply failed:", (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ ok: true, lead_id: leadId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("wa-inbound error:", e);
    // Always 200 to Meta — otherwise it retries the same message for hours.
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
