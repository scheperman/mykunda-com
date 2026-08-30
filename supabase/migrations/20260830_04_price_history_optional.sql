-- Prijshistorie zichtbaar maken voor bezoekers -- maar optioneel, op drie niveaus.
-- Toegepast op jejaerpqltqryqzjvbjp op 30-08-2026.
--
-- Tot nu toe had listing_price_events een leesregel: "price events admin read"
-- (is_admin()). Daardoor kon een koper nooit zien dat de vraagprijs van zijn
-- favoriet gezakt was, terwijl de trigger listings_price_event() die daling wel
-- netjes bijhoudt. Het dashboard kon die melding dus niet tonen.
--
-- "Optioneel" is hier expres op drie niveaus geregeld, van klein naar groot:
--   1. per advertentie -- listings.show_price_history. De aanbieder ziet de
--      keuze in de prijsstap van het advertentieformulier; standaard aan.
--   2. per platform    -- app_settings.price_history_public. Een rij omzetten
--      en niemand ziet meer prijshistorie, zonder dat er iets uitgerold hoeft
--      te worden. Die tabel is alleen voor een admin leesbaar, dus de
--      schakelaar wordt serverzijdig gelezen; de browser kent hem niet.
--   3. per status      -- alleen advertenties die publiek zichtbaar zijn
--      (active/under_offer) geven hun historie prijs.
--
-- De eigenaar en de agent van een advertentie zien hun eigen historie altijd.
--
-- Nagemeten in transacties met rollback: bezoeker ziet de gebeurtenissen van
-- een actieve advertentie met de schakelaar aan, nul bij show_price_history
-- false, nul bij de hoofdschakelaar uit, en nul voor een ingetrokken
-- advertentie; de eigenaar ziet in alle vier de gevallen alles. Daarna live
-- nagemeten op het dashboard met een echte prijsdaling.

alter table public.listings
  add column if not exists show_price_history boolean not null default true;

comment on column public.listings.show_price_history is
  'Mag de prijsgeschiedenis van deze advertentie aan bezoekers getoond worden? Standaard ja; de aanbieder kiest dit in het advertentieformulier. Werkt alleen als app_settings.price_history_public ook aan staat.';

insert into public.app_settings (key, value, note)
values ('price_history_public','true',
        'Hoofdschakelaar voor prijshistorie op de site. ''false'' verbergt elke prijsdaling voor bezoekers, ongeacht listings.show_price_history. Wordt gelezen door public.price_history_public(); de browser leest deze tabel nooit zelf.')
on conflict (key) do nothing;

create or replace function public.price_history_public()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select lower(s.value) in ('true','1','yes','on')
       from public.app_settings s where s.key = 'price_history_public'),
    true
  );
$function$;

revoke all on function public.price_history_public() from public;
grant execute on function public.price_history_public() to anon, authenticated;

create policy "price events owner read" on public.listing_price_events
for select
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_price_events.listing_id
      and ((select auth.uid()) = l.owner_id or (select auth.uid()) = l.agent_id)
  )
);

create policy "price events public read" on public.listing_price_events
for select
using (
  (select public.price_history_public())
  and exists (
    select 1 from public.listings l
    where l.id = listing_price_events.listing_id
      and l.status = any (array['active'::listing_status,'under_offer'::listing_status])
      and l.show_price_history
  )
);

comment on table public.listing_price_events is
  'Prijswijzigingen per advertentie, gevuld door de trigger listings_price_event(). Zichtbaar voor: admin, de eigenaar/agent van de advertentie, en sinds 30-08-2026 ook voor bezoekers -- maar alleen als de advertentie publiek staat, listings.show_price_history aan staat en de hoofdschakelaar app_settings.price_history_public aan staat.';
