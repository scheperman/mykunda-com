// ============================================================
//  MyKunda — Edge Function: auth-email
//  Generates Supabase auth action links server-side with the
//  admin API (supabase.auth.admin.generateLink) and emails them
//  via Resend from noreply@mykunda.com, with the link itself
//  pointing at mykunda.com/auth.html.
//
//  Why: Supabase's own auth mailer sends from + links to your
//  project's *.supabase.co domain unless you buy the "Custom
//  Domain" add-on. Generating the link ourselves and emailing it
//  through Resend gets a correct sender AND link for free.
//
//  2026-08-15 update: signin/signup are now explicit (mode param)
//  instead of being inferred from whether the address exists, and
//  the email_code route looks up existence+confirmation up front
//  via the auth_user_lookup() RPC instead of pattern-matching the
//  error message from generateLink() — that pattern match is what
//  caused an abandoned signup (unconfirmed account) to fall through
//  to Supabase's own mailer (a magic link) instead of a code.
//  Consent is now passed through to the profiles trigger too.
//  Requires backend/auth-flow-fixes.sql to be applied first.
//
//  2026-08-27 update: de rate limit liegt niet meer. Zat een emmer vol, dan
//  kwam er {ok:true, code_length:0} terug en zette het scherm gewoon door naar
//  "we hebben een code gestuurd" terwijl er niets verstuurd was — de bezoeker
//  bleef wachten op een mail die nooit kwam. Nu komt er {ok:false,
//  rate_limited:true, retry_after} terug, mét een leesbare error-tekst zodat
//  ook een front-end van vóór deze wijziging iets zinnigs toont. De IP-emmer is
//  bovendien gesplitst: inloggen op een bestaand account (60/uur) telt niet meer
//  mee met accounts aanmaken (20/uur). Achter de CGNAT van de Gambiaanse
//  providers deelt een hele wijk één IP, en die ene emmer sloot echte
//  gebruikers buiten. De emmer wordt gekozen op de mode die de client meestuurt;
//  liegen daarover levert niets op, want een onbekend adres krijgt sowieso
//  no_account terug en dus geen mail. Elke verstuurde auth-mail wordt nu ook
//  in public.email_events gezet — de code zelf nooit.
//
//  Deploy:  supabase functions deploy auth-email --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authLinkEmail, authCodeEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL       = "https://mykunda.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUBJECT: Record<string, string> = {
  recovery: "Reset your password — MyKunda",
  magiclink: "Your sign-in link — MyKunda",
  signup: "Confirm your email — MyKunda",
  email_code: "Your MyKunda sign-in code",
};

// Rate limit. Twee emmers per verzoek: één per adres+type (tegen dubbelklikken
// en tegen iemand die één adres blijft bestoken) en één per IP (tegen iemand
// die adressen afloopt). De IP-emmers staan los van elkaar, zodat een golf
// aanmeldpogingen vanaf een gedeeld IP het inloggen niet meesleurt.
const CODE_WINDOW_SECONDS = 20;   // per adres, tussen twee codes
const LINK_WINDOW_SECONDS = 60;   // per adres, tussen twee reset-/magic-links
const IP_WINDOW_SECONDS   = 3600;
const IP_MAX_SIGNIN = 60;         // inloggen op een bestaand account
const IP_MAX_SIGNUP = 20;         // account aanmaken
const IP_MAX_LINK   = 20;         // recovery / magiclink

// Gereserveerde testdomeinen (RFC 2606/6761) hebben geen DNS. Amazon SES houdt
// zo'n mail 14 uur in de wachtrij en boekt daarna een bounce op de reputatie
// van mykunda.com. Nooit versturen dus — testen doe je met delivered@resend.dev.
const RESERVED_EMAIL_DOMAIN =
  /(^|\.)(invalid|test|localhost|example|example\.(com|net|org))$/i;

function isReservedTestAddress(addr: string): boolean {
  const domain = String(addr ?? "").trim().toLowerCase().split("@").pop() ?? "";
  return RESERVED_EMAIL_DOMAIN.test(domain);
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ skipped: boolean; id: string | null }> {
  if (isReservedTestAddress(to)) {
    console.warn(`auth-email: geweigerd, gereserveerd testdomein — ${to}`);
    return { skipped: true, id: null };
  }
  /* De platte-tekstvariant ontbrak hier als enige van alle mailfuncties, en
     uitgerekend dit zijn de mails die MOETEN aankomen: de inlogcode en de
     wachtwoord-reset. Een mail zonder text/plain scoort meetbaar slechter bij
     spamfilters en is onleesbaar in tekstclients. (30-08-2026) */
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text: toText(html) }),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("Resend error", errText);
    throw new Error(`Resend ${r.status}: ${errText}`);
  }
  const body = await r.json().catch(() => ({} as any));
  return { skipped: false, id: (body && body.id) ? String(body.id) : null };
}

/**
 * Spoor van elke verstuurde auth-mail in public.email_events, net als de
 * betaal- en leadmails dat al doen. Zonder dit is er achteraf geen enkele
 * manier om te zien of een code de deur uit is gegaan.
 *
 * De code zelf gaat hier NOOIT in — alleen dat er een code verstuurd is.
 * Loggen mag nooit een verstuurde mail alsnog laten mislukken.
 */
async function logAuthEmail(admin: any, o: {
  event_type: string;
  recipient: string;
  subject: string;
  resend_email_id: string | null;
  payload?: Record<string, unknown>;
}) {
  try {
    const { error } = await admin.from("email_events").insert({
      resend_email_id: o.resend_email_id,
      event_type: o.event_type,
      recipient: o.recipient,
      subject: o.subject,
      payload: o.payload ?? {},
    });
    if (error) throw error;
  } catch (e) {
    console.error("email_events loggen faalde (de mail is wél verstuurd):", String((e as Error)?.message ?? e));
  }
}

// Very light in-memory throttle (per function instance) against accidental
// double-submits and casual spam. Supabase's built-in auth rate limits don't
// apply here since this calls the admin API directly — for real abuse
// resistance at scale, back this with a DB table instead.
const recent = new Map<string, number>();
function throttled(key: string, windowMs = 60_000): boolean {
  const now = Date.now();
  const last = recent.get(key);
  recent.set(key, now);
  return !!last && now - last < windowMs;
}

/** Het IP van de aanroeper, voor de tweede emmer van de rate limit. */
function callerIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return (fwd.split(",")[0] || req.headers.get("cf-connecting-ip") || "unknown").trim();
}

/**
 * Rate limit die instanties overleeft — zie public.claim_auth_email_rate().
 * Twee emmers per verzoek: één per adres+type en één per IP. Beide moeten vrij
 * zijn. Zonder die tweede emmer loopt iemand die steeds een ander adres
 * gebruikt zo langs de limiet heen, en dat is precies het misbruik dat dit
 * open endpoint mogelijk maakte.
 *
 * Valt de database weg, dan zakken we terug op de geheugen-throttle hierboven:
 * een kapotte rate limit mag inloggen nooit onmogelijk maken.
 */
type RateVerdict = { ok: true } | { ok: false; bucket: "key" | "ip"; retryAfter: number };

async function maySend(
  admin: any,
  key: string,
  ipBucket: string,
  windowSeconds = 60,
  maxHits = 1,
  ipMaxHits = 20,
): Promise<RateVerdict> {
  try {
    /* De IP-emmer gaat sinds 30-08-2026 EERST. Andersom werd de adres-emmer
       al verbruikt terwijl het verzoek daarna alsnog op de IP-emmer strandde:
       de bezoeker was dan twee emmers kwijt voor nul mails. */
    const perIp = await admin.rpc("claim_auth_email_rate", {
      p_bucket: ipBucket, p_window_seconds: IP_WINDOW_SECONDS, p_max_hits: ipMaxHits,
    });
    if (perIp.error) throw perIp.error;
    if (perIp.data !== true) return { ok: false, bucket: "ip", retryAfter: IP_WINDOW_SECONDS };

    const perKey = await admin.rpc("claim_auth_email_rate", {
      p_bucket: `key:${key}`, p_window_seconds: windowSeconds, p_max_hits: maxHits,
    });
    if (perKey.error) throw perKey.error;
    if (perKey.data !== true) return { ok: false, bucket: "key", retryAfter: windowSeconds };
    return { ok: true };
  } catch (e) {
    console.error("claim_auth_email_rate niet beschikbaar, terugval op geheugen-throttle:", String((e as Error)?.message ?? e));
    return throttled(key, windowSeconds * 1000)
      ? { ok: false, bucket: "key", retryAfter: windowSeconds }
      : { ok: true };
  }
}

/* Eén tekst voor beide emmers, met de termijn die er écht bij hoort. De
   melding stond hardgecodeerd op 20 seconden, terwijl dezelfde weigering ook
   uit de IP-emmer kan komen — en die loopt over een uur. Achter de CGNAT van
   de Gambiaanse providers deelt een hele wijk één IP, dus dat is niet
   theoretisch: iemand las "probeer over 20 seconden opnieuw" en bleef een uur
   lang op een knop drukken die niets deed. */
function rateMessage(v: Extract<RateVerdict, { ok: false }>): string {
  return v.bucket === "ip"
    ? "Too many sign-in requests from your network in the past hour. Wait a while and try again, or use a different connection."
    : `You just asked for a code. Check your inbox and spam folder, then try again in ${v.retryAfter} seconds.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    /* `password` wordt sinds 30-08-2026 NIET meer uit de body gelezen. Dit is
       een open, ongeauthenticeerd endpoint: wie het adres van een ander opgaf,
       kon daarmee een wachtwoord zetten op een bestaand-maar-onbevestigd
       account. De site heeft bovendien geen wachtwoord-login meer — er is dus
       ook geen reden om er een te aanvaarden. Elk account dat hier ontstaat
       krijgt een willekeurig wachtwoord dat niemand kent. */
    const { type, email, next, name, mode, consent, consent_marketing } = await req.json();
    if (!type || !email) throw new Error("type and email are required");
    // 'signup' wordt bewust niet meer geaccepteerd: die route is nooit op de
    // UI aangesloten (de aanmeldtab gebruikt email_code) en een open,
    // ongeauthenticeerd endpoint dat accounts aanmaakt is een cadeau aan
    // misbruikers. Weer toevoegen zodra hij echt gebruikt gaat worden.
    if (!["recovery", "magiclink", "email_code"].includes(type)) {
      throw new Error("unsupported type: " + type);
    }

    const json = (body: Record<string, unknown>, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    const okNoop = json({ ok: true });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const ip = callerIp(req);

    // ---- email_code: the 6-digit code the sign-in screen asks for ----
    // generateLink returns both a link AND its one-time code (email_otp);
    // we mail only the code, so the UI's OTP step is what people actually get.
    if (type === "email_code") {
      // mode is required from the client going forward; default to "signup"
      // only so older cached frontends don't hard-fail mid-rollout.
      const authMode = mode === "signin" ? "signin" : "signup";

      // Inloggen en aanmelden krijgen een eigen IP-emmer. Wie zich voordoet als
      // 'signin' om de ruimere emmer te pakken schiet er niets mee op: een
      // onbekend adres valt hieronder sowieso op no_account en krijgt geen mail.
      const ipBucket = authMode === "signin" ? `ip:signin:${ip}` : `ip:signup:${ip}`;
      const ipMax    = authMode === "signin" ? IP_MAX_SIGNIN : IP_MAX_SIGNUP;

      const codeRate = await maySend(admin, `email_code:${email}`, ipBucket, CODE_WINDOW_SECONDS, 1, ipMax);
      if (!codeRate.ok) {
        // Eerlijk zijn. Deze route verraadt via no_account/already_exists toch al
        // of een adres bestaat, dus hier valt niets te verbergen — en een scherm
        // dat "we hebben een code gestuurd" zegt terwijl dat niet zo is, is het
        // ergste wat je een bezoeker kunt aandoen. De error-tekst staat erbij
        // zodat een front-end die rate_limited nog niet kent hem gewoon toont.
        return json({
          ok: false,
          rate_limited: true,
          retry_after: codeRate.retryAfter,
          error: rateMessage(codeRate),
        });
      }

      const { data: lookup, error: lookupErr } = await admin.rpc("auth_user_lookup", { p_email: email });
      if (lookupErr) throw lookupErr;
      const row = Array.isArray(lookup) ? lookup[0] : lookup;
      const userExists = !!row?.user_exists;
      const confirmed = !!row?.confirmed;

      // Sign-in tab, unknown address: don't create an account, let the
      // screen offer to switch to Create account instead.
      if (authMode === "signin" && !userExists) {
        return json({ ok: false, no_account: true });
      }
      // Create-account tab, address already has a confirmed account:
      // point them at sign-in instead of silently issuing a new code.
      if (authMode === "signup" && userExists && confirmed) {
        return json({ ok: false, already_exists: true });
      }

      let verifyType: string;
      let res;
      if (userExists && confirmed) {
        verifyType = "magiclink";
        res = await admin.auth.admin.generateLink({
          type: "magiclink", email,
          options: { redirectTo: SITE_URL + "/auth.html" },
        } as any);
      } else {
        // New address, or an existing-but-never-confirmed one: (re)issue a
        // signup confirmation code. This is the fix for the "abandoned
        // signup blocks itself" bug — we no longer rely on magiclink's
        // error message to detect this case.
        verifyType = "signup";
        const meta: Record<string, unknown> = {};
        if (name) meta.full_name = name;
        if (consent === true) meta.consent_contact = true;
        if (consent_marketing === true) meta.consent_marketing = true;
        res = await admin.auth.admin.generateLink({
          type: "signup", email, password: crypto.randomUUID(),
          options: { data: meta, redirectTo: SITE_URL + "/auth.html" },
        } as any);
      }
      if (res.error) throw res.error;
      const code = res.data?.properties?.email_otp;
      if (!code) throw new Error("no email_otp returned from generateLink");
      const sent = await sendEmail(email, SUBJECT.email_code, authCodeEmail({ code }));
      await logAuthEmail(admin, {
        event_type: "auth_code",
        recipient: email,
        subject: SUBJECT.email_code,
        resend_email_id: sent.id,
        payload: { mode: authMode, verify_type: verifyType, skipped: sent.skipped },
      });
      /* Overgeslagen is niet verstuurd. Bij een gereserveerd testdomein gaf
         deze regel tot 30-08-2026 gewoon {ok:true, code_length:6} terug: het
         scherm zei "we hebben een code gestuurd" en de bezoeker wachtte op een
         mail die nooit kwam. Precies de klacht die in augustus voor de
         rate limit al was opgelost, maar hier was blijven staan. */
      if (sent.skipped) {
        return json({
          ok: false,
          invalid_email: true,
          error: "We can't use that email address. Please try another one.",
        });
      }
      return json({ ok: true, verify_type: verifyType, code_length: String(code).length });
    }

    /* Gecorrigeerd 30-08-2026. Hier stond okNoop: bij een volle emmer kwam er
       {ok:true} terug en zei het scherm "we hebben een mail gestuurd" terwijl
       er niets verstuurd was. Dat is dezelfde fout die in augustus voor de
       codeflow als bug is bestempeld en gerepareerd, maar voor de link-routes
       was blijven staan.
       Een rate limit verraadt niets over het bestaan van een account — hij
       gaat over de aanroeper zelf, niet over het adres. De okNoop hieronder,
       bij een onbekend adres, blijft dus wél staan. */
    const linkRate = await maySend(admin, `${type}:${email}`, `ip:link:${ip}`, LINK_WINDOW_SECONDS, 1, IP_MAX_LINK);
    if (!linkRate.ok) {
      return json({
        ok: false,
        rate_limited: true,
        retry_after: linkRate.retryAfter,
        error: linkRate.bucket === "ip"
          ? rateMessage(linkRate)
          : `You just asked for this. Check your inbox and spam folder, then try again in ${linkRate.retryAfter} seconds.`,
      });
    }

    // Onbekend adres? Hier stoppen. generateLink() geeft bij 'magiclink' geen
    // fout maar maakt het account gewoon aan, en op een open endpoint betekent
    // dat: een willekeurige bezoeker kan accounts laten aanmaken én MyKunda
    // laten mailen naar adressen naar keuze. Dezelfde lookup die email_code al
    // gebruikt sluit dat af. We geven ok terug, dus of een adres een account
    // heeft blijft nog steeds onzichtbaar.
    const { data: known, error: knownErr } = await admin.rpc("auth_user_lookup", { p_email: email });
    if (knownErr) throw knownErr;
    const knownRow = Array.isArray(known) ? known[0] : known;
    if (!knownRow?.user_exists) return okNoop;

    const genOpts: Record<string, unknown> = {
      type, email,
      options: { redirectTo: SITE_URL + "/auth.html" },
    };
    // Onbereikbaar zolang 'signup' hierboven geweigerd wordt — blijft staan voor
    // wanneer een aparte "Confirm email"-link wel nodig is. Geef hem dan ook de
    // mode-bewuste behandeling van email_code voordat je het type weer toelaat.
    if (type === "signup") genOpts.password = crypto.randomUUID();

    const { data, error } = await admin.auth.admin.generateLink(genOpts as any);
    if (error) {
      const msg = String((error as any).message || error);
      // Don't reveal whether an email has an account for passwordless flows.
      if ((type === "recovery" || type === "magiclink") && /not.?found|not.?exist/i.test(msg)) {
        return okNoop;
      }
      throw error;
    }

    const hashedToken = data?.properties?.hashed_token;
    if (!hashedToken) throw new Error("no hashed_token returned from generateLink");

    const link = `${SITE_URL}/auth.html?token_hash=${encodeURIComponent(hashedToken)}&type=${encodeURIComponent(type)}`
      + (next ? `&next=${encodeURIComponent(next)}` : "");

    const subject = SUBJECT[type] ?? "MyKunda";
    const linkSent = await sendEmail(email, subject, authLinkEmail({ type, link }));
    await logAuthEmail(admin, {
      event_type: `auth_link_${type}`,
      recipient: email,
      subject,
      resend_email_id: linkSent.id,
      payload: { type, skipped: linkSent.skipped },
    });

    return okNoop;
  } catch (e) {
    console.error("auth-email error:", e);
    const msg = String((e as any)?.message || e);

    // Een adres op een gereserveerd testdomein laat de CHECK op profiles.email
    // klappen; de profielinsert rolt de auth-insert mee terug en GoTrue geeft
    // "Database error saving new user". Dat is geen storing maar een onbruikbaar
    // adres. Met status 400 komt de tekst niet eens bij de bezoeker aan —
    // supabase-js vervangt hem dan door "Edge Function returned a non-2xx status
    // code". Dus: 200 met ok:false, en een zin die iemand kan begrijpen.
    if (/database error saving new user|violates check constraint|profiles_email_not_reserved_domain/i.test(msg)) {
      return new Response(JSON.stringify({
        ok: false,
        invalid_email: true,
        error: "We can't use that email address. Please try another one.",
      }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
    }

    /* Geen rauwe interne foutmelding meer naar de browser. Hier kwamen
       Postgres-fouten en de volledige Resend-foutbody uit — leesbaar voor
       iedereen die dit open endpoint aanroept, en waardeloos voor de bezoeker.
       De details staan hierboven in de functielog. (30-08-2026) */
    return new Response(JSON.stringify({
      ok: false,
      // Status 200 met ok:false, net als de andere gevallen hierboven: bij een
      // niet-2xx vervangt supabase-js onze tekst door "Edge Function returned a
      // non-2xx status code" en ziet de bezoeker niets bruikbaars.
      error: "Sign-in is temporarily unavailable. Please try again in a moment.",
    }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
