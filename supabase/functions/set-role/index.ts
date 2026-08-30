// ============================================================
//  MyKunda — Edge Function: set-role
//  Zet public.profiles.role voor de ingelogde gebruiker zelf.
//
//  Waarom een function en geen update vanuit de browser: de rol
//  'authenticated' heeft UPDATE-recht op precies acht kolommen van
//  profiles, en role hoort daar niet bij. Dat is met opzet zo —
//  is_admin() leest profiles.role, dus een schrijfbare rolkolom zou
//  betekenen dat iedere ingelogde bezoeker zichzelf admin kan maken.
//  Die kolomrechten blijven dus ongemoeid; deze function is de enige
//  weg omhoog, en hij loopt met de service key achter een controle op
//  het JWT van de gebruiker zelf.
//
//  Twee aanroepers:
//   1) auth.html na een Google-aanmelding. Daar komt de rol niet in de
//      signup-metadata terecht (die vult Google), dus handle_new_user()
//      maakt er 'buyer' van en zet deze function hem alsnog goed.
//      De e-mailcode-route heeft dit niet nodig: daar reist de rol mee
//      in options.data van generateLink.
//   2) later: "I'm selling a property" / "We're a business" vanuit het
//      dashboard, als een zoeker gaat aanbieden.
//
//  Regels:
//   - alleen buyer -> seller, buyer -> agent, seller -> agent.
//   - nooit naar of vanaf 'admin'. Nooit omlaag: dat is een bewuste
//     handeling die om een eigen scherm vraagt, niet om deze route.
//   - de gebruiker kan alleen zijn eigen rol zetten; het user-id komt
//     uit het token, nooit uit de body.
//
//  Deploy:  supabase functions deploy set-role --no-verify-jwt
//  Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY     = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

/* Alleen omhoog, en admin staat niet in de lijst — dus ook niet te bereiken. */
const RANK: Record<string, number> = { buyer: 0, seller: 1, agent: 2 };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const wanted = String((body as { role?: unknown }).role ?? "");
    if (!(wanted in RANK)) return json({ ok: false, error: "unsupported role" }, 400);

    /* Het token, niet de body, bepaalt om wiens profiel het gaat. De function
       draait met --no-verify-jwt, dus de header komt ongecontroleerd binnen en
       wordt hier zelf geverifieerd. */
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ ok: false, error: "not signed in" }, 401);

    const asUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: got, error: authErr } = await asUser.auth.getUser(token);
    if (authErr || !got?.user) return json({ ok: false, error: "not signed in" }, 401);
    const userId = got.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: prof, error: profErr } = await admin
      .from("profiles").select("role").eq("id", userId).maybeSingle();
    if (profErr) throw profErr;
    if (!prof) return json({ ok: false, error: "no profile yet" }, 404);

    const current = String(prof.role ?? "buyer");

    /* Een admin raken we nooit aan: die rol is niet via deze weg toegekend en
       hoort er ook niet via deze weg af te gaan. */
    if (current === "admin") return json({ ok: true, role: current, unchanged: true });
    if (current === wanted)  return json({ ok: true, role: current, unchanged: true });

    if (!(current in RANK) || RANK[wanted] <= RANK[current]) {
      /* Omlaag of zijwaarts: geen fout voor de bezoeker, maar er verandert
         niets. Zo kan een herhaalde aanroep na een Google-aanmelding nooit
         een bestaand kantooraccount terugzetten naar zoeker. */
      return json({ ok: true, role: current, unchanged: true });
    }

    const { error: upErr } = await admin
      .from("profiles").update({ role: wanted }).eq("id", userId);
    if (upErr) throw upErr;

    console.log(`set-role: ${userId} ${current} -> ${wanted}`);
    return json({ ok: true, role: wanted, unchanged: false });
  } catch (e) {
    console.error("set-role:", String((e as Error)?.message ?? e));
    return json({ ok: false, error: "could not set role" }, 500);
  }
});
