// WhatsApp Business API notification sender
// Deploy: supabase functions deploy wa-notify --no-verify-jwt
//
// Sends a WhatsApp message via the Meta Cloud API (WhatsApp Business Platform).
// Aanroepers: wa-inbound (auto-reply op een binnenkomend bericht, de twee
// meldingen rond nummerverificatie, en sinds 03-09-2026 de uitleg aan een
// aanbieder die op een melding antwoordt) en notify-lead (sinds 03-09-2026 de
// template `lead_owner` aan de aanbieder bij een nieuwe aanvraag, achter
// profiles.notify_whatsapp).
//
// *** POORT — 30-08-2026 ***
// Deze functie controleerde niets. verify_jwt staat uit (nodig voor de
// preflight) en de handler begon meteen met req.json(): wie de URL kende, kon
// dus onbeperkt WhatsApp-berichten sturen naar willekeurige nummers vanaf het
// geverifieerde MyKunda-bedrijfsnummer. Spam en phishing onder het merk, en
// blokkade door Meta als sluitstuk. Nu is een gedeelde sleutel verplicht —
// dezelfde als notify-payment en notify-fulfilment gebruiken.
// Let op: staat NOTIFY_SHARED_KEY niet, dan weigert deze functie álles. Dat is
// hier bewust anders dan bij de mailfuncties: een open relay naar een
// telefoonnummer is erger dan een melding die niet aankomt.
//
// Required secrets:
//   WA_PHONE_NUMBER_ID  — from Meta Business → WhatsApp → Phone Numbers
//   WA_ACCESS_TOKEN     — permanent System User token with whatsapp_business_messaging permission
//   NOTIFY_SHARED_KEY   — dezelfde sleutel als de notify-functies
//
// Body: { to: "+2201234567", template: "lead_notification", params: ["Fatou Njie", "Beachfront Villa"] }
//   OR: { to: "+2201234567", text: "Plain text message" }
// Header: x-notify-key: <NOTIFY_SHARED_KEY>

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const WA_API = "https://graph.facebook.com/v21.0";
const SHARED_KEY = Deno.env.get("NOTIFY_SHARED_KEY") || "";

function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  try {
    if (!SHARED_KEY || !sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

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
            ? [{ type: "body", parameters: (params as unknown[]).map((p: unknown) => ({ type: "text", text: String(p) })) }]
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
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
