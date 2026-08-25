-- ============================================================
--  MyKunda — Phase 1 database schema
--  Apply in Supabase: SQL Editor → New query → paste → Run
--  (or: supabase db push with this as a migration)
--
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "uuid-ossp";
create extension if not exists postgis;        -- geo queries (within radius, bounding box)

-- ============================================================
--  ENUMS
-- ============================================================
do $$ begin
  create type user_role        as enum ('buyer','seller','agent','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_kind     as enum ('sale','rent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_category as enum ('apartment','house','villa','townhouse','penthouse','compound','land','lodge','commercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status   as enum ('draft','pending_review','active','under_offer','sold','let','rejected','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_source       as enum ('valuation','viewing','agent_message','area_alert','contact','listing_enquiry','consultation');
exception when duplicate_object then null; end $$;
-- If enum already exists, add the new value:
do $$ begin
  alter type lead_source add value if not exists 'consultation';
exception when others then null; end $$;

do $$ begin
  create type lead_stage        as enum ('new','contacted','qualified','viewing_booked','negotiating','won','lost');
exception when duplicate_object then null; end $$;

do $$ begin
  create type viewing_status    as enum ('requested','slots_proposed','confirmed','declined','completed','cancelled');
exception when duplicate_object then null; end $$;

-- ============================================================
--  PROFILES  (extends Supabase auth.users)
--  A row is auto-created on signup via trigger below.
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          user_role   not null default 'buyer',
  full_name     text,
  email         text,
  phone         text,
  locale        text        default 'en',
  -- AVG/GDPR consent, captured explicitly
  consent_contact   boolean default false,
  consent_marketing boolean default false,
  consent_at        timestamptz,
  created_at    timestamptz not null default now()
);

-- auto-provision a profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email,
          new.raw_user_meta_data->>'full_name',
          new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  LISTINGS
-- ============================================================
create table if not exists public.listings (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid references public.profiles(id) on delete set null,
  agent_id      uuid references public.profiles(id) on delete set null,

  kind          listing_kind     not null,            -- sale | rent
  category      listing_category not null,
  status        listing_status   not null default 'draft',

  title         text not null,
  description   text,
  street        text,
  area          text,                                  -- e.g. "Kololi · Kombo South"
  price         numeric(14,2) not null default 0,      -- stored in USD
  negotiable    boolean default false,

  beds          int default 0,
  baths         int default 0,
  sqm           int default 0,                         -- built area
  plot_sqm      int default 0,                         -- land/plot area
  energy        text,
  features      text[] default '{}',

  -- location
  lat           double precision,
  lng           double precision,
  plus_code     text,
  boundary      jsonb,                                 -- seller-drawn plot outline: [[lat,lng], …]
  beach_m       int,                                   -- measured straight-line distance to the Atlantic shoreline
  geom          geography(Point,4326),                 -- set from lat/lng by trigger

  -- commercial
  plan          text default 'basic',                  -- basic | verified | premium
  is_verified_title boolean default false,

  views         int default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists listings_status_idx   on public.listings(status);
create index if not exists listings_kind_idx      on public.listings(kind);
create index if not exists listings_category_idx  on public.listings(category);
create index if not exists listings_owner_idx     on public.listings(owner_id);
create index if not exists listings_geom_idx       on public.listings using gist(geom);

-- keep geom + updated_at in sync
create or replace function public.listings_sync()
returns trigger language plpgsql as $$
begin
  if new.lat is not null and new.lng is not null then
    new.geom = ST_SetSRID(ST_MakePoint(new.lng, new.lat), 4326)::geography;
  end if;
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists listings_sync_trg on public.listings;
create trigger listings_sync_trg
  before insert or update on public.listings
  for each row execute function public.listings_sync();

-- ============================================================
--  LISTING MEDIA  (photos public, documents private)
-- ============================================================
create table if not exists public.listing_media (
  id            uuid primary key default uuid_generate_v4(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  kind          text not null default 'photo',         -- photo | floorplan | pano | document
  storage_path  text not null,                          -- path in storage bucket
  is_document   boolean default false,                  -- true → private bucket
  sort          int default 0,
  created_at    timestamptz not null default now()
);
create index if not exists listing_media_listing_idx on public.listing_media(listing_id);

-- ============================================================
--  LEADS  (every form submission)
-- ============================================================
create table if not exists public.leads (
  id            uuid primary key default uuid_generate_v4(),
  source        lead_source not null,
  stage         lead_stage  not null default 'new',
  listing_id    uuid references public.listings(id) on delete set null,
  assigned_to   uuid references public.profiles(id) on delete set null,

  name          text,
  email         text,
  phone         text,
  area          text,
  message       text,
  payload       jsonb default '{}',                     -- form-specific extras (valuation inputs, etc.)

  created_at    timestamptz not null default now(),
  contacted_at  timestamptz
);
create index if not exists leads_stage_idx  on public.leads(stage);
create index if not exists leads_source_idx on public.leads(source);
create index if not exists leads_created_idx on public.leads(created_at desc);

-- ============================================================
--  VIEWINGS
-- ============================================================
create table if not exists public.viewings (
  id             uuid primary key default uuid_generate_v4(),
  listing_id     uuid not null references public.listings(id) on delete cascade,
  buyer_id       uuid references public.profiles(id) on delete set null,
  buyer_name     text,
  buyer_email    text,
  buyer_phone    text,
  requested_slot timestamptz,
  proposed_slots timestamptz[] default '{}',            -- seller's 3 alternatives
  chosen_slot    timestamptz,
  status         viewing_status not null default 'requested',
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists viewings_listing_idx on public.viewings(listing_id);

-- ============================================================
--  FAVORITES  &  SAVED SEARCHES
-- ============================================================
create table if not exists public.favorites (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.saved_searches (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  label      text,
  filters    jsonb not null default '{}',
  area       text,
  channel    text default 'email',                      -- email | whatsapp
  created_at timestamptz not null default now()
);
create index if not exists saved_searches_user_idx on public.saved_searches(user_id);

-- ============================================================
--  updated helper: is the current user an admin?
-- ============================================================
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ============================================================
--  ROW-LEVEL SECURITY
-- ============================================================
alter table public.profiles       enable row level security;
alter table public.listings        enable row level security;
alter table public.listing_media   enable row level security;
alter table public.leads           enable row level security;
alter table public.viewings        enable row level security;
alter table public.favorites       enable row level security;
alter table public.saved_searches  enable row level security;

-- ---- profiles ----
drop policy if exists "profiles read own"   on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles admin all"  on public.profiles;
create policy "profiles read own"   on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles update own" on public.profiles for update using (auth.uid() = id);
create policy "profiles admin all"  on public.profiles for all    using (public.is_admin());

-- ---- listings ----
-- Public can read only ACTIVE / UNDER_OFFER listings; owners & admins see their own in any state.
drop policy if exists "listings public read"  on public.listings;
drop policy if exists "listings owner read"   on public.listings;
drop policy if exists "listings owner write"  on public.listings;
drop policy if exists "listings owner update" on public.listings;
drop policy if exists "listings admin all"    on public.listings;
create policy "listings public read"  on public.listings for select
  using (status in ('active','under_offer'));
create policy "listings owner read"   on public.listings for select
  using (auth.uid() = owner_id or auth.uid() = agent_id or public.is_admin());
create policy "listings owner write"  on public.listings for insert
  with check (auth.uid() = owner_id);
create policy "listings owner update" on public.listings for update
  using (auth.uid() = owner_id or public.is_admin());
create policy "listings admin all"    on public.listings for all
  using (public.is_admin());

-- ---- listing_media ----
-- Photos of visible listings are public; documents only owner/admin.
drop policy if exists "media public photos" on public.listing_media;
drop policy if exists "media owner all"     on public.listing_media;
create policy "media public photos" on public.listing_media for select
  using (
    is_document = false
    and exists (select 1 from public.listings l
                where l.id = listing_id and l.status in ('active','under_offer'))
  );
create policy "media owner all" on public.listing_media for all
  using (
    public.is_admin()
    or exists (select 1 from public.listings l where l.id = listing_id and l.owner_id = auth.uid())
  );

-- ---- leads ----
-- Anyone (even anonymous visitors) can CREATE a lead; only admin/assigned can read.
drop policy if exists "leads insert anyone" on public.leads;
drop policy if exists "leads admin read"    on public.leads;
drop policy if exists "leads admin update"  on public.leads;
create policy "leads insert anyone" on public.leads for insert with check (true);
create policy "leads admin read"    on public.leads for select using (public.is_admin() or auth.uid() = assigned_to);
create policy "leads admin update"  on public.leads for update using (public.is_admin() or auth.uid() = assigned_to);

-- ---- viewings ----
drop policy if exists "viewings insert anyone" on public.viewings;
drop policy if exists "viewings party read"    on public.viewings;
drop policy if exists "viewings party update"  on public.viewings;
create policy "viewings insert anyone" on public.viewings for insert with check (true);
create policy "viewings party read"    on public.viewings for select
  using (
    public.is_admin()
    or auth.uid() = buyer_id
    or exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or l.agent_id = auth.uid()))
  );
create policy "viewings party update"  on public.viewings for update
  using (
    public.is_admin()
    or auth.uid() = buyer_id
    or exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or l.agent_id = auth.uid()))
  );

-- ---- favorites ----
drop policy if exists "favorites own" on public.favorites;
create policy "favorites own" on public.favorites for all using (auth.uid() = user_id);

-- ---- saved_searches ----
drop policy if exists "saved own" on public.saved_searches;
create policy "saved own" on public.saved_searches for all using (auth.uid() = user_id);

-- ============================================================
--  RPC: increment a listing's view counter (safe, public)
-- ============================================================
create or replace function public.bump_listing_views(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.listings set views = views + 1 where id = p_id and status in ('active','under_offer');
$$;

-- ============================================================
--  DONE.  Next: create Storage buckets (see backend/README.md):
--    • listing-photos   (public)
--    • listing-docs     (private)
-- ============================================================

-- ============================================================
--  PHASE 2 SPRINT 4 — CONVERSATIONS & MESSAGES
-- ============================================================

-- ---- conversations ----
create table if not exists public.conversations (
  id            uuid primary key default uuid_generate_v4(),
  listing_id    uuid references public.listings(id) on delete set null,
  participant_a uuid not null references public.profiles(id) on delete cascade,  -- initiator (buyer)
  participant_b uuid not null references public.profiles(id) on delete cascade,  -- receiver (seller/agent)
  last_message  text,
  last_at       timestamptz default now(),
  created_at    timestamptz not null default now()
);
create index if not exists conversations_a_idx on public.conversations(participant_a);
create index if not exists conversations_b_idx on public.conversations(participant_b);
create index if not exists conversations_listing_idx on public.conversations(listing_id);

-- ---- messages ----
create table if not exists public.messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  body            text not null,
  kind            text not null default 'text',  -- text | system | propose_slots
  payload         jsonb default '{}',             -- slots data for propose_slots, etc.
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists messages_convo_idx on public.messages(conversation_id, created_at);
create index if not exists messages_sender_idx on public.messages(sender_id);

-- ---- update conversation.last_message on new message ----
create or replace function public.update_conversation_last()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set last_message = new.body, last_at = new.created_at
  where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists messages_update_convo on public.messages;
create trigger messages_update_convo
  after insert on public.messages
  for each row execute function public.update_conversation_last();

-- ---- RLS for conversations ----
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

drop policy if exists "convos participant read"  on public.conversations;
drop policy if exists "convos participant write" on public.conversations;
drop policy if exists "convos admin all"         on public.conversations;
create policy "convos participant read"  on public.conversations for select
  using (auth.uid() = participant_a or auth.uid() = participant_b or public.is_admin());
create policy "convos participant write" on public.conversations for insert
  with check (auth.uid() = participant_a);
create policy "convos admin all"         on public.conversations for all
  using (public.is_admin());

drop policy if exists "msgs participant read"  on public.messages;
drop policy if exists "msgs participant write" on public.messages;
drop policy if exists "msgs admin all"         on public.messages;
create policy "msgs participant read"  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
  ) or public.is_admin());
create policy "msgs participant write" on public.messages for insert
  with check (auth.uid() = sender_id);
create policy "msgs participant update" on public.messages for update
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
    and (auth.uid() = c.participant_a or auth.uid() = c.participant_b)
  ));
create policy "msgs admin all"         on public.messages for all
  using (public.is_admin());

-- Enable Supabase Realtime for messages table
alter publication supabase_realtime add table public.messages;

-- ============================================================
--  PHASE 2 SPRINT 5 — WHATSAPP & NOTIFICATION PREFERENCES
-- ============================================================

create table if not exists public.notification_prefs (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  channel       text not null default 'email',          -- email | whatsapp | both
  wa_number     text,                                    -- international format, e.g. +2201234567
  lead_notify   boolean default true,                    -- notify on new lead/enquiry
  viewing_notify boolean default true,                   -- notify on viewing request
  message_notify boolean default true,                   -- notify on new message (if offline)
  listing_alerts boolean default true,                   -- saved search / area alerts
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- RLS: users can read/write their own prefs; admins see all
alter table public.notification_prefs enable row level security;
drop policy if exists "notif_prefs own" on public.notification_prefs;
drop policy if exists "notif_prefs admin" on public.notification_prefs;
create policy "notif_prefs own"   on public.notification_prefs for all using (auth.uid() = user_id);
create policy "notif_prefs admin" on public.notification_prefs for select using (public.is_admin());

-- Auto-create default prefs when a new profile is created
create or replace function public.handle_new_notif_prefs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.notification_prefs (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_profile_create_notif on public.profiles;
create trigger on_profile_create_notif
  after insert on public.profiles
  for each row execute function public.handle_new_notif_prefs();
