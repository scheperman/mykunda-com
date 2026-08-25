// ============================================================
//  MyKunda — Edge Function: unsubscribe
//  Zet berichtmeldingen uit zonder dat iemand hoeft in te loggen,
//  via het geheime token uit profiles.unsubscribe_token.
//
//    GET  /unsubscribe?t=<token>  → bevestigingspagina met knop
//    POST /unsubscribe?t=<token>  → voert het uit
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

function page(title: string, body: string, showForm: string | null = null, status = 200) {
  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} — MyKunda</title>
<style>
  body{margin:0;background:#F3F0E8;color:#18201D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Helvetica Neue',Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#fff;border:1px solid #EDE9DF;border-radius:14px;padding:36px 34px;max-width:520px;width:100%}
  h1{font-size:22px;margin:0 0 12px;letter-spacing:-.01em}
  p{font-size:15.5px;line-height:1.65;color:#384640;margin:0 0 14px}
  button{background:#15463A;color:#fff;border:0;border-radius:9px;padding:14px 28px;font-size:15px;font-weight:700;cursor:pointer}
  a.link{color:#15463A;font-weight:700;text-decoration:none}
  .muted{font-size:13px;color:#8A958E}
</style></head><body><div class="card">
<h1>${title}</h1>
${body}
${showForm ? `<form method="POST" action="?t=${showForm}"><button type="submit">Turn off these emails</button></form>` : ""}
<p class="muted" style="margin-top:18px">You can change this any time in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>
</div></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

serve(async (req) => {
  const url = new URL(req.url);
  const token = (url.searchParams.get("t") ?? "").trim();

  if (!UUID_RE.test(token)) {
    return page("Link not valid", `<p>This unsubscribe link is incomplete or has expired. Open <a class="link" href="${SITE}/dashboard.html">My MyKunda</a> and turn message emails off there.</p>`, null, 400);
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { data: profile } = await db
      .from("profiles")
      .select("id, full_name, notify_messages")
      .eq("unsubscribe_token", token)
      .maybeSingle();

    if (!profile) {
      return page("Link not valid", `<p>We could not match this link to an account. Open <a class="link" href="${SITE}/dashboard.html">My MyKunda</a> and turn message emails off there.</p>`, null, 404);
    }

    const name = profile.full_name ? String(profile.full_name).trim().split(" ")[0] : "";

    if (req.method === "POST") {
      const { error } = await db
        .from("profiles")
        .update({ notify_messages: false })
        .eq("id", profile.id);
      if (error) throw new Error(error.message);

      return page(
        name ? `Done, ${name}` : "Done",
        `<p>You will no longer get an email when someone sends you a message on MyKunda.</p>
         <p>Your conversations keep working — new messages are still waiting for you in <a class="link" href="${SITE}/messages.html">Messages</a>. Emails about viewings, listings and payments are unaffected.</p>`,
      );
    }

    if (!profile.notify_messages) {
      return page(
        "Already turned off",
        `<p>Message emails are already off for this account. Nothing to do.</p>`,
      );
    }

    return page(
      name ? `${name}, turn off message emails?` : "Turn off message emails?",
      `<p>You are about to stop receiving an email when someone sends you a message on MyKunda. Your conversations keep working — you will just have to open Messages yourself to see new ones.</p>
       <p>Emails about viewings, listings and payments are not affected.</p>`,
      token,
    );
  } catch (err) {
    console.error("unsubscribe error:", err);
    return page("Something went wrong", `<p>We could not process this just now. Please try again later, or turn message emails off in <a class="link" href="${SITE}/dashboard.html">My MyKunda</a>.</p>`, null, 500);
  }
});
