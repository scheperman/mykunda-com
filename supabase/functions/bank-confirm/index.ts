// =====================================================================
// MyKunda - bank-confirm
// ---------------------------------------------------------------------
// Een afschriftregel handmatig afhandelen: koppelen aan een referentie,
// bevestigen, of wegleggen. Alleen voor rol 'admin'.
//
// acties:
//   confirm  - regel bevestigen; betaling gaat naar succeeded
//   link     - regel aan een andere referentie hangen (optioneel meteen
//              bevestigen met confirm: true)
//   ignore   - regel is geen MyKunda-betaling, uit de inbox halen
//
// MAILT NIET. Sinds 23-08-2026 hangt de bon aan de klant en de melding
// aan de backoffice aan de statuswissel van de betaling zelf (trigger
// payments_notify_status -> notify_payment_status_change). Dat moest wel:
// de automatische afletterroute (auto_confirm_exact_bank_lines) roept
// confirm_bank_line RECHTSTREEKS in de database aan en kwam hier dus
// nooit langs — waardoor juist de betalingen waarbij referentie én bedrag
// exact klopten stilletjes werden afgehandeld, zonder bon en zonder
// melding. Zet hier geen aanroep naar notify-payment terug: dan gaat
// alles wat je met de hand bevestigt dubbel de deur uit.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://mykunda.com,https://www.mykunda.com"
).split(",").map((s) => s.trim()).filter(Boolean);

function cors(origin: string | null): Record<string, string> {
  const allow = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401, headers);

  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: "unauthorized" }, 401, headers);

  const { data: profiel } = await admin
    .from("profiles").select("role").eq("id", userData.user.id).maybeSingle();
  if (profiel?.role !== "admin") return json({ error: "forbidden" }, 403, headers);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, headers); }

  const lineId = Number(body.line_id);
  const actie = String(body.action ?? "confirm");
  const notitie = body.note ? String(body.note) : null;

  if (!Number.isFinite(lineId)) return json({ error: "line_id_required" }, 400, headers);

  // --- wegleggen ------------------------------------------------------
  if (actie === "ignore") {
    const { error } = await admin.from("bank_statement_lines").update({
      state: "ignored",
      payment_id: null,
      resolved_by: userData.user.id,
      resolved_at: new Date().toISOString(),
      note: notitie ?? "Geen MyKunda-betaling.",
    }).eq("id", lineId);
    if (error) return json({ error: error.message }, 400, headers);
    return json({ ok: true, actie: "genegeerd" }, 200, headers);
  }

  // --- aan een referentie hangen --------------------------------------
  if (actie === "link" || body.payment_reference) {
    const ref = String(body.payment_reference ?? "").toUpperCase().trim();
    if (!/^MK-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{7}$/.test(ref)) {
      return json({ error: "ongeldige_referentie", verwacht: "MK-XXXXXXX" }, 400, headers);
    }

    const { data: betaling } = await admin.from("payments")
      .select("id, status, method, amount_minor, reference")
      .eq("reference", ref).maybeSingle();

    if (!betaling) return json({ error: "betaling_niet_gevonden", referentie: ref }, 404, headers);
    if (betaling.method !== "bank_transfer") {
      return json({ error: "geen_bankoverschrijving", referentie: ref, methode: betaling.method }, 400, headers);
    }
    if (betaling.status !== "pending") {
      return json({ error: "betaling_niet_meer_open", referentie: ref, status: betaling.status }, 409, headers);
    }

    const { error } = await admin.from("bank_statement_lines").update({
      payment_id: betaling.id,
      match_confidence: "reference",
      state: "suggested",
      note: notitie ?? `Handmatig gekoppeld aan ${ref}.`,
    }).eq("id", lineId);
    if (error) return json({ error: error.message }, 400, headers);

    if (actie === "link" && body.confirm !== true) {
      return json({ ok: true, actie: "gekoppeld", referentie: ref }, 200, headers);
    }
  }

  // --- bevestigen ------------------------------------------------------
  // confirm_bank_line zet de betaling op 'succeeded'. De bon aan de klant
  // en de melding aan de backoffice volgen daar automatisch uit, via de
  // trigger op payments. Hier hoeft dus verder niets te gebeuren.
  const { data, error } = await admin.rpc("confirm_bank_line", {
    p_line_id: lineId,
    p_admin: userData.user.id,
    p_note: notitie,
  });

  if (error) return json({ error: "bevestigen_mislukt", detail: error.message }, 400, headers);

  return json({ ok: true, actie: "bevestigd", resultaat: data }, 200, headers);
});
