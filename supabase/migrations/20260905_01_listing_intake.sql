-- ============================================================
--  MyKunda — listing_intake
--  05-09-2026
--
--  Legt vast waar de tekst van een advertentie vandaan komt en
--  op welke grondslag hij op mykunda.com mag staan.
--
--  WAAROM DEZE TABEL BESTAAT
--  Het auteursrecht op een advertentietekst en de foto's ligt bij
--  de aanbieder. Overnemen mag alleen met zijn toestemming, ook
--  bij handmatig overtypen. Zonder vastlegging is achteraf niet
--  te laten zien dat die toestemming er was. Vandaar dat de
--  grondslag geen vinkje in het scherm is maar een kolom met een
--  check-constraint eronder: het scherm kan veranderen, deze
--  regel niet.
--
--  Twee grondslagen, meer zijn er niet:
--    seller_pasted          de aanbieder plakte zijn eigen tekst
--                           in zijn eigen formulier (list.html)
--    seller_gave_permission iemand anders plaatst namens hem, en
--                           dan zijn naam, datum en bewijsregel
--                           verplicht (admin.html)
--
--  Er verandert niets aan listings, listing_media of
--  listing_evidence. Draai je deze migratie niet, dan blijft het
--  plakvak op list.html gewoon werken; er wordt dan alleen geen
--  herkomst bewaard.
-- ============================================================

create table if not exists public.listing_intake (
  id                 uuid primary key default uuid_generate_v4(),
  -- leeg tot het concept is aangemaakt; blijft leeg als de intake
  -- nergens toe leidt
  listing_id         uuid references public.listings(id) on delete set null,
  created_by         uuid not null references auth.users(id) on delete cascade,

  source             text not null check (source in
                       ('facebook_marketplace','facebook_group','instagram',
                        'whatsapp','email','other')),
  -- alleen voor de administratie; er wordt nooit iets opgehaald
  source_url         text,
  pasted_text        text not null,
  parsed             jsonb not null default '{}'::jsonb,

  permission_basis   text not null check (permission_basis in
                       ('seller_pasted','seller_gave_permission')),
  permission_name    text,
  permission_note    text,
  permission_at      timestamptz,

  created_at         timestamptz not null default now()
);

-- Toestemming van een derde vraagt om naam, datum en bewijsregel.
-- Bij seller_pasted is dat niet nodig: dan is de aanbieder zelf de
-- persoon die het formulier invult.
alter table public.listing_intake
  drop constraint if exists intake_permission_complete;
alter table public.listing_intake
  add constraint intake_permission_complete check (
    permission_basis = 'seller_pasted'
    or (permission_name is not null
        and permission_at  is not null
        and permission_note is not null)
  );

create index if not exists listing_intake_listing_idx on public.listing_intake(listing_id);
create index if not exists listing_intake_created_by_idx on public.listing_intake(created_by);

-- ---- RLS -------------------------------------------------------
alter table public.listing_intake enable row level security;

drop policy if exists intake_own_select on public.listing_intake;
create policy intake_own_select on public.listing_intake
  for select using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists intake_own_insert on public.listing_intake;
create policy intake_own_insert on public.listing_intake
  for insert with check (created_by = auth.uid());

-- Bijwerken alleen om de listing_id te koppelen zodra het concept
-- bestaat. De grondslag en de geplakte tekst blijven zoals ze zijn
-- vastgelegd; dat is het hele punt van deze tabel.
drop policy if exists intake_own_update on public.listing_intake;
create policy intake_own_update on public.listing_intake
  for update using (
    created_by = auth.uid()
    or exists (select 1 from public.profiles p
               where p.id = auth.uid() and p.role = 'admin')
  );

comment on table public.listing_intake is
  'Herkomst en grondslag van een advertentietekst die via het plakvak of de admin-intake op MyKunda terechtkomt. Zie 20260905_01.';
