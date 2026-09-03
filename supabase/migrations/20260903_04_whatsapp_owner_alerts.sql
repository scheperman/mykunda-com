-- 03-09-2026: WhatsApp-meldingen aan de aanbieder (Edwin: "Ik wil dat wel").
--
-- 1. profiles.notify_whatsapp — de schakelaar voor "stuur mij een WhatsApp
--    bij een nieuwe aanvraag". Standaard aan; de aanbieder zet hem uit onder
--    Account in My MyKunda. Losse kolom naast notify_messages, want e-mail en
--    WhatsApp zijn twee kanalen die je los wilt kunnen kiezen.
alter table public.profiles
  add column if not exists notify_whatsapp boolean not null default true;
comment on column public.profiles.notify_whatsapp is
  'Aanbieder wil een WhatsApp-bericht (Meta Cloud API, template lead_owner) bij een nieuwe aanvraag op een van zijn advertenties. Standaard true. Het nummer komt uit listings.contact_phone van de advertentie, anders profiles.phone.';

-- Kolomrecht: authenticated mag op profiles alleen een vaste lijst kolommen
-- schrijven (zie 30-08-2026). Deze komt erbij; role en agency_id blijven
-- buiten bereik.
grant update (notify_whatsapp) on public.profiles to authenticated;

-- 2. Een telefoonnummer terugzoeken naar een aanbieder. wa-inbound gebruikt
--    dit om een ANTWOORD van een aanbieder op zo'n melding te herkennen: dat
--    is geen lead, dus er hoort geen leadrij en geen "team antwoordt binnen
--    1-2 werkdagen" uit te gaan. Vergelijkt op cijfers, zodat "+220 700 0001",
--    "2207000001" en "7000001" hetzelfde nummer zijn. Gewone functie, geen
--    SECURITY DEFINER: de aanroeper is de service role.
create or replace function public.supplier_by_phone(p_digits text)
returns uuid
language sql
stable
as $$
  with d as (
    select regexp_replace(coalesce(p_digits, ''), '\D', '', 'g') as full,
           regexp_replace(regexp_replace(coalesce(p_digits, ''), '\D', '', 'g'), '^220', '') as local
  ),
  nums as (
    select p.id as user_id, regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') as n
      from public.profiles p
     where p.role in ('seller', 'agent', 'admin') and p.phone is not null
    union all
    select l.owner_id, regexp_replace(coalesce(l.contact_phone, ''), '\D', '', 'g')
      from public.listings l
     where l.contact_phone is not null
  )
  select nums.user_id
    from nums, d
   where nums.n <> ''
     and (nums.n = d.full or nums.n = d.local or ('220' || nums.n) = d.full)
   limit 1;
$$;

revoke execute on function public.supplier_by_phone(text) from public, anon, authenticated;
