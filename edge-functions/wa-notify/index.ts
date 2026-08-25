// WhatsApp Business API notification sender
// Deploy: supabase functions deploy wa-notify --no-verify-jwt
//
// Sends a WhatsApp message via the Meta Cloud API (WhatsApp Business Platform).
// Called from other Edge Functions (notify-lead, notify-viewing) when the
// recipient's notification_prefs.channel is 'whatsapp' or 'both'.
//
// Required secrets:
//   WA_PHONE_NUMBER_ID  — from Meta Business → WhatsApp → Phone Numbers
//   WA_ACCESS_TOKEN     — permanent System User token with whatsapp_business_messaging permission
//
// Body: { to: "+2201234567", template: "lead_notification", params: ["Fatou Njie", "Beachfront Villa"] }
//   OR: { to: "+2201234567", text: "Plain text message" }

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const WA_API = "https://graph.facebook.com/v21.0";

serve(async (req) => {
  try {
    const { to, template, params, text } = await req.json();
    const phoneId = Deno.env.get("WA_PHONE_NUMBER_ID");
    const token = Deno.env.get("WA_ACCESS_TOKEN");

    if (!phoneId || !token) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing 'to' phone number" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Clean the phone number (remove spaces, dashes, ensure + prefix)
    const cleanPhone = to.replace(/[\s\-()]/g, "").replace(/^00/, "+");
    const recipient = cleanPhone.startsWith("+") ? cleanPhone.slice(1) : cleanPhone;

    let body;

    if (template) {
      // Send a pre-approved template message
      body = {
        messaging_product: "whatsapp",
        to: recipient,
        type: "template",
        template: {
          name: template,
          language: { code: "en" },
          components: params && params.length
            ? [{ type: "body", parameters: params.map((p) => ({ type: "text", text: String(p) })) }]
            : [],
        },
      };
    } else if (text) {
      // Send a plain text message (only within 24h conversation window)
      body = {
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { body: text },
      };
    } else {
      return new Response(JSON.stringify({ error: "Provide 'template' or 'text'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = await fetch(`${WA_API}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error("WhatsApp API error:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "WhatsApp API error", detail: result }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, message_id: result.messages?.[0]?.id }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
