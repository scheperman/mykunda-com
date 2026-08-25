// =====================================================================
// MyKunda - waychit-webhook
// ---------------------------------------------------------------------
// Dit is de ENIGE bron van waarheid over of er betaald is. Niet de
// terugkeer van de klant naar de bedankpagina.
//
// verify_jwt staat op false omdat Waychit geen Supabase-token stuurt.
// De authenticatie gebeurt hier met de handtekening in de header
// Waychit-Signature. Zonder geldige handtekening wordt er niets verwerkt.
//
// Handtekening volgens de Waychit-documentatie:
//   Waychit-Signature: t=<unix>,v1=<hex>[,v1=<hex>]
//   payload  = "<t>." + ruwe body
//   v1       = HMAC SHA256(payload, webhook signing secret), hex
//   meerdere v1-waarden komen voor tijdens het roteren van het secret
//   de tijdstempel mag niet ouder zijn dan 5 minuten
//
// Waychit probeert een webhook tot 24 uur opnieuw als wij geen 2xx
// teruggeven. We geven daarom alleen een 5xx terug als het echt aan ons
// ligt (opslagfout); al het andere sluiten we af met een 200.
//
// MAILT NIET. Sinds 23-08-2026 hangt de klant- en backofficemail aan de
// statuswissel van de betaling zelf (trigger payments_notify_status ->
// notify_payment_status_change), niet aan de route die de status zet.
// Deze functie hoeft dus alleen de status goed weg te schrijven; de mail
// volgt daar automatisch uit. Zet hier geen aanroep naar notify-payment
// terug: dan gaat alles dubbel.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PROVIDER = "waychit";
const MAX_LEEFTIJD_SECONDEN = 5 * 60;

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(message: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(message));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Vergelijking die geen informatie lekt via de duur van de vergelijking.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function parseSignatureHeader(header: string): { t: string | null; v1: string[] } {
  const delen = header.split(",").map((d) => d.trim()).filter(Boolean);
  let t: string | null = null;
  const v1: string[] = [];
  for (const deel of delen) {
    const i = deel.indexOf("=");
    if (i < 0) continue;
    const sleutel = deel.slice(0, i).trim();
    const waarde = deel.slice(i + 1).trim().toLowerCase();
    if (sleutel === "t") t = waarde;
    else if (sleutel === "v1") v1.push(waarde);
  }
  return { t, v1 };
}

// Statussen waar we niet meer vanaf stappen op basis van een late webhook.
const TERMINAL = ["succeeded", "failed", "cancelled", "expired", "refunded"];

// Woorden die in het statusveld van de payload op mislukken wijzen. Zien
// we er hier een, dan is de betaling NIET geslaagd, ongeacht de naam van
// de gebeurtenis.
const MISLUKT: Record<string, string> = {
  failed: "failed",
  failure: "failed",
  declined: "failed",
  error: "failed",
  cancelled: "cancelled",
  canceled: "cancelled",
  abandoned: "cancelled",
  expired: "expired",
  refunded: "refunded",
  reversed: "refunded",
};

// Woorden die in het statusveld op een GESLAAGDE betaling wijzen.
//
// Dit lijstje is er omdat de vorige versie succes uitsluitend afleidde uit
// de naam van de gebeurtenis ("eindigt op .completed"). De enige echte
// payloads die we ooit binnen hebben gekregen — nog van Modem Pay, en
// terug te vinden in payment_events — heetten `charge.succeeded` en
// droegen `"status": "completed"`. Zou Waychit zijn gebeurtenis net zo
// noemen, dan werd een geslaagde betaling STIL genegeerd: geen status,
// geen mail, geen plan, en een 200 terug alsof alles goed ging. Het
// statusveld van de payload is een tweede, onafhankelijke weg naar
// dezelfde conclusie.
const GESLAAGD = [
  "succeeded", "success", "successful", "completed", "complete",
  "paid", "captured", "settled", "approved",
];

// Onze eigen referentie heeft een vaste vorm: MK- gevolgd door zeven
// tekens uit een alfabet zonder 0/1/I/L/O, zodat hij aan de balie van de
// bank niet verkeerd wordt overgeschreven.
const REF_PATROON = /^MK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/;

function onzeReferentie(waarde: unknown): string | null {
  const s = String(waarde ?? "").toUpperCase().trim();
  return REF_PATROON.test(s) ? s : null;
}

// Haal een waarde op uit de payload, ongeacht of Waychit hem bovenin of
// in een genest object zet. De exacte vorm van de payload staat niet in
// de publieke documentatie, dus we zoeken breed in plaats van te gokken.
function pluk(payload: any, velden: string[]): any {
  for (const w of plukAlle(payload, velden)) return w;
  return null;
}

// Zelfde zoektocht, maar dan ALLE treffers in plaats van de eerste.
//
// Nodig voor de referentie. `reference` is bij providers vaak hun EIGEN
// transactienummer (de Modem Pay-payloads in payment_events dragen
// bijvoorbeeld `"reference": "MP-20260812-083547-84D047B2"`), terwijl
// onze eigen referentie onder `clientReference` staat — mogelijk een
// niveau dieper. Wie dan de eerste treffer pakt, zoekt de betaling op het
// verkeerde nummer, vindt niets, en geeft stilletjes 200 terug. Door alle
// kandidaten te verzamelen en er die uit te kiezen die er als MK-XXXXXXX
// uitziet, kan dat niet meer misgaan.
function plukAlle(payload: any, velden: string[]): any[] {
  const bronnen = [
    payload,
    payload?.data,
    payload?.paymentRequest,
    payload?.paymentSession,
    payload?.data?.paymentRequest,
    payload?.data?.paymentSession,
  ];
  const uit: any[] = [];
  for (const bron of bronnen) {
    if (!bron || typeof bron !== "object") continue;
    for (const veld of velden) {
      const w = bron[veld];
      if (w !== undefined && w !== null && w !== "") uit.push(w);
    }
  }
  return uit;
}

// Waychit stuurt paidDate mee als ISO-string. Die is nauwkeuriger dan het
// moment waarop deze functie draait: bij een herhaalde levering kan dat
// uren later zijn. Is de waarde onbruikbaar, dan valt hij terug op nu —
// een kapotte datum mag de webhook nooit laten mislukken.
function isoOfNu(waarde: unknown): string {
  if (typeof waarde === "string" || typeof waarde === "number") {
    const d = new Date(waarde as any);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  // De ruwe body, ONGEPARSEERD. De handtekening is over deze exacte bytes
  // berekend; JSON eerst parsen en weer serialiseren maakt hem ongeldig.
  const raw = await req.text();
  const header = req.headers.get("Waychit-Signature") ??
    req.headers.get("waychit-signature") ?? "";

  const secret = Deno.env.get("WAYCHIT_WEBHOOK_SECRET");
  if (!secret) {
    console.error("WAYCHIT_WEBHOOK_SECRET ontbreekt in de omgeving");
    return new Response("not configured", { status: 503 });
  }

  const { t, v1 } = parseSignatureHeader(header);

  let verified = false;
  let weigerreden = "geen geldige handtekening";

  if (!t || v1.length === 0) {
    weigerreden = "handtekening-header ontbreekt of is onvolledig";
  } else if (!/^\d+$/.test(t)) {
    weigerreden = "tijdstempel is geen getal";
  } else {
    const leeftijd = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
    if (leeftijd > MAX_LEEFTIJD_SECONDEN) {
      weigerreden = `tijdstempel is ${leeftijd} seconden oud`;
    } else {
      const verwacht = await hmacSha256Hex(secret, `${t}.${raw}`);
      verified = v1.some((s) => timingSafeEqual(verwacht, s));
    }
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let parsed: any = null;
  try { parsed = JSON.parse(raw); } catch { /* hieronder afgevangen */ }

  const eventType: string = parsed?.event ?? parsed?.type ?? parsed?.eventType ?? "unknown";
  const payload = parsed?.payload ?? parsed?.data ?? parsed ?? {};

  // Sleutel waarop we duplicaten herkennen: het id van de gebeurtenis als
  // die er is, anders een hash van de body.
  const dedupeKey: string = String(
    parsed?.id ?? parsed?.eventId ?? payload?.event_id ?? payload?.id ?? await sha256Hex(raw),
  );

  // Niet-geverifieerde pogingen loggen we wel, maar we voeren ze niet uit.
  if (!verified) {
    await admin.from("payment_events").insert({
      provider: PROVIDER,
      dedupe_key: `unverified:${dedupeKey}`,
      event_type: eventType,
      signature_verified: false,
      applied: false,
      raw: parsed ?? { unparsed: raw.slice(0, 4000) },
    });
    console.warn("webhook geweigerd:", weigerreden, eventType);
    return new Response("invalid signature", { status: 401 });
  }

  // --- idempotency ------------------------------------------------------
  // De unique constraint op (provider, dedupe_key) doet het echte werk.
  // Komt dezelfde gebeurtenis nog eens binnen — en Waychit blijft het tot
  // 24 uur proberen als wij niet snel genoeg 2xx teruggeven — dan mislukt
  // deze insert en stoppen we hier. Geen dubbele verwerking.
  const { error: dupErr } = await admin.from("payment_events").insert({
    provider: PROVIDER,
    dedupe_key: dedupeKey,
    event_type: eventType,
    signature_verified: true,
    applied: false,
    raw: parsed,
  });

  if (dupErr) {
    if (dupErr.code === "23505") {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    console.error("kon gebeurtenis niet opslaan", dupErr);
    return new Response("storage error", { status: 500 }); // -> Waychit probeert opnieuw
  }

  const markeer = (velden: Record<string, unknown>) =>
    admin.from("payment_events").update(velden)
      .eq("provider", PROVIDER).eq("dedupe_key", dedupeKey);

  // --- betaling terugvinden --------------------------------------------
  // clientReference is onze eigen referentie (MK-XXXXXXX) en is het enige
  // veld dat we bij payment-requests kunnen meegeven; bij card sessions
  // hebben we daarnaast metadata. Beide wegen worden hier geprobeerd.
  //
  // Alleen een waarde die er ook echt als onze referentie uitziet telt
  // mee. Een `reference` van de provider zelf (MP-..., WC-..., wat dan
  // ook) valt hier af in plaats van tot een mislukte zoekopdracht te
  // leiden — dan blijft provider_intent_id over als tweede weg.
  const refKandidaten = plukAlle(payload, [
    "clientReference", "client_reference", "clientRef",
    "merchantReference", "merchant_reference", "reference",
  ]);
  const clientReference = refKandidaten.map(onzeReferentie).find(Boolean) ?? null;

  if (!clientReference && refKandidaten.length > 0) {
    console.warn(
      "geen MyKunda-referentie in de payload; wel andere referenties gezien:",
      refKandidaten.map((r) => String(r).slice(0, 40)).join(", "),
    );
  }

  const metaReference = onzeReferentie(
    payload?.metadata?.reference ?? payload?.data?.metadata?.reference ?? null,
  );
  const metaPaymentId = payload?.metadata?.mykunda_payment_id ??
    payload?.data?.metadata?.mykunda_payment_id ?? null;
  const providerId = pluk(payload, ["id", "paymentRequestId", "paymentSessionId"]);

  let q = admin.from("payments").select("*").limit(1);
  if (metaPaymentId) q = q.eq("id", String(metaPaymentId));
  else if (clientReference) q = q.eq("reference", clientReference);
  else if (metaReference) q = q.eq("reference", metaReference);
  else if (providerId) q = q.eq("provider_intent_id", String(providerId));
  else {
    console.error("webhook zonder herleidbare betaling", eventType);
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const { data: rows } = await q;
  const payment = rows?.[0];

  if (!payment) {
    console.error("betaling niet gevonden voor webhook", eventType, clientReference, providerId);
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  await markeer({ payment_id: payment.id });

  // --- status bepalen ---------------------------------------------------
  // Waychit stuurt volgens de documentatie twee gebeurtenissen:
  // payment.request.completed en payment.session.completed. "Completed"
  // betekent dat de betaalstroom is afgerond; of dat ook betaald IS,
  // lezen we uit het statusveld van de payload.
  //
  // Drie wegen, in deze volgorde:
  //   1. een expliciet mislukt-woord in het statusveld — dat wint altijd;
  //   2. een expliciet geslaagd-woord in het statusveld;
  //   3. de naam van de gebeurtenis.
  // Weg 2 is er omdat de naam van de gebeurtenis niet vaststaat en een
  // afwijkende naam anders een betaalde betaling stil zou laten liggen.
  const ruweStatus = String(
    pluk(payload, ["status", "state", "paymentStatus"]) ?? "",
  ).toLowerCase();

  let newStatus: string | null = null;
  if (MISLUKT[ruweStatus]) {
    newStatus = MISLUKT[ruweStatus];
  } else if (GESLAAGD.includes(ruweStatus)) {
    newStatus = "succeeded";
  } else if (/\.(completed|succeeded|success|paid|captured)$/.test(eventType)) {
    newStatus = "succeeded";
  }

  // Late of overbodige gebeurtenis: een betaling die al klaar is laten we
  // met rust. Dit vangt de "webhook komt 40 minuten later alsnog" situatie.
  if (!newStatus || TERMINAL.includes(payment.status)) {
    await markeer({ applied: false });
    return new Response(JSON.stringify({ ok: true, ignored: true, event: eventType }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  // De database staat maar een beperkt aantal statusovergangen toe
  // (trg_payments_status_transition). Een overgang die daar niet in past —
  // processing -> refunded bijvoorbeeld — zou een uitzondering geven, en
  // dat vertaalt zich in een 500 waarna Waychit het 24 uur lang blijft
  // proberen. Zo'n gebeurtenis is niet ONZE fout, dus we leggen hem vast
  // en sluiten netjes af.
  const TOEGESTAAN: Record<string, string[]> = {
    pending: ["processing", "succeeded", "failed", "cancelled", "expired"],
    processing: ["succeeded", "failed", "cancelled", "expired"],
    succeeded: ["refunded"],
  };
  if (!(TOEGESTAAN[payment.status] ?? []).includes(newStatus)) {
    console.error(
      "statusovergang niet toegestaan, gebeurtenis vastgelegd maar niet toegepast",
      payment.reference, payment.status, "->", newStatus, eventType,
    );
    await markeer({ applied: false });
    return new Response(JSON.stringify({
      ok: true, ignored: true, reason: "transition_not_allowed",
      from: payment.status, to: newStatus,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  const update: Record<string, unknown> = { status: newStatus, provider: PROVIDER };

  if (newStatus === "succeeded") {
    // paidDate komt uit de payload; ontbreekt hij, dan is het nu.
    update.paid_at = isoOfNu(pluk(payload, ["paidDate", "paid_date", "paidAt"]));

    // Waychit noemt het nummer van de transactie zelf transactionReference.
    // Dat is het nummer waarmee zij een betaling terugzoeken, en het is dus
    // het nummer dat wij bij het afletteren nodig hebben. Zonder deze naam
    // in het rijtje viel de code terug op `id` — het id van de payment
    // request, dat al in provider_intent_id staat.
    const chargeId = pluk(payload, [
      "transactionReference", "chargeId", "charge_id", "transactionId", "id",
    ]);
    update.provider_charge_id = chargeId ? String(chargeId) : null;

    // Kosten van de aggregator vastleggen als ze meekomen. De payloads in
    // de documentatie bevatten geen kostenveld, dus in de praktijk blijft
    // fee_minor leeg en vullen we hem bij het afletteren handmatig aan.
    const fee = pluk(payload, ["fee", "fees", "feeAmount"]);
    if (typeof fee === "number") {
      const feeMinor = Math.round(fee * 100);
      update.fee_minor = feeMinor;
      update.net_minor = payment.amount_minor - feeMinor;
    }
  }

  if (newStatus !== "succeeded") {
    update.failure_reason = String(
      pluk(payload, ["paymentError", "reason", "message", "failureReason"]) ?? eventType,
    ).slice(0, 500);
  }

  const { error: updErr } = await admin.from("payments").update(update).eq("id", payment.id);

  if (updErr) {
    console.error("status bijwerken mislukt", updErr);
    return new Response("update failed", { status: 500 }); // -> Waychit probeert opnieuw
  }

  await markeer({ applied: true });

  // De bon aan de klant en de melding aan de backoffice gaan hier NIET
  // meer vandaan. De trigger op payments doet dat, ongeacht wie de status
  // heeft gezet — deze functie, het afletteren van een bankafschrift, de
  // nachtelijke vervaltaak, of iemand met de hand in de tabel.

  return new Response(JSON.stringify({ ok: true, status: newStatus }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
