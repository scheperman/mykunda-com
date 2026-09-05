-- ============================================================
--  MyKunda — 20260905_02_listing_claim
--  Overdracht van een advertentie die iemand anders heeft ingevoerd.
--
--  Waarom geen account aanmaken voor de aanbieder: handle_new_user()
--  legt consent_contact/consent_marketing/consent_at vast uit de
--  aanmeldgegevens. Een account dat wij aanmaken heeft die toestemming
--  per definitie niet. De aanbieder maakt zijn account dus zelf, en
--  neemt daarna zijn advertentie over met een code.
--
--  Tot dat moment: owner_id = degene die hem invoerde (admin),
--  contact_* = de aanbieder. Enquiries gaan naar hem, het beheer bij ons.
-- ============================================================

alter table public.listings
  add column if not exists entered_on_behalf boolean not null default false,
  add column if not exists claim_token   text,
  add column if not exists claim_contact text,
  add column if not exists claimed_at    timestamptz,
  add column if not exists claimed_by    uuid references auth.users(id) on delete set null;

comment on column public.listings.entered_on_behalf is
  'true = ingevoerd door een ander dan de aanbieder (intake). Alleen zo''n advertentie is over te nemen.';
comment on column public.listings.claim_token is
  'Eenmalige overdrachtscode. Wordt gewist zodra de advertentie is overgenomen.';
comment on column public.listings.claim_contact is
  'Waar de code naartoe is gestuurd (Messenger-profiel, telefoonnummer), zodat naderhand te zien is aan wie hij is gegeven.';

create unique index if not exists listings_claim_token_key
  on public.listings (claim_token) where claim_token is not null;

create index if not exists listings_on_behalf_idx
  on public.listings (entered_on_behalf) where entered_on_behalf;

-- ------------------------------------------------------------
--  claim_listing(code) — de aanbieder neemt zijn advertentie over.
--  SECURITY DEFINER omdat de aanroeper op dat moment nog geen enkel
--  recht op de rij heeft: hij is de eigenaar nog niet. Het user-id
--  komt uit auth.uid(), nooit uit een parameter.
-- ------------------------------------------------------------
create or replace function public.claim_listing(p_token text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  select id into v_id
    from public.listings
   where claim_token = btrim(p_token)
     and claimed_at is null
     and entered_on_behalf
   for update;

  if v_id is null then
    -- Bewust een boodschap voor onbekend en al gebruikt: anders is de
    -- functie een orakel waarmee codes te raden zijn.
    raise exception 'unknown or already used code' using errcode = '22023';
  end if;

  update public.listings
     set owner_id    = auth.uid(),
         claimed_by  = auth.uid(),
         claimed_at  = now(),
         claim_token = null
   where id = v_id;

  return v_id;
end;
$$;

revoke all on function public.claim_listing(text) from public, anon;
grant execute on function public.claim_listing(text) to authenticated;
