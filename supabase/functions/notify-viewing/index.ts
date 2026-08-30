// ============================================================
//  MyKunda — Edge Function: notify-viewing
//  Runs on public.viewings — the current model. viewings_legacy_v0 is dead:
//  propose_viewing() writes status 'proposed', respond_viewing() 'confirmed'
//  or 'declined', cancel_viewing() 'cancelled'. Same table and same joins as
//  notify-viewing-reminder, so both functions stay in step.
//  Vier momenten, zeven branded e-mails:
//   · someone proposes times    → team notification
//                               + confirmation to the proposer
//                               + the proposed times to the other party
//   · the other party accepts   → confirmation to the proposer
//   · the other party declines  → "other times needed" to the proposer
//                               + a short notice to the team   (30-08-2026)
//   · someone cancels           → email to the other party
//                               + a short notice to the team
//
//  Deploy:  supabase functions deploy notify-viewing --no-verify-jwt
//  Secrets: reuses RESEND_API_KEY / FROM_EMAIL
//  LET OP: LEAD_EMAIL is hier bewust NIET uit de omgeving gelezen — zie de
//  notitie bij de constante hieronder. Zet die regel niet terug.
// ============================================================
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { viewingNotificationEmail, viewingConfirmationEmail, viewingConfirmedEmail, viewingSlotsEmail, viewingCancelledEmail, viewingCancelledBackofficeEmail, viewingDeclinedEmail, toText } from "../_shared/email-template.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "MyKunda <noreply@mykunda.com>";
/* Interne meldingen gaan naar admin@mykunda.com, hard ingesteld en met opzet.
   info@mykunda.com bounceerde op 14-08-2026 op de Cloud86-blocklist; met een
   env-fallback naar dat adres verdwijnt elke melding van een bezichtiging
   zonder dat iemand het merkt. Ook geen Deno.env.get("LEAD_EMAIL") ervoor:
   staat die secret niet (of verkeerd) gezet, dan valt hij terug in dezelfde
   fout. Terugzetten op env pas als Cloud86 aantoonbaar los is én de secret
   gecontroleerd is — dezelfde afspraak als in notify-lead. */
const LEAD_EMAIL     = "admin@mykunda.com";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sendEmail(to: string, subject: string, html: string, replyTo?: string) {
  const body: Record<string, unknown> = { from: FROM_EMAIL, to: [to], subject, html, text: toText(html) };
  if (replyTo) body.reply_to = replyTo;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    console.error("Resend error", errText);
    throw new Error(`Resend ${r.status}: ${errText}`);
  }
  return r.ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { viewing_id } = await req.json().catch(() => ({}));
    if (!viewing_id) return json({ ok: false, error: "missing viewing_id" }, 400);
    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: v, error } = await db
      .from("viewings")
      .select("id, conversation_id, listing_id, proposer_id, invitee_id, status, slots, chosen_slot, note, cancelled_by, cancel_reason")
      .eq("id", viewing_id).single();
    if (error || !v) return json({ ok: false, error: "viewing not found" }, 404);

    const { data: listing } = await db
      .from("listings").select("title, area").eq("id", v.listing_id).single();

    const title = listing?.title ?? "your property";
    const area: string | undefined = listing?.area ?? undefined;

    // Naam en e-mailadres komen uit profiles, met dezelfde auth-fallback als
    // notify-viewing-reminder gebruikt — een profiel zonder e-mailadres mag
    // geen stille afzegging opleveren.
    type Party = { id: string; name?: string; email?: string; phone?: string };
    const { data: people } = await db
      .from("profiles").select("id, full_name, email, phone")
      .in("id", [v.proposer_id, v.invitee_id]);

    const party = async (id: string): Promise<Party> => {
      const p = (people ?? []).find((x: { id: string }) => x.id === id);
      let email: string | undefined = p?.email ?? undefined;
      let name: string | undefined = p?.full_name ?? undefined;
      if (!email) {
        const { data: au } = await db.auth.admin.getUserById(id);
        email = au?.user?.email ?? undefined;
        name = name ?? (au?.user?.user_metadata?.full_name ?? undefined);
      }
      return { id, name, email, phone: p?.phone ?? undefined };
    };

    const proposer = await party(v.proposer_id);
    const invitee = await party(v.invitee_id);

    const slots: string[] = (v.slots ?? []).map((s: unknown) => String(s));
    const firstSlot: string | undefined = slots[0];
    const convId: string | undefined = v.conversation_id ?? undefined;

    const sent: Record<string, boolean> = { team: false, proposer: false, invitee: false };
    const errors: string[] = [];

    if (v.status === "proposed") {
      // → team / seller, reply-to the party that asked
      try {
        await sendEmail(
          LEAD_EMAIL,
          `[MyKunda] New viewing request — ${title}`,
          viewingNotificationEmail({
            buyer_name: proposer.name,
            title,
            area,
            requested_slot: firstSlot,
            buyer_email: proposer.email,
            buyer_phone: proposer.phone,
          }),
          proposer.email || undefined,
        );
        sent.team = true;
      } catch (e) { errors.push(`team: ${(e as Error).message}`); }

      // → the proposer gets a confirmation, so the request never feels ignored
      if (proposer.email) {
        try {
          await sendEmail(
            proposer.email,
            `Your viewing request — ${title}`,
            viewingConfirmationEmail({
              buyer_name: proposer.name,
              title,
              area,
              requested_slot: firstSlot,
            }),
            LEAD_EMAIL,
          );
          sent.proposer = true;
        } catch (e) { errors.push(`proposer: ${(e as Error).message}`); }
      }

      // → the other party sees the proposed times and picks one
      if (invitee.email) {
        try {
          await sendEmail(
            invitee.email,
            `New viewing times for ${title} — MyKunda`,
            viewingSlotsEmail({ title, proposed_slots: slots, conversation_id: convId }),
            LEAD_EMAIL,
          );
          sent.invitee = true;
        } catch (e) { errors.push(`invitee: ${(e as Error).message}`); }
      }
    } else if (v.status === "declined") {
      /* Nieuw op 30-08-2026. respond_viewing() zet deze status zodra de
         uitgenodigde partij geen van de tijden kan, en schrijft er een bericht
         bij in de conversatie. Er ging hier tot nu toe geen enkele mail uit:
         de aanvrager moest toevallig het gesprek openen om te zien dat zijn
         voorstel was afgewezen. De functie meldde daarbij ook nog 200 ok:true
         met drie keer false, dus monitoring zag het evenmin. */
      const decliner = invitee;
      if (proposer.email) {
        try {
          await sendEmail(
            proposer.email,
            `Other times needed for ${title} — MyKunda`,
            viewingDeclinedEmail({
              recipient_name: proposer.name,
              decliner_name: decliner.name,
              title: listing?.title ?? undefined,
              area,
              proposed_slots: slots,
              conversation_id: convId,
            }),
            LEAD_EMAIL,
          );
          sent.proposer = true;
        } catch (e) { errors.push(`proposer: ${(e as Error).message}`); }
      }

      // → korte interne melding: een afwijzing die blijft liggen is een
      //   bezichtiging die nooit doorgaat, en dat wil de backoffice zien.
      try {
        await sendEmail(
          LEAD_EMAIL,
          `[MyKunda] Viewing times declined — ${listing?.title ?? "MyKunda"}`,
          viewingDeclinedEmail({
            decliner_name: decliner.name,
            title: listing?.title ?? undefined,
            area,
            proposed_slots: slots,
            conversation_id: convId,
          }),
          proposer.email || undefined,
        );
        sent.team = true;
      } catch (e) { errors.push(`team: ${(e as Error).message}`); }
    } else if (v.status === "confirmed" && proposer.email) {
      // The invitee picked a time in the dashboard — the proposer only hears it here.
      try {
        await sendEmail(
          proposer.email,
          `Viewing confirmed — ${title}`,
          viewingConfirmedEmail({
            buyer_name: proposer.name,
            title,
            area,
            slot: v.chosen_slot ?? firstSlot,
          }),
          LEAD_EMAIL,
        );
        sent.proposer = true;
      } catch (e) { errors.push(`proposer: ${(e as Error).message}`); }
    } else if (v.status === "cancelled") {
      // cancel_viewing() zet cancelled_by; die partij hoeft niets te horen.
      // Staat er niemand in (handmatige update), dan krijgen beide partijen
      // de mail — liever een mail te veel dan een stille afzegging.
      const canceller = v.cancelled_by === invitee.id
        ? invitee
        : v.cancelled_by === proposer.id ? proposer : null;
      const recipients: Party[] = canceller
        ? [canceller.id === proposer.id ? invitee : proposer]
        : [proposer, invitee];
      const when: string | undefined = v.chosen_slot ?? firstSlot;
      const subjectTitle = listing?.title ?? "MyKunda";

      for (const person of recipients) {
        const key = person.id === v.proposer_id ? "proposer" : "invitee";
        if (!person.email) continue;
        try {
          await sendEmail(
            person.email,
            `Viewing cancelled — ${subjectTitle}`,
            viewingCancelledEmail({
              recipient_name: person.name,
              canceller_name: canceller?.name,
              title: listing?.title ?? undefined,
              area,
              slot: when,
              reason: v.cancel_reason ?? undefined,
              conversation_id: convId,
            }),
            LEAD_EMAIL,
          );
          sent[key] = true;
        } catch (e) { errors.push(`${key}: ${(e as Error).message}`); }
      }

      // → korte interne melding, zodat Edwin annuleringen ziet
      try {
        await sendEmail(
          LEAD_EMAIL,
          `[MyKunda] Viewing cancelled — ${subjectTitle}`,
          viewingCancelledBackofficeEmail({
            canceller_name: canceller?.name,
            other_name: recipients.map((p) => p.name).filter(Boolean).join(", ") || undefined,
            title: listing?.title ?? undefined,
            area,
            slot: when,
            reason: v.cancel_reason ?? undefined,
            conversation_id: convId,
          }),
        );
        sent.team = true;
      } catch (e) { errors.push(`team: ${(e as Error).message}`); }
    }

    return new Response(JSON.stringify({ ok: errors.length === 0, sent, errors }), {
      status: errors.length ? 502 : 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    /* Stond tot 30-08-2026 op 400. Een databasestoring of een ontbrekende
       service key kwam daardoor terug als "Bad Request", en wie 4xx leest als
       "niet opnieuw proberen" gooide die gevallen permanent weg. Onbekende
       fouten horen 500 te zijn; 400 en 404 worden hierboven expliciet gegeven. */
    console.error("notify-viewing error:", e);
    return json({ ok: false, error: String((e as Error)?.message ?? e) }, 500);
  }
});
