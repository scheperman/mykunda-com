-- ============================================================
--  MyKunda — Sprint 6: Title Verification Workflow
--  Phase 2, Sprint 6 migration
--  Apply after schema.sql (Phase 1 + Sprints 4–5)
--
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

-- ============================================================
--  ENUMS
-- ============================================================
do $$ begin
  create type verification_status as enum (
    'pending',        -- seller submitted, awaiting admin
    'in_review',      -- admin has opened / started review
    'info_requested', -- admin needs more documents or info
    'approved',       -- title verified — badge granted
    'rejected'        -- title verification denied
  );
exception when duplicate_object then null; end $$;

-- ============================================================
--  TITLE VERIFICATIONS
--  One per listing. Tracks the overall verification request.
-- ============================================================
create table if not exists public.title_verifications (
  id            uuid primary key default uuid_generate_v4(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  status        verification_status not null default 'pending',
  reviewer_id   uuid references public.profiles(id) on delete set null,

  -- Reviewer feedback
  reviewer_notes text,
  rejection_reason text,
  info_request_note text,

  -- Timestamps
  submitted_at  timestamptz not null default now(),
  reviewed_at   timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists title_verif_listing_idx on public.title_verifications(listing_id);
create index if not exists title_verif_status_idx  on public.title_verifications(status);
create index if not exists title_verif_owner_idx   on public.title_verifications(owner_id);

-- Only one active verification per listing (prevent duplicates)
create unique index if not exists title_verif_listing_unique
  on public.title_verifications(listing_id)
  where status not in ('rejected');

-- ============================================================
--  VERIFICATION DOCUMENTS
--  Files uploaded for a specific verification request.
-- ============================================================
create table if not exists public.verification_docs (
  id                uuid primary key default uuid_generate_v4(),
  verification_id   uuid not null references public.title_verifications(id) on delete cascade,
  storage_path      text not null,         -- path in listing-docs (private) bucket
  filename          text not null,         -- original filename for display
  doc_type          text not null,         -- 'title_deed' | 'ownership_letter' | 'survey_plan' | 'tax_receipt' | 'id_document' | 'other'
  file_size         bigint,               -- bytes
  mime_type         text,
  notes             text,                  -- optional note from uploader
  uploaded_by       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists verif_docs_verif_idx on public.verification_docs(verification_id);

-- ============================================================
--  VERIFICATION AUDIT LOG
--  Every status change is recorded for transparency.
-- ============================================================
create table if not exists public.verification_audit (
  id                uuid primary key default uuid_generate_v4(),
  verification_id   uuid not null references public.title_verifications(id) on delete cascade,
  action            text not null,         -- 'submitted' | 'review_started' | 'info_requested' | 'doc_added' | 'approved' | 'rejected' | 'resubmitted'
  from_status       verification_status,
  to_status         verification_status,
  actor_id          uuid references public.profiles(id) on delete set null,
  actor_role        text,                  -- 'seller' | 'admin'
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists verif_audit_verif_idx on public.verification_audit(verification_id, created_at);

-- ============================================================
--  TRIGGER: sync updated_at + auto-update listing badge
-- ============================================================
create or replace function public.title_verif_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();

  -- When status changes to 'approved', set is_verified_title on the listing
  if new.status = 'approved' and (old.status is null or old.status <> 'approved') then
    new.completed_at = now();
    new.reviewed_at = coalesce(new.reviewed_at, now());
    update public.listings set is_verified_title = true where id = new.listing_id;
  end if;

  -- When status changes from 'approved' to something else, remove the badge
  if old.status = 'approved' and new.status <> 'approved' then
    update public.listings set is_verified_title = false where id = new.listing_id;
  end if;

  -- When review starts, record the time
  if new.status = 'in_review' and (old.status is null or old.status = 'pending') then
    new.reviewed_at = now();
  end if;

  return new;
end $$;

drop trigger if exists title_verif_sync_trg on public.title_verifications;
create trigger title_verif_sync_trg
  before update on public.title_verifications
  for each row execute function public.title_verif_sync();

-- ============================================================
--  TRIGGER: auto-insert audit log entry on status change
-- ============================================================
create or replace function public.title_verif_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  action_name text;
begin
  if TG_OP = 'INSERT' then
    action_name := 'submitted';
    insert into public.verification_audit (verification_id, action, to_status, actor_id, actor_role)
    values (new.id, action_name, new.status, new.owner_id, 'seller');
  elsif TG_OP = 'UPDATE' and old.status <> new.status then
    case new.status
      when 'in_review'      then action_name := 'review_started';
      when 'info_requested' then action_name := 'info_requested';
      when 'approved'       then action_name := 'approved';
      when 'rejected'       then action_name := 'rejected';
      when 'pending'        then action_name := 'resubmitted';
      else action_name := 'status_changed';
    end case;

    insert into public.verification_audit (
      verification_id, action, from_status, to_status,
      actor_id, actor_role, note
    ) values (
      new.id, action_name, old.status, new.status,
      coalesce(new.reviewer_id, auth.uid()),
      case when new.reviewer_id is not null then 'admin' else 'seller' end,
      case new.status
        when 'rejected'       then new.rejection_reason
        when 'info_requested' then new.info_request_note
        when 'approved'       then new.reviewer_notes
        else null
      end
    );
  end if;

  return new;
end $$;

drop trigger if exists title_verif_audit_trg on public.title_verifications;
create trigger title_verif_audit_trg
  after insert or update on public.title_verifications
  for each row execute function public.title_verif_audit_log();

-- ============================================================
--  ROW-LEVEL SECURITY
-- ============================================================
alter table public.title_verifications enable row level security;
alter table public.verification_docs   enable row level security;
alter table public.verification_audit  enable row level security;

-- title_verifications: owner can read/create their own; admin can read/update all
drop policy if exists "verif owner read"   on public.title_verifications;
drop policy if exists "verif owner create" on public.title_verifications;
drop policy if exists "verif admin all"    on public.title_verifications;
create policy "verif owner read"   on public.title_verifications for select
  using (auth.uid() = owner_id or public.is_admin());
create policy "verif owner create" on public.title_verifications for insert
  with check (auth.uid() = owner_id);
create policy "verif admin all"    on public.title_verifications for all
  using (public.is_admin());

-- verification_docs: owner of the verification can read/insert; admin can do all
drop policy if exists "verif_docs owner read"   on public.verification_docs;
drop policy if exists "verif_docs owner create" on public.verification_docs;
drop policy if exists "verif_docs admin all"    on public.verification_docs;
create policy "verif_docs owner read" on public.verification_docs for select
  using (
    public.is_admin()
    or exists (select 1 from public.title_verifications v where v.id = verification_id and v.owner_id = auth.uid())
  );
create policy "verif_docs owner create" on public.verification_docs for insert
  with check (
    exists (select 1 from public.title_verifications v where v.id = verification_id and v.owner_id = auth.uid())
  );
create policy "verif_docs admin all" on public.verification_docs for all
  using (public.is_admin());

-- verification_audit: owner can read their own; admin can read all
drop policy if exists "verif_audit owner read" on public.verification_audit;
drop policy if exists "verif_audit admin read" on public.verification_audit;
create policy "verif_audit owner read" on public.verification_audit for select
  using (
    exists (select 1 from public.title_verifications v where v.id = verification_id and v.owner_id = auth.uid())
  );
create policy "verif_audit admin read" on public.verification_audit for select
  using (public.is_admin());

-- ============================================================
--  EDGE FUNCTION HOOK: notify-verification
--  Called by the audit log trigger via pg_net or a webhook.
--  Sends email to seller when status changes.
-- ============================================================
-- (The actual Edge Function lives in backend/functions/notify-verification/)
-- This comment documents the expected payload:
--   { verification_id, listing_id, owner_email, new_status, note }

-- ============================================================
--  DONE. New tables:
--    • title_verifications  (verification requests)
--    • verification_docs    (uploaded documents)
--    • verification_audit   (status change log)
--
--  New Storage bucket needed:
--    • listing-docs (private) — if not already created in Sprint 2
-- ============================================================
