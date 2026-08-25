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
//  Secrets: WA_VERIFY_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//  Note: run backend/whatsapp-lead-source.sql once so 'whatsapp_inbound'
//  exists in the lead_source enum. Until then this falls back to
//  'contact' rather than dropping the message.
// ============================================================
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { whatsappAutoReply } from "../_shared/email-template.ts";

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
    const body = await req.json();
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
      .select("id")
      .eq("phone", phoneFormatted)
      .gte("created_at", fiveMinAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    let leadId: string | null = existing?.[0]?.id ?? null;
    const isFollowUp = !!leadId;

    if (leadId) {
      await sb.from("leads").update({ message: msgText, payload }).eq("id", leadId);
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

    // Team notification — the branded email, same as any web form.
    if (leadId && !isFollowUp) {
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
