// ============================================================
//  MyKunda — Edge Function: unsubscribe
//  Zet berichtmeldingen uit zonder dat iemand hoeft in te loggen,
//  via het geheime token uit profiles.unsubscribe_token.
//
//    GET  /unsubscribe?t=<token>            → bevestigingspagina met knop
//    POST /unsubscribe?t=<token>            → voert het uit
//
//  Sinds 30-08-2026 hangt er een tweede soort aan dezelfde link:
//    &k=messages  (of niets)  → profiles.notify_messages
//    &k=plans                 → profiles.notify_plan_expiry
//  Zonder k blijft alles precies als het was, dus oude links in verstuurde
//  mails blijven werken. Twee soorten en niet één schakelaar, want "geen
//  aanbiedingen meer" mag nooit stilletjes ook de berichten over je eigen
//  gesprekken uitzetten.
//
//  GET voert bewust niets uit: mailscanners en previews halen links
//  op zonder dat een mens klikt, en zouden mensen anders ongevraagd
//  uitschrijven. Mailclients die List-Unsubscribe-Post ondersteunen
//  doen een POST en werken dus met één klik.
//
//  Deploy:  supabase functions deploy unsubscribe --no-verify-jwt
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE = "https://mykunda.com";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* De voornaam uit profiles.full_name kwam hier tot 30-08-2026 ongefilterd in
   de <title> en de <h1>. Een gebruiker zet zijn eigen naam, dus een naam zonder
   spaties met een tag erin voerde script uit op het functions-domein.
   email-template.ts gebruikt overal esc(); deze functie importeert die helpers
   niet, dus staat hij hier. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* backOn: het token, als de pagina ook een "weer aanzetten"-knop moet tonen.
   Er was tot 30-08-2026 geen weg terug via deze link — alleen inloggen op het
   dashboard. Voor iemand die zich uitschreef juist omdát hij niet kon inloggen,
   was dat een doodlopende weg. */
function page(title: string, body: string, showForm: string | null = null, status = 200, backOn: string | null = null) {
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)} — MyKunda</title>
<style>
  body{margin:0;background:#F3F0E8;color:#18201D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#fff;border:1px solid #EDE9DF;border-radius:14px;padding:36px 34px;max-width:520px;width:100%}
  h1{font-size:22px;margin:0 0 12px;letter-spacing:-.01em}
  p{font-size:15.5px;line-height:1.65;color:#384640;margin:0 0 14px}
  button{background:#15463A;color:#fff;border:0;border-radius:9px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer}
  a.link{color:#15463A;font-weight:700;text-decoration:none}
  .muted{font-size:13px;color:#8A958E}
</style></head><body><div class="card">
<h1>${esc(title)}</h1>
${body}
${showForm ? `<form method="POST" action="?t=${showForm}"><button type="submit">Turn off these emails</button></form>` : ""}
${backOn ? `<form method="POST" action="?t=${backOn}&amp;on=1"><button type="submit" style="background:#fff;color:#15463A;border:1px solid #15463A">Turn them back on</button></form>` : ""}
<p class="muted" style="margin-top:18px">You can change this any time in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* De twee soorten, met per soort de kolom en de teksten. Alles wat de pagina
   zegt staat hier, zodat er geen tekst over "berichten" op een afmelding voor
   iets anders kan belanden. */
type Soort = {
  column: "notify_messages" | "notify_plan_expiry";
  askTitle: (n: string) => string;
  askBody: string;
  offTitle: (n: string) => string;
  offBody: string;
  onTitle: (n: string) => string;
  onBody: string;
  alreadyBody: string;
};
const SOORTEN: Record<string, Soort> = {
  messages: {
    column: "notify_messages",
    askTitle: (n) => (n ? `${n}, turn off message emails?` : "Turn off message emails?"),
    askBody: `<p>You are about to stop receiving an email when someone sends you a message on MyKunda. Your conversations keep working — you will just have to open Messages yourself to see new ones.</p>
       <p>Emails about viewings, listings and payments are not affected.</p>`,
    offTitle: (n) => (n ? `Done, ${n}` : "Done"),
    offBody: `<p>You will no longer get an email when someone sends you a message on MyKunda.</p>
         <p>Your conversations keep working — new messages are still waiting for you in <a class="link" href="${SITE}/messages.html">Messages</a>. Emails about viewings, listings and payments are unaffected.</p>`,
    onTitle: (n) => (n ? `Back on, ${n}` : "Back on"),
    onBody: `<p>You will get an email again when someone sends you a message on MyKunda.</p>`,
    alreadyBody: `<p>Message emails are already off for this account. Changed your mind?</p>`,
  },
  plans: {
    column: "notify_plan_expiry",
    askTitle: (n) => (n ? `${n}, turn off renewal reminders?` : "Turn off renewal reminders?"),
    askBody: `<p>You are about to stop receiving an email when a Boost or a Verified check on one of your listings is about to run out, or has run out.</p>
       <p>Your listings, your conversations and your payment receipts are not affected. You can always see what is running out in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>`,
    offTitle: (n) => (n ? `Done, ${n}` : "Done"),
    offBody: `<p>You will no longer get an email when a Boost or a Verified check runs out.</p>
         <p>Nothing else changes: your listings stay online, and what is running out is still shown under each listing in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>`,
    onTitle: (n) => (n ? `Back on, ${n}` : "Back on"),
    onBody: `<p>You will get an email again when a Boost or a Verified check is about to run out.</p>`,
    alreadyBody: `<p>Renewal reminders are already off for this account. Changed your mind?</p>`,
  },
};

serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") ?? "").trim();
  /* Onbekende k valt terug op 'messages': dat is wat elke link deed voordat
     deze parameter bestond, en een afmeldlink hoort nooit te falen. */
  const kind = SOORTEN[(url.searchParams.get("k") ?? "").trim()] ? (url.searchParams.get("k") ?? "").trim() : "messages";
  const soort = SOORTEN[kind];
  /* &amp; en niet &, want dit stukje gaat rechtstreeks in een action-attribuut
     in de HTML van page(). */
  const qk = kind === "messages" ? "" : `&amp;k=${encodeURIComponent(kind)}`;

  if (!UUID_RE.test(token)) {
    return page("Link not valid", `<p>This unsubscribe link is incomplete or has expired. Open <a class="link" href="${SITE}/dashboard.html">My MyKunda</a> and change your email settings there.</p>`, null, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: profile } = await db
      .from("profiles")
      .select(`id, full_name, ${soort.column}`)
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (!profile) {
      return page("Link not valid", `<p>We could not match this link to an account. Open <a class="link" href="${SITE}/dashboard.html">My MyKunda</a> and change your email settings there.</p>`, null, 404);
    }

    const name = profile.full_name ? String(profile.full_name).trim().split(" ")[0] : "";
    const aanNu = (profile as Record<string, unknown>)[soort.column] !== false;

    if (req.method === "POST") {
      const weerAan = url.searchParams.get("on") === "1";
      const { error } = await db
        .from("profiles")
        .update({ [soort.column]: weerAan })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      if (weerAan) return page(soort.onTitle(name), soort.onBody);

      return page(soort.offTitle(name), soort.offBody, null, 200, token + qk);
    }

    if (!aanNu) {
      return page("Already turned off", soort.alreadyBody, null, 200, token + qk);
    }

    return page(soort.askTitle(name), soort.askBody, token + qk);
  } catch (err) {
    console.error("unsubscribe error:", err);
    return page("Something went wrong", `<p>We could not process this just now. Please try again later, or change your email settings in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>`, null, 500);
  }
});
