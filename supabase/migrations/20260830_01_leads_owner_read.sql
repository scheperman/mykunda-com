-- Fase 0 — de eigenaar van een advertentie mag de reacties op die advertentie lezen.
-- Toegepast op jejaerpqltqryqzjvbjp op 30-08-2026.
--
-- Tot nu toe was de enige leesregel op public.leads "leads staff read":
--   is_admin() OR auth.uid() = assigned_to
-- Bij een binnenkomende reactie is assigned_to leeg, dus fetchMyLeads() in
-- supabase.js kreeg nul rijen terug -- zonder foutmelding, want RLS filtert stil.
-- Het paneel "Recent enquiries" op dashboard.html kon daardoor voor geen enkele
-- niet-admin verkoper ooit vullen.
--
-- Deze policy is het patroon van de bestaande, wel werkende policy
-- "viewings party read" op public.viewings_legacy_v0. Hij staat naast de
-- bestaande policy in plaats van hem te vervangen: permissive policies worden
-- ge-OR'd, dus dit voegt alleen toe. Terugdraaien is een drop policy.
--
-- Nagemeten in een transactie met rollback: de eigenaar ziet de lead die bij
-- zijn advertentie hoort (1), een andere ingelogde gebruiker ziet er nul, en
-- een lead zonder listing_id blijft voor beiden onzichtbaar.

create policy "leads owner read" on public.leads
for select
using (
  exists (
    select 1
    from public.listings l
    where l.id = leads.listing_id
      and (
        (select auth.uid()) = l.owner_id
        or (select auth.uid()) = l.agent_id
      )
  )
);

comment on table public.leads is
  'Reacties uit elk formulier op de site. Leesrechten: admin, de medewerker in assigned_to, en sinds 30-08-2026 de eigenaar/agent van de advertentie waar de reactie bij hoort (policy "leads owner read"). Een lead zonder listing_id blijft alleen zichtbaar voor admin en de toegewezen medewerker.';
