// ============================================================
//  MyKunda — Edge Function: notify-health
//  Eén mail per dag, en alleen als er iets te melden is.
//
//  WAAROM DEZE FUNCTIE BESTAAT (30-08-2026)
//  Alle databasetriggers versturen hun mail met net.http_post: dat is
//  fire-and-forget. De statuscode wordt nooit gelezen, er is geen retry,
//  geen wachtrij en geen alarm. Een mail die faalt op het moment dat
//  Resend hapert, is definitief weg — en niemand die het ziet. Dat geldt
//  voor de bon, de bezichtigingsherinnering, de voortgang van een
//  titelcontrole en de statusmail van een advertentie.
//
//  Een echte retry bouwen kan niet zonder wachtrij. Wat wél kan, is
//  stilte omzetten in een signaal: elke ochtend kijken wat er de
//  afgelopen 24 uur is misgegaan en dat één keer mailen. Staat er niets
//  in, dan gaat er ook niets uit — een dagelijkse "alles in orde"-mail
//  leert je die mail te negeren, en dan mis je juist de dag dat het
//  ertoe doet.
//
//  Gekeken wordt naar vier dingen:
//   · email_events met payload.ok = false      (verzending mislukt)
//   · email_events met bounced/complained/failed (aflevering mislukt)
//   · leads met notify_error gevuld            (lead niet gemeld)
//   · profiles met email_bounced_at gevuld     (gebruiker onbereikbaar)
//
//  Deploy:  supabase functions deploy notify-health --no-verify-jwt
//  Cron:    30 7 * * *  →  select public.run_mail_health_check()
//  Secrets: RESEND_API_KEY, NOTIFY_SHARED_KEY
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND, emailWrap, esc, escOpt, detailTable, sectionLabel, callout, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const ADMIN_EMAIL    = "admin@mykunda.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SHARED_KEY     = Deno.env.get("NOTIFY_SHARED_KEY") ?? "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-notify-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function sameKey(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Zelfde poort als de andere interne functies.
function toegestaan(req: Request): boolean {
  if (!SHARED_KEY) return true;
  return sameKey(req.headers.get("x-notify-key") ?? "", SHARED_KEY);
}

const fmt = (v: string) =>
  new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Banjul" });

/** Een tabelletje van maximaal vijf regels, met een teller als er meer zijn. */
function lijst(titel: string, regels: [string, unknown][][], totaal: number): string {
  if (!totaal) return "";
  const blokken = regels.slice(0, 5).map((rij) => detailTable(rij)).join('<div style="height:8px"></div>');
  const meer = totaal > regels.length || regels.length > 5
    ? `<p style="font-size:13px;color:${BRAND.muted};margin:8px 0 0">${totaal} in totaal — de rest staat in de tabel.</p>`
    : "";
  return `${sectionLabel(titel)}${blokken}${meer}`;
}

async function sendEmail(subject: string, html: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [ADMIN_EMAIL], subject, html, text: toText(html) }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text()}`);
  return r.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!toegestaan(req)) return json({ ok: false, error: "unauthorized" }, 401);
  if (!RESEND_API_KEY) return json({ ok: false, error: "mail_not_configured" }, 503);

  const db = createClient(SUPABASE_URL, SERVICE_KEY);
  const sinds = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1) Verzending mislukt — de functie kreeg een fout terug van Resend.
    const { data: mislukt } = await db
      .from("email_events")
      .select("event_type, recipient, subject, reason, created_at")
      .eq("payload->>ok", "false")
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(50);

    // 2) Aflevering mislukt — Resend meldde het achteraf via de webhook.
    const { data: geweigerd } = await db
      .from("email_events")
      .select("event_type, recipient, subject, reason, created_at")
      .in("event_type", ["bounced", "complained", "failed"])
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(50);

    // 3) Leads die wel binnenkwamen maar niet gemeld konden worden.
    const { data: leads } = await db
      .from("leads")
      .select("id, source, email, notify_error, created_at")
      .not("notify_error", "is", null)
      .gte("created_at", sinds)
      .order("created_at", { ascending: false })
      .limit(50);

    // 4) Gebruikers die geen mail meer kunnen ontvangen. Geen tijdvenster:
    //    dit blijft staan tot iemand het oplost, en dat is precies de
    //    bedoeling — deze mensen kunnen niet meer inloggen.
    const { data: geblokkeerd } = await db
      .from("profiles")
      .select("email, email_bounced_at, email_bounce_reason")
      .not("email_bounced_at", "is", null)
      .order("email_bounced_at", { ascending: false })
      .limit(50);

    const n = {
      verzending: mislukt?.length ?? 0,
      aflevering: geweigerd?.length ?? 0,
      leads: leads?.length ?? 0,
      geblokkeerd: geblokkeerd?.length ?? 0,
    };
    const totaal = n.verzending + n.aflevering + n.leads + n.geblokkeerd;

    if (!totaal) {
      // Stil is goed. Geen mail — zie de kop van dit bestand.
      return json({ ok: true, quiet: true, checked_since: sinds });
    }

    const html = emailWrap({
      heading: "Mail that did not arrive",
      preheader: `${totaal} thing${totaal === 1 ? "" : "s"} to look at from the past 24 hours.`,
      body: `<p style="margin:0 0 14px">This is the daily check on everything MyKunda tried to send. It only goes out when there is something in it.</p>
        ${callout(`<p style="font-size:14px;color:${BRAND.ink};margin:0"><strong>${totaal} item${totaal === 1 ? "" : "s"}.</strong> ${n.verzending} send failure${n.verzending === 1 ? "" : "s"}, ${n.aflevering} delivery failure${n.aflevering === 1 ? "" : "s"}, ${n.leads} lead${n.leads === 1 ? "" : "s"} that could not be notified, ${n.geblokkeerd} account${n.geblokkeerd === 1 ? "" : "s"} that can no longer receive mail.</p>`, totaal > 5 ? "red" : "amber")}
        ${lijst("Send failed", (mislukt ?? []).map((r) => ([
          ["When", esc(fmt(r.created_at))],
          ["Type", escOpt(r.event_type)],
          ["To", escOpt(r.recipient)],
          ["Subject", escOpt(r.subject)],
          ["Reason", escOpt(r.reason)],
        ] as [string, unknown][])), n.verzending)}
        ${lijst("Delivery failed", (geweigerd ?? []).map((r) => ([
          ["When", esc(fmt(r.created_at))],
          ["Type", escOpt(r.event_type)],
          ["To", escOpt(r.recipient)],
          ["Subject", escOpt(r.subject)],
          ["Reason", escOpt(r.reason)],
        ] as [string, unknown][])), n.aflevering)}
        ${lijst("Leads not notified", (leads ?? []).map((r) => ([
          ["When", esc(fmt(r.created_at))],
          ["Source", escOpt(r.source)],
          ["Email", escOpt(r.email)],
          ["Error", escOpt(r.notify_error)],
        ] as [string, unknown][])), n.leads)}
        ${lijst("Accounts we can no longer reach", (geblokkeerd ?? []).map((r) => ([
          ["Email", escOpt(r.email)],
          ["Since", r.email_bounced_at ? esc(fmt(r.email_bounced_at)) : undefined],
          ["Reason", escOpt(r.email_bounce_reason)],
        ] as [string, unknown][])), n.geblokkeerd)}
        ${n.geblokkeerd ? `<p style="margin:18px 0 0;font-size:14px;color:${BRAND.muted}">An account in that last list cannot sign in either — the code never arrives. Clear <code>profiles.email_bounced_at</code> once they have a working address.</p>` : ""}`,
      cta: "Open admin console",
      ctaUrl: `${BRAND.site}/admin.html`,
      footer: "Daily check on outgoing mail. Sent only when there is something to report.",
    });

    await sendEmail(
      `[MyKunda] ${totaal} mail issue${totaal === 1 ? "" : "s"} in the past 24 hours`,
      html,
    );

    return json({ ok: true, quiet: false, counts: n, checked_since: sinds });
  } catch (e) {
    console.error("notify-health error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
