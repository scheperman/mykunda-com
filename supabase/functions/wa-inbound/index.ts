// ============================================================
//  MyKunda — Edge Function: wa-inbound
//  Meta webhook for WhatsApp. An inbound message becomes a lead,
//  the team gets the same branded notification as any web form,
//  and the sender gets an immediate WhatsApp acknowledgement.
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
//  Secrets: WA_VERIFY_TOKEN, WA_APP_SECRET, NOTIFY_SHARED_KEY,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
//  *** DRIE WIJZIGINGEN VAN 30-08-2026 ***
//  1. FAIL CLOSED. WA_VERIFY_TOKEN had een hardgecodeerde terugval
//     ("mykunda_wa_verify") die gewoon in de openbare broncode staat, en de
//     handtekeningcontrole werd overgeslagen als WA_APP_SECRET niet gezet was.
//     Gemeten op 30-08-2026: een GET met dat token uit de broncode gaf de
//     challenge terug, dus de secret stond niet. Zonder handtekeningcontrole
//     kan iedereen die de URL kent leads verzinnen, mail uit ons domein laten
//     vertrekken en - erger - een willekeurig telefoonnummer als geverifieerd
//     laten registreren. Beide secrets zijn nu verplicht.
//  2. ALLE berichten uit een batch. Meta mag er meerdere in een webhook zetten;
//     alleen value.messages[0] werd verwerkt en de rest verdween zonder lead,
//     zonder log en zonder antwoord.
//  3. TEKST UIT ALLE BERICHTSOORTEN. De code las message.caption, maar de
//     Cloud API zet een foto-onderschrift op message.image.caption, een
//     knopantwoord op message.button.text en een lijstkeuze op
//     message.interactive.*. Een foto met een vraag erbij werd dus een lege
//     lead, terwijl de klant wel een auto-reply kreeg dat het team zo antwoordt.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* Stond in _shared/email-template.ts en is op 30-08-2026 hierheen verplaatst.
   Dit is het enige stuk van die module dat wa-inbound gebruikte, en het is
   platte tekst voor WhatsApp — geen e-mail. Daarmee sleepte deze functie de
   hele mailtemplate (50 kB) mee in haar bundel voor één string. Wijzig je de
   toon van de auto-reply, dan is dit de plek. */
function whatsappAutoReply(name?: string): string {
  const fname = name ? String(name).trim().split(" ")[0] : "";
  return `Hello${fname ? " " + fname : ""}, thanks for messaging MyKunda.

We have your message and a member of our team will reply here within 1–2 working days. Office hours are 9:00–18:00, Monday to Saturday.

In the meantime you can browse every property and plot we list at mykunda.com.

One thing worth knowing: MyKunda never asks you to send money for a property through us. We only charge listing and service fees.

— The MyKunda team`;
}

// Follow-ups are appended to leads.message, so cap the total length to keep
// the column (and the notification email) from growing without limit.
const MAX_MESSAGE_CHARS = 4000;

const SHARED_KEY = Deno.env.get("NOTIFY_SHARED_KEY") || "";

function ok(body: Record<string, unknown> = { ok: true }, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/* Constant in de tijd. De oude lus brak af bij het eerste verschil. */
function sameHex(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Alles wat een mens in WhatsApp kan intikken of aantikken, in de vorm waarin
   de Cloud API het aanlevert. Zonder deze functie kwam alleen een gewoon
   tekstbericht binnen. */
// deno-lint-ignore no-explicit-any
function textOf(m: Record<string, any>): string {
  return (
    m?.text?.body ||
    m?.image?.caption ||
    m?.video?.caption ||
    m?.document?.caption ||
    m?.document?.filename ||
    m?.button?.text ||
    m?.interactive?.button_reply?.title ||
    m?.interactive?.list_reply?.title ||
    m?.caption ||
    ""
  );
}

/* Een bericht zonder tekst is nog steeds een klant die iets stuurde. De
   soort erbij zetten voorkomt een lege lead waar het team niets mee kan. */
// deno-lint-ignore no-explicit-any
function kindNote(m: Record<string, any>): string {
  const t = String(m?.type ?? "");
  if (t === "image") return "[sent a photo]";
  if (t === "video") return "[sent a video]";
  if (t === "audio") return "[sent a voice note]";
  if (t === "document") return "[sent a document]";
  if (t === "location") return "[shared a location]";
  if (t === "contacts") return "[shared a contact]";
  if (t === "sticker") return "[sent a sticker]";
  return "";
}

async function waNotify(supabaseUrl: string, to: string, text: string): Promise<void> {
  const r = await fetch(`${supabaseUrl}/functions/v1/wa-notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // wa-notify eist sinds 30-08-2026 deze sleutel; hij was een open relay.
      "x-notify-key": SHARED_KEY,
    },
    body: JSON.stringify({ to, text }),
  });
  // Een 503 of 400 is geen exceptie, dus die werd hiervoor volledig ingeslikt.
  // Precies daarom merkte niemand dat de Cloud API niet geconfigureerd stond en
  // er dus nooit een auto-reply of verificatiebevestiging uitging.
  if (!r.ok) {
    console.error("wa-notify antwoordde", r.status, (await r.text()).slice(0, 300));
  }
}

async function handleMessage(
  // deno-lint-ignore no-explicit-any
  sb: any,
  supabaseUrl: string,
  supabaseKey: string,
  // deno-lint-ignore no-explicit-any
  message: Record<string, any>,
  contactName: string,
): Promise<Record<string, unknown>> {
  const from = message.from; // phone number without +
  const rawText = textOf(message);
  const note = rawText ? "" : kindNote(message);
  const msgText = rawText || note;
  const phoneFormatted = "+" + from;

  // ---- Number verification -------------------------------------------
  // A message that is only a MyKunda code is not an enquiry: it is somebody
  // proving that this WhatsApp number is theirs (see wa-verify). It gets
  // confirmed and the function stops here — no lead, no team email, no
  // auto-reply about a property nobody asked about.
  const codeMatch = String(rawText).match(/MYKUNDA[-\s]?([A-Z2-9]{8})/i);
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

    const row = pending?.[0] as { id: string; expires_at: string; verified_at: string | null } | undefined;
    const fresh = !!row && !row.verified_at && new Date(row.expires_at) > new Date();
    /* Al bevestigd? Dan is dit een herhaling van Meta of van de verkoper zelf.
       Die kreeg tot nu toe "That code has expired or was already used" na een
       geslaagde bevestiging — verwarrend, en een voorspelbare supportvraag. */
    const repeat = !!row && !!row.verified_at;
    if (fresh) {
      await sb.from("phone_verifications")
        .update({ phone: phoneFormatted, verified_at: new Date().toISOString() })
        .eq("id", row!.id);
    }
    try {
      await waNotify(
        supabaseUrl,
        phoneFormatted,
        fresh || repeat
          ? `Thank you — ${phoneFormatted} is now confirmed as your WhatsApp number on MyKunda. You can go back to the page you were on.`
          : "That code has expired or was already used. Please start again on MyKunda and we will give you a new one.",
      );
    } catch (e) {
      console.warn("wa-verify ack failed:", (e as Error).message);
    }
    return { verification: fresh ? "confirmed" : repeat ? "already" : "stale" };
  }

  const payload = {
    wa_message_id: message.id,
    wa_from: from,
    wa_contact_name: contactName,
    wa_timestamp: message.timestamp,
    wa_type: message.type ?? null,
  };

  /* Same sender within 5 minutes = same conversation, not a new lead.
     Alleen leads die van WhatsApp komen tellen mee: zonder dit filter slokte
     het venster een lead op die net via een webformulier met hetzelfde nummer
     binnenkwam, en werd de WhatsApp-tekst daaronder geplakt. */
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: existing } = await sb
    .from("leads")
    .select("id, message, payload")
    .eq("phone", phoneFormatted)
    .gte("created_at", fiveMinAgo)
    .order("created_at", { ascending: false })
    .limit(3);

  // deno-lint-ignore no-explicit-any
  const prior = (existing ?? []).find((l: Record<string, any>) => !!l?.payload?.wa_message_id) as
    { id: string; message: string | null } | undefined;

  let leadId: string | null = prior?.id ?? null;
  const isFollowUp = !!leadId;
  // A follow-up only earns a new notification when it actually adds text —
  // otherwise ten stray lines would mean ten emails.
  let followUpAddsText = false;

  if (leadId) {
    // Classic WhatsApp habit: "Hi" first, the real question second. Appending
    // instead of overwriting keeps both, so the question reaches the team.
    const previous: string = prior?.message ?? "";
    const addition = String(msgText).trim();
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
    leadId = (ins.data as { id: string } | null)?.id ?? null;
  }

  // Team notification — the branded email, same as any web form.
  if (leadId && (!isFollowUp || followUpAddsText)) {
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/notify-lead`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
          "x-notify-key": SHARED_KEY,
        },
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
      await waNotify(supabaseUrl, phoneFormatted, whatsappAutoReply(contactName));
    } catch (e) {
      console.warn("wa-notify auto-reply failed:", (e as Error).message);
    }
  }

  return { lead_id: leadId, follow_up: isFollowUp };
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Meta verifies the webhook with a GET
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const verifyToken = Deno.env.get("WA_VERIFY_TOKEN") || "";
    if (!verifyToken) {
      console.error("wa-inbound: WA_VERIFY_TOKEN is niet gezet — verificatie geweigerd.");
      return new Response("Not configured", { status: 503 });
    }
    if (mode === "subscribe" && token === verifyToken) return new Response(challenge, { status: 200 });
    return new Response("Forbidden", { status: 403 });
  }

  try {
    /* Meta signs every webhook POST. Fail closed: zonder WA_APP_SECRET is er
       geen enkele controle en is dit endpoint een open deur naar de leadtabel
       en naar de nummerverificatie. Meta stuurt bij een niet-2xx opnieuw, dus
       een 503 hier betekent dat er niets verloren gaat zodra de secret staat. */
    const raw = await req.text();
    const appSecret = Deno.env.get("WA_APP_SECRET");
    if (!appSecret) {
      console.error("wa-inbound: WA_APP_SECRET is niet gezet — payload geweigerd.");
      return ok({ ok: false, error: "signature_check_not_configured" }, 503);
    }
    const sig = (req.headers.get("x-hub-signature-256") || "").replace(/^sha256=/, "");
    const mac = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(appSecret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", mac, new TextEncoder().encode(raw));
    const expected = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (!sameHex(sig, expected)) {
      console.warn("wa-inbound: bad signature, ignoring payload");
      return ok();
    }

    const body = JSON.parse(raw);
    const value = body.entry?.[0]?.changes?.[0]?.value;

    if (!value || !value.messages || !value.messages.length) {
      // Status update or other non-message event — acknowledge
      return ok();
    }

    const sb = createClient(supabaseUrl, supabaseKey);
    const contact = value.contacts?.[0];
    const contactName = contact?.profile?.name || "";
    const results: Record<string, unknown>[] = [];

    // Alle berichten uit de batch, op volgorde. Bewust sequentieel: het
    // vijfminutenvenster hieronder leest wat het vorige bericht net schreef.
    for (const message of value.messages) {
      results.push(await handleMessage(sb, supabaseUrl, supabaseKey, message, contactName));
    }

    return ok({ ok: true, handled: results.length, results });
  } catch (e) {
    console.error("wa-inbound error:", e);
    // Always 200 to Meta — otherwise it retries the same message for hours.
    return ok({ ok: false, error: (e as Error).message });
  }
});
