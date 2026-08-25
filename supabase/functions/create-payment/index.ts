// =====================================================================
// MyKunda - create-payment
// ---------------------------------------------------------------------
// De browser stuurt ALLEEN een plan_id. Het bedrag komt uit de tabel
// listing_plans, nooit uit het verzoek. Zo kan een klant de prijs niet
// veranderen met de developer tools.
//
// Betaaldienstverlener: WAYCHIT (sinds 22-08-2026, hiervoor Modem Pay).
// Waychit heeft twee verschillende endpoints, en welke je nodig hebt
// hangt af van hoe de klant betaalt:
//
//   wallet (wave/afrimoney/qmoney/aps)  -> POST /v1/payment-requests
//   kaart  (Visa/Mastercard, diaspora)  -> POST /v1/payment-sessions/card
//   bankoverschrijving                  -> helemaal geen gateway
//
// Beide endpoints geven een gehoste betaalpagina terug waar de klant
// naartoe wordt gestuurd. De uitkomst horen we via de webhook, niet via
// de terugkeer van de klant.
//
// Huisbank voor bankoverschrijvingen: GUARANTY TRUST BANK (GAMBIA) LTD.
// Tussen 23-08-2026 en 25-08-2026 stond hier Ecobank; dat is op
// 25-08-2026 teruggedraaid - de rekening voor bankoverschrijvingen is en
// blijft die van GT Bank. Zie BANK_DETAILS hieronder; diezelfde
// gegevens staan in send-payment-instructions, dat de klant de mail met
// het rekeningnummer stuurt. Wijzigt de rekening ooit weer, pas ze dan
// op BEIDE plekken aan, en ook de provider-waarde die hier bij een
// bankoverschrijving wordt weggeschreven.
//
// LET OP: verify_jwt staat op false bij de gateway. Dat is GEEN open deur:
// de functie controleert het Supabase-token hieronder zelf. Dit is nodig
// omdat de browser eerst een OPTIONS-preflight stuurt zonder token, en de
// gateway die anders met 401 afwijst waardoor CORS breekt.
//
// *** CONTACTADRES EN AANVRAAGGEGEVENS - 24-08-2026 ***
// Tot nu toe ging elke bevestiging naar user.email, het adres van het
// INGELOGDE account. Voor een verkoperproduct klopt dat, maar de
// Ownership Verification op verify.html is een KOPERproduct: daar vult de
// koper zelf naam, e-mail en telefoon in. Dat formulier zette zijn
// aanvraag alleen in localStorage en checkout.html las die nooit uit, dus
// het opgegeven adres bereikte de server niet en de betaalinstructies
// gingen naar het accountadres. Gemeten op 23-08-2026: MK-VKWX6DJ liep
// zo naar admin@mykunda.com terwijl er edwinscheperman@gmail.com was
// ingevuld.
//
// Sindsdien mag de browser twee extra velden meesturen:
//   contact_email  -> waar de bevestiging naartoe moet
//   intake         -> de aanvraag zelf (pand, documenten, notities)
//
// Beide zijn optioneel: blijft contact_email leeg, dan geldt gewoon het
// accountadres, precies zoals eerst. Het accountadres blijft altijd
// bewaard in metadata.account_email, zodat achteraf te zien is wie de
// bestelling plaatste en waar de mail heen ging.
//
// De intake wordt alleen bewaard bij de koperproducten (doc_check en
// ownership_check). Zonder die gegevens kwam er wel een betaling binnen,
// maar wist de backoffice niet om welk pand het ging.
//
// Omdat de ontvanger nu uit de browser komt, staat er ook een
// dagelijkse bovengrens op het aantal betalingen per gebruiker. Zonder
// die grens kan een account met een geldig token onze mailserver
// gebruiken om MyKunda-mail met bankgegevens naar willekeurige adressen
// te sturen - een risico voor de afzenderreputatie van het domein.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ---------------------------------------------------------------- config
const SITE = Deno.env.get("SITE_URL") ?? "https://mykunda.com";

const ALLOWED_ORIGINS = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://mykunda.com,https://www.mykunda.com"
).split(",").map((s) => s.trim()).filter(Boolean);

const WAYCHIT_API = Deno.env.get("WAYCHIT_API_BASE") ?? "https://api.waychit.com/v1";

// Waychit rekent in DALASI, niet in butut. De documentatie laat
// "amount": 200 zien en geeft als foutmelding "Minimum amount to purchase
// is 5." Onze database rekent in butut (amount_minor), dus hier delen we
// door 100. Dit was bij Modem Pay een openstaande vraag; bij Waychit is
// het bevestigd door de docs.
const MIN_GMD = 5;

// Bovengrens van Waychit zelf: "Total sum of transactions should be less
// than or equal to D300,000." Onze duurste plan is D16.000, dus dit is
// een vangnet, geen dagelijkse beperking.
const MAX_GMD = 300_000;

// Hoeveel betalingen een gebruiker per etmaal mag aanmaken. Een echte
// klant koopt er een, hooguit een handvol als hij van gedachten
// verandert over de betaalmethode. Deze grens is er tegen misbruik van
// de mailstroom, niet tegen normale twijfel.
const MAX_PAYMENTS_PER_DAY = 25;

// Transactielimieten van de mobiele-geldaanbieders zelf, in butut
// (1 GMD = 100 butut). Dit zijn limieten van Wave/Afrimoney/QMoney/APS,
// niet van Waychit, en ze blijven dus gelden na de overstap.
const WALLET_LIMITS: Record<string, number> = {
  wave: 100_000_00,
  afrimoney: 50_000_00,
  qmoney: 50_000_00,
  aps: 50_000_00,
};

// De rekening waar klanten hun overschrijving naartoe sturen.
//
// Bevestigd met de brief "RE: BANKING RELATIONSHIP" van Guaranty Trust
// Bank (Gambia) Limited van 18-08-2026: filiaal Kairaba (code 201),
// rekening 005201300100074795, SWIFT GTBGGMGM.
//
// De brief schrijft de tenaamstelling twee keer, en niet identiek: het
// dalasi-blok zegt "EDWIN SCHEPERMAN T/A MY KUNDA.COM" (met spatie), het
// USD-correspondentblok "EDWIN SCHEPERMAN T/A MYKUNDA.COM" (zonder).
// Hier staat de versie ZONDER spatie: dat is de begunstigde die meegaat
// bij internationale overboekingen, waar een afwijkende naam tot
// handmatige controle of afwijzing leidt. Bij lokale dalasi-overboekingen
// matcht de bank primair op rekeningnummer, dus daar is het verschil
// onschadelijk.
//
// GTBGGMGMXXX is de elfcijferige vorm van GTBGGMGM (hoofdkantoor);
// sommige buitenlandse banken eisen elf tekens, vandaar dat beide vormen
// meegaan naar de klant.
//
// Gambia kent geen IBAN. Een klant uit de diaspora die om een IBAN
// gevraagd wordt, heeft genoeg aan SWIFT + rekeningnummer; voor USD loopt
// het via de correspondent in Londen, zie de usd_-velden.
const BANK_DETAILS = {
  bank: "Guaranty Trust Bank (Gambia) Ltd",
  account_name: "EDWIN SCHEPERMAN T/A MYKUNDA.COM",
  account_number: "005201300100074795",
  currency: "GMD",
  swift: "GTBGGMGM",
  swift_11: "GTBGGMGMXXX",
  branch: "Kairaba (branch code 201)",
  address: "56 Kairaba Avenue, Fajara, KSMD",
  usd_intermediary_bank: "Guaranty Trust Bank (UK) Limited",
  usd_intermediary_swift: "GTBIGB2L",
  usd_beneficiary_bank: "Guaranty Trust Bank (Gambia) Limited",
  usd_beneficiary_swift: "GTBGGMGM",
  usd_beneficiary_bank_account: "901 10015 002 5033 000",
};

const VALID_METHODS = ["wave", "afrimoney", "qmoney", "aps", "card", "bank_transfer"];
const WALLET_METHODS = ["wave", "afrimoney", "qmoney", "aps"];

// Verified heeft drie prijzen en welke geldt, hangt af van de vraagprijs.
// Die keuze mag NOOIT van de browser komen: wie `verified_s` meestuurt bij
// een villa van D12 miljoen zou dan D4.500 betalen in plaats van D16.000.
// De browser mag elk van deze vier waarden sturen; de server bepaalt
// vervolgens zelf welke band er werkelijk geldt.
const VERIFIED_PLAN_IDS = ["verified", "verified_s", "verified_m", "verified_l"];

// De koperproducten van verify.html. Alleen hierbij hoort een intake:
// bij een verkoperplan hangt de bestelling aan een listing en staat alles
// al in de database.
const BUYER_PLAN_IDS = ["doc_check", "ownership_check"];

// De banden zoals ze op mykunda.com/sell gepubliceerd staan. Precies
// D10.000.000 valt in de middelste band, net als in de tabel op de site.
function verifiedBandVoor(prijsGmd: number): string {
  if (prijsGmd < 2_000_000) return "verified_s";
  if (prijsGmd <= 10_000_000) return "verified_m";
  return "verified_l";
}

// ---------------------------------------------------------------- helpers
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

// Hetzelfde patroon als verify.html gebruikt voordat het formulier
// verstuurt. Bewust simpel: dit is een vormcontrole, geen bewijs dat de
// mailbox bestaat. Blijkt het adres niet te bestaan, dan komt dat terug
// als bounce in email_events.
function geldigEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s.toLowerCase();
}

// De aanvraag van verify.html komt uit localStorage en is dus volledig
// door de browser te bepalen. Hij gaat alleen naar metadata en naar de
// backoffice-mail, nooit naar een prijs of een rechtenbeslissing - maar
// snoei hem wel, zodat een opgeblazen object de rij niet vol schrijft.
function schoonIntake(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const bron = v as Record<string, unknown>;
  const tekst = (k: string, max = 500): string | undefined => {
    const w = bron[k];
    if (typeof w !== "string") return undefined;
    const s = w.trim();
    return s ? s.slice(0, max) : undefined;
  };
  const uit: Record<string, unknown> = {
    where: tekst("where", 300),
    property_type: tekst("propertyType", 60),
    source: tekst("source", 60),
    link: tekst("link", 500),
    name: tekst("name", 120),
    phone: tekst("phone", 60),
    urgency: tekst("when", 60),
    notes: tekst("notes", 2000),
    tier: tekst("tier", 30),
    submitted_at: tekst("at", 40),
  };
  if (Array.isArray(bron.docs)) {
    uit.docs = bron.docs
      .filter((d) => typeof d === "string")
      .slice(0, 20)
      .map((d) => String(d).slice(0, 80));
  }
  for (const k of Object.keys(uit)) {
    if (uit[k] === undefined) delete uit[k];
  }
  return Object.keys(uit).length ? uit : null;
}

// Waychit documenteert waychitLaunchUrl voor payment requests. Voor de
// card session staat de veldnaam niet in de docs. We kijken daarom op
// alle plausibele plekken in plaats van te gokken; komt er niets uit,
// dan mislukt de betaling zichtbaar in plaats van stil.
function launchUrlUit(body: any): string | undefined {
  const kandidaten = [
    body?.waychitLaunchUrl,
    body?.paymentRequest?.waychitLaunchUrl,
    body?.paymentSession?.waychitLaunchUrl,
    body?.data?.waychitLaunchUrl,
    body?.launchUrl,
    body?.paymentSession?.launchUrl,
    body?.paymentRequest?.launchUrl,
    body?.checkoutUrl,
    body?.url,
  ];
  return kandidaten.find((k) => typeof k === "string" && k.length > 0);
}

function providerIdUit(body: any): string | undefined {
  const kandidaten = [
    body?.paymentRequest?.id,
    body?.paymentSession?.id,
    body?.data?.id,
    body?.id,
  ];
  return kandidaten.find((k) => typeof k === "string" && k.length > 0);
}

// ---------------------------------------------------------------- handler
Deno.serve(async (req: Request) => {
  const headers = cors(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, headers);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // --- 1. wie is dit? ---------------------------------------------------
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json({ error: "unauthorized" }, 401, headers);

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401, headers);
  const user = userData.user;

  // --- 2. verzoek lezen -------------------------------------------------
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, headers);
  }

  const planId = String(body.plan_id ?? "");
  const method = String(body.method ?? "");
  const listingId = body.listing_id ? String(body.listing_id) : null;
  const displayCurrency = body.display_currency ? String(body.display_currency) : null;

  if (!planId) return json({ error: "plan_id_required" }, 400, headers);
  if (!VALID_METHODS.includes(method)) return json({ error: "invalid_method" }, 400, headers);

  // Het adres dat de klant zelf opgaf. Stuurt de browser niets mee, dan
  // blijft alles zoals het was en geldt het accountadres. Staat er wel
  // iets in maar deugt de vorm niet, dan is dat een fout van het
  // formulier en zeggen we dat - stil terugvallen zou de bevestiging
  // opnieuw naar het verkeerde adres sturen, en dat is precies wat we
  // hier repareren.
  const accountEmail = user.email ?? null;
  let contactEmail: string | null = null;
  if (body.contact_email !== undefined && body.contact_email !== null && String(body.contact_email).trim() !== "") {
    contactEmail = geldigEmail(body.contact_email);
    if (!contactEmail) return json({ error: "invalid_contact_email" }, 400, headers);
  }
  const ontvanger = contactEmail ?? accountEmail;

  // --- 2b. dagelijkse bovengrens ----------------------------------------
  // Zie de toelichting bovenaan: de ontvanger van de mail komt nu uit de
  // browser, dus mag een enkel account niet eindeloos betalingen blijven
  // aanmaken.
  const etmaalGeleden = new Date(Date.now() - 86_400_000).toISOString();
  const { count: recent } = await admin
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", etmaalGeleden);
  if ((recent ?? 0) >= MAX_PAYMENTS_PER_DAY) {
    console.warn("create-payment dagelijkse grens bereikt", user.id, recent);
    return json({ error: "too_many_payments_today", max: MAX_PAYMENTS_PER_DAY }, 429, headers);
  }

  // --- 3a. listing controleren ------------------------------------------
  // Hangt de betaling aan een listing, dan moet die van deze gebruiker
  // zijn. Sinds een geslaagde betaling het plan automatisch laat ingaan,
  // zou een vreemde listing_id anders het plan bij iemand anders laten
  // landen.
  let listing: Record<string, any> | null = null;
  if (listingId) {
    const { data: l } = await admin
      .from("listings")
      .select("id, owner_id, agent_id, kind, price")
      .eq("id", listingId)
      .maybeSingle();
    if (!l) return json({ error: "listing_not_found" }, 404, headers);
    if (l.owner_id !== user.id && l.agent_id !== user.id) {
      return json({ error: "not_your_listing" }, 403, headers);
    }
    listing = l;
  }

  // --- 3b. bij Verified: de band aan de serverkant bepalen ---------------
  let effectievePlanId = planId;
  let bandInfo: Record<string, unknown> | null = null;

  if (VERIFIED_PLAN_IDS.includes(planId)) {
    if (!listing) {
      return json({ error: "listing_required_for_verified" }, 400, headers);
    }
    // Verified is alleen een verkoopproduct. Bij verhuur is de vraagprijs
    // een maandhuur en zouden de banden nergens op slaan.
    if (listing.kind !== "sale") {
      return json({ error: "verified_is_for_sale_listings_only" }, 400, headers);
    }
    const vraagprijs = Number(listing.price ?? 0);
    if (!(vraagprijs > 0)) {
      return json({ error: "listing_price_required" }, 400, headers);
    }
    effectievePlanId = verifiedBandVoor(vraagprijs);
    bandInfo = {
      requested_plan_id: planId,
      applied_plan_id: effectievePlanId,
      asking_price_gmd: vraagprijs,
    };
  }

  // --- 3c. prijs ophalen aan de serverkant -------------------------------
  const { data: plan } = await admin
    .from("listing_plans")
    .select("*")
    .eq("id", effectievePlanId)
    .eq("active", true)
    .maybeSingle();

  if (!plan) return json({ error: "unknown_or_inactive_plan", plan_id: effectievePlanId }, 400, headers);

  const bedragGmd = plan.amount_minor / 100;

  // --- 3d. de aanvraag zelf ---------------------------------------------
  // Alleen bij de koperproducten. Bij een verkoperplan hoort er geen
  // intake te zijn en negeren we hem, ook als de browser hem toch
  // meestuurt.
  const intake = BUYER_PLAN_IDS.includes(effectievePlanId) ? schoonIntake(body.intake) : null;

  // --- 4. limieten bindend controleren ----------------------------------
  if (method !== "bank_transfer") {
    if (bedragGmd < MIN_GMD) {
      return json({ error: "amount_below_provider_minimum", min_gmd: MIN_GMD }, 400, headers);
    }
    if (bedragGmd > MAX_GMD) {
      return json({
        error: "amount_above_provider_maximum",
        max_gmd: MAX_GMD,
        use_instead: ["bank_transfer"],
      }, 400, headers);
    }
  }

  const limit = WALLET_LIMITS[method];
  if (limit && plan.amount_minor > limit) {
    return json({
      error: "amount_exceeds_wallet_limit",
      limit_gmd: limit / 100,
      amount_gmd: bedragGmd,
      use_instead: ["card", "bank_transfer"],
    }, 400, headers);
  }

  // --- 5. betaling vastleggen voordat er iets naar buiten gaat ----------
  const { data: payment, error: insErr } = await admin
    .from("payments")
    .insert({
      user_id: user.id,
      listing_id: listingId,
      plan_id: plan.id,
      amount_minor: plan.amount_minor,
      currency: plan.currency,
      display_currency: displayCurrency,
      method,
      provider: method === "bank_transfer" ? "gtbank" : "waychit",
      // Hier zat de fout: dit was altijd user.email. Alles stroomafwaarts
      // (send-payment-instructions, notify-payment, de reply-to naar de
      // backoffice) leest customer_email als eerste, dus met dit ene veld
      // komt de hele keten op het juiste adres uit.
      customer_email: ontvanger,
      metadata: {
        plan_kind: plan.kind,
        plan_name: plan.name,
        account_email: accountEmail,
        contact_email_source: contactEmail ? "form" : "account",
        ...(intake ? { ownership_intake: intake } : {}),
        ...(bandInfo ?? {}),
      },
    })
    .select()
    .single();

  if (insErr || !payment) {
    console.error("payment insert failed", insErr);
    return json({ error: "could_not_create_payment" }, 500, headers);
  }

  // --- 6a. bankoverschrijving: geen gateway nodig -----------------------
  if (method === "bank_transfer") {
    // De klant staat straks bij de bank, niet achter zijn laptop. Daarom
    // gaan de gegevens ook per mail en niet alleen naar het scherm.
    // Diezelfde aanroep stuurt de melding naar de backoffice.
    let mailVerstuurd = false;
    try {
      const mailRes = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-payment-instructions`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reference: payment.reference }),
        },
      );
      mailVerstuurd = mailRes.ok;
      if (!mailRes.ok) {
        console.error("payment instructions mail failed", mailRes.status, (await mailRes.text()).slice(0, 300));
      }
    } catch (e) {
      console.error("payment instructions mail unreachable", String(e));
    }
    return json({
      mode: "bank_transfer",
      reference: payment.reference,
      amount_gmd: bedragGmd,
      currency: plan.currency,
      bank: BANK_DETAILS,
      // Zodat checkout.html kan tonen WAAR de bevestiging heen ging. Dat
      // is precies het punt waarop dit eerder stil misging.
      confirmation_email: ontvanger,
      instruction:
        `Quote ${payment.reference} as the payment description. Without this ` +
        `reference we cannot match your transfer to your account.`,
      instructions_emailed: mailVerstuurd,
    }, 200, headers);
  }

  // --- 6b. wallet of kaart: betaalpagina bij Waychit --------------------
  const secret = Deno.env.get("WAYCHIT_SECRET_KEY");
  if (!secret) {
    await admin.from("payments").update({
      status: "failed",
      failure_reason: "WAYCHIT_SECRET_KEY missing in the environment",
    }).eq("id", payment.id);
    return json({ error: "gateway_not_configured" }, 503, headers);
  }

  const successUrl = `${SITE}/betaling-status.html?ref=${payment.reference}`;
  const failureUrl = `${SITE}/betaling-status.html?ref=${payment.reference}&failed=1`;

  // clientReference is bij payment-requests het ENIGE veld dat wij zelf
  // vullen en later terugzien in de webhook — payment-requests kent geen
  // metadata. Onze eigen referentie (MK-XXXXXXX) is daarom de sleutel
  // waarop de webhook de betaling terugvindt. Dezelfde referentie staat
  // ook op de bankoverschrijving, dus hij is overal herkenbaar.
  let endpoint: string;
  let payload: Record<string, unknown>;

  if (WALLET_METHODS.includes(method)) {
    endpoint = `${WAYCHIT_API}/payment-requests`;
    payload = {
      amount: bedragGmd,
      description: `${plan.name} (${payment.reference})`,
      clientReference: payment.reference,
      successRedirectUrl: successUrl,
      failureRedirectUrl: failureUrl,
    };
  } else {
    // card
    endpoint = `${WAYCHIT_API}/payment-sessions/card`;
    payload = {
      clientReference: payment.reference,
      lineItems: [{
        productName: plan.name,
        productDescription: plan.description ?? undefined,
        // Altijd 1 stuk. De documentatie laat in het midden of `price`
        // de stuksprijs of het regeltotaal is; bij quantity 1 maakt dat
        // niet uit, en zo kan er geen factor-verschil ontstaan.
        quantity: 1,
        price: bedragGmd,
      }],
      // Waychit valideert metadata streng: elk veld moet een string zijn.
      // Een ownership check (doc_check / ownership_check) hangt niet aan
      // een listing, dus listingId is dan null — en null leverde
      // "Validation failed" op met
      // { code: "invalid_type", expected: "string", received: "null",
      //   path: ["metadata","listing_id"] }.
      // Laat het veld daarom weg als er geen listing is, in plaats van
      // null mee te sturen. Gemeten en gecorrigeerd op 23-08-2026.
      metadata: {
        mykunda_payment_id: payment.id,
        reference: payment.reference,
        user_id: user.id,
        ...(listingId ? { listing_id: listingId } : {}),
      },
      // Ook de bon van Waychit zelf hoort naar het opgegeven adres te
      // gaan, niet naar het accountadres.
      customerEmail: ontvanger ?? undefined,
      returnRedirectUrl: successUrl,
      failureRedirectUrl: failureUrl,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  let providerJson: Record<string, unknown> | null = null;
  let providerStatus = 0;
  let providerText = "";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secret}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    providerStatus = res.status;
    providerText = await res.text();
    try { providerJson = JSON.parse(providerText); } catch { /* geen JSON */ }
  } catch (e) {
    clearTimeout(timer);
    await admin.from("payments").update({
      status: "failed",
      failure_reason: `Network error reaching Waychit: ${String(e)}`,
    }).eq("id", payment.id);
    return json({ error: "gateway_unreachable", reference: payment.reference }, 502, headers);
  }
  clearTimeout(timer);

  const link = launchUrlUit(providerJson);

  if (providerStatus < 200 || providerStatus >= 300 || !link) {
    // Waychit geeft fouten terug als { success: false, message: "..." }.
    const melding = (providerJson as any)?.message ?? `Waychit returned ${providerStatus}`;
    console.error("waychit error", providerStatus, providerText.slice(0, 800));
    await admin.from("payments").update({
      status: "failed",
      failure_reason: String(melding).slice(0, 500),
      metadata: { ...payment.metadata, provider_error: providerText.slice(0, 2000) },
    }).eq("id", payment.id);
    return json({
      error: "gateway_rejected",
      reference: payment.reference,
      message: String(melding).slice(0, 200),
    }, 502, headers);
  }

  await admin.from("payments").update({
    status: "processing",
    provider_intent_id: providerIdUit(providerJson) ?? null,
    provider_payment_link: link,
    metadata: { ...payment.metadata, provider_response: providerJson },
  }).eq("id", payment.id);

  return json({
    mode: "redirect",
    reference: payment.reference,
    payment_link: link,
    amount_gmd: bedragGmd,
    confirmation_email: ontvanger,
  }, 200, headers);
});
