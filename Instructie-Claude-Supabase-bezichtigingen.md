# Instructie: bezichtigingen (viewings) uitvoeren in Supabase

Voor: Claude met Supabase-toegang op het project MyKunda
(`jejaerpqltqryqzjvbjp`).
Opdrachtgever: Edwin. Datum opdracht: 20-08-2026.
Deze instructie is zelfstandig leesbaar — je hebt geen ander document nodig.

---

## 0. Wat je gaat doen

MyKunda is een woningplatform voor Gambia. Verhuurders en potentiële huurders
praten met elkaar via een berichtensysteem dat al leeft in productie
(`public.conversations`, `public.messages`, RPC's `start_conversation` en
`mark_conversation_read`, view `public.conversation_people`).

Een bezichtiging afspreken gebeurt nu binnen die berichten, verpakt in een
tekst-staart `[[mk:v1|{…}]]`. Dat is niet telbaar, niet sorteerbaar en er kan
geen herinnering op. Jij gaat een eigen tabel `public.viewings` toevoegen met
drie RPC's, een leesview, realtime en een cron-taak voor herinneringen.

### Harde grenzen

- **Niets verwijderen of leegmaken.** Geen `drop` op bestaande objecten, geen
  `delete`/`truncate` op `conversations`, `messages`, `listings`, `profiles`.
- **Eén wijziging aan een bestaande tabel is toegestaan:** `alter table
  public.messages add column viewing_id uuid …`. Dat is additief en nullable.
- **Raak de bestaande mailtrigger op `messages` niet aan.** Je leest hem alleen.
- **Geen wijzigingen aan `role`-kolommen, rechten of gebruikersrollen.**
- **Geen sitebestanden aanpassen.** HTML/JS van mykunda.com loopt via een ander
  project; jij werkt uitsluitend in de database.
- Alles in **één transactie per stap**, en na elke stap de verificatiequery
  uitvoeren voordat je verder gaat.
- Berichtteksten zijn **Engels**. De site is Engels en dezelfde tekst gaat de
  meldingsmail in.

Als een verificatie faalt: stop, rol die stap terug (sectie 6) en rapporteer.
Ga niet improviseren op de structuur van bestaande tabellen.

---

## 1. Verkenning eerst (alleen lezen)

Voer deze queries uit en **rapporteer de uitkomsten voordat je iets aanmaakt**.
Het contract gaat uit van aannames die hier bevestigd moeten worden.

```sql
-- 1a. kolommen van de bestaande tabellen die we aanraken
select table_name, column_name, data_type, is_nullable
  from information_schema.columns
 where table_schema = 'public'
   and table_name in ('conversations','messages','listings')
 order by table_name, ordinal_position;
```

Verwacht in `conversations`: `id`, `listing_id`, `buyer_id`, `seller_id`,
`last_message_at`, `last_message_preview`, `last_sender_id`, `buyer_unread`,
`seller_unread`.
Verwacht in `messages`: `id`, `conversation_id`, `sender_id`, `body`,
`created_at`, `read_at`.
Verwacht in `listings`: `id`, `title`, `price`, `kind`, `category`,
`agent_id`, `owner_id`.

**Wijkt een kolomnaam af, gebruik dan de echte naam** en noem de afwijking in je
rapport. Verzin geen kolommen bij.

```sql
-- 1b. de bestaande mailtrigger op messages — hoe wordt mail verstuurd?
select t.tgname, p.proname, pg_get_functiondef(p.oid) as definition
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  join pg_class c on c.oid = t.tgrelid
 where c.relname = 'messages' and not t.tgisinternal;

-- 1c. welke extensies staan aan
select extname from pg_extension order by extname;

-- 1d. draait pg_cron en wat staat er al ingeschedulet
select * from cron.job;

-- 1e. taal-instelling voor to_char (moet C of en_US zijn voor Engelse dagnamen)
show lc_time;

-- 1f. realtime-publicatie: welke tabellen zitten er al in
select schemaname, tablename from pg_publication_tables
 where pubname = 'supabase_realtime' order by tablename;

-- 1g. bestaande RPC's, zodat je de stijl volgt en geen naam dubbel gebruikt
select p.proname, pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef as security_definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' order by p.proname;
```

Uit **1b** haal je hoe mail het systeem verlaat: een queue-tabel waarin de
trigger een rij schrijft, een `net.http_post` naar een Edge Function, of een
`pg_notify`. Dat bepaalt sectie 5. Zet de functiedefinitie in je rapport.

Uit **1e**: staat `lc_time` op een niet-Engelse locale, meld dat — dan worden de
dagnamen in de berichttekst niet Engels en moeten we `to_char` vervangen door
een expliciete mapping.

---

## 2. Migratie

Voer de stappen in deze volgorde uit. Elke stap is idempotent geschreven waar
dat kan (`if not exists`), zodat een herhaalde run niet stukloopt.

### Stap 1 — type, tabel, indexen

```sql
begin;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'viewing_status') then
    create type public.viewing_status as enum
      ('proposed','confirmed','declined','cancelled','completed');
  end if;
end $$;

create table if not exists public.viewings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id      uuid not null references public.listings(id)      on delete cascade,
  proposer_id     uuid not null references auth.users(id)           on delete cascade,
  invitee_id      uuid not null references auth.users(id)           on delete cascade,
  status          public.viewing_status not null default 'proposed',

  slots           timestamptz[] not null,
  chosen_slot     timestamptz,
  note            text,

  message_id      uuid references public.messages(id) on delete set null,
  responded_at    timestamptz,
  cancelled_by    uuid references auth.users(id),
  cancel_reason   text,
  reminded_24h_at timestamptz,
  reminded_2h_at  timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint viewings_slots_len
    check (array_length(slots,1) between 1 and 3),
  constraint viewings_chosen_in_slots
    check (chosen_slot is null or chosen_slot = any(slots)),
  constraint viewings_confirmed_has_slot
    check (status not in ('confirmed','completed') or chosen_slot is not null),
  constraint viewings_parties_differ
    check (proposer_id <> invitee_id)
);

create index if not exists viewings_conversation_idx
  on public.viewings (conversation_id, created_at desc);
create index if not exists viewings_listing_idx  on public.viewings (listing_id);
create index if not exists viewings_invitee_idx  on public.viewings (invitee_id, status);
create index if not exists viewings_proposer_idx on public.viewings (proposer_id, status);
create index if not exists viewings_upcoming_idx on public.viewings (chosen_slot)
  where status = 'confirmed';

-- hoogstens één open voorstel per gesprek
create unique index if not exists viewings_one_open_per_conversation
  on public.viewings (conversation_id) where status = 'proposed';

commit;
```

Verificatie:

```sql
select count(*) as kolommen from information_schema.columns
 where table_schema='public' and table_name='viewings';           -- verwacht 17
select conname from pg_constraint
 where conrelid = 'public.viewings'::regclass order by conname;    -- 4 checks + keys
select indexname from pg_indexes where tablename='viewings';       -- 6 indexen + pkey
```

### Stap 2 — koppelkolom op messages

```sql
begin;
alter table public.messages
  add column if not exists viewing_id uuid references public.viewings(id) on delete set null;
create index if not exists messages_viewing_idx on public.messages (viewing_id)
  where viewing_id is not null;
commit;
```

Verificatie: `select count(*) from public.messages where viewing_id is not null;`
→ moet `0` zijn, en bestaande berichten moeten ongemoeid zijn:
`select count(*) from public.messages;` vergelijk met de waarde die je vóór deze
stap noteert. **Noteer dat aantal vooraf.**

### Stap 3 — updated_at trigger

```sql
begin;
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists viewings_touch on public.viewings;
create trigger viewings_touch before update on public.viewings
  for each row execute function public.touch_updated_at();
commit;
```

Bestaat `touch_updated_at` al met een andere inhoud (check in 1g), gebruik dan
de bestaande functie en maak geen tweede.

### Stap 4 — RLS

```sql
begin;
alter table public.viewings enable row level security;

drop policy if exists viewings_select_participants on public.viewings;
create policy viewings_select_participants on public.viewings
  for select to authenticated
  using (auth.uid() in (proposer_id, invitee_id));

revoke all on public.viewings from anon, authenticated;
grant select on public.viewings to authenticated;
commit;
```

Er komt **geen** insert-, update- of delete-policy. Schrijven kan uitsluitend
via de RPC's van stap 5 — dezelfde keuze als bij `mark_conversation_read`.

Verificatie:

```sql
select relrowsecurity from pg_class where oid='public.viewings'::regclass; -- t
select policyname, cmd from pg_policies where tablename='viewings';        -- 1 rij, SELECT
```

### Stap 5 — de drie RPC's

```sql
begin;

create or replace function public.propose_viewing(
  p_conversation_id uuid,
  p_slots           timestamptz[],
  p_note            text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conv    conversations;
  v_invitee uuid;
  v_id      uuid;
  v_msg_id  uuid;
  v_body    text;
begin
  select * into v_conv from conversations where id = p_conversation_id;
  if v_conv is null then raise exception 'conversation-not-found'; end if;
  if auth.uid() not in (v_conv.buyer_id, v_conv.seller_id) then
    raise exception 'not-a-participant';
  end if;

  v_invitee := case when auth.uid() = v_conv.buyer_id
                    then v_conv.seller_id else v_conv.buyer_id end;

  if array_length(p_slots,1) is null or array_length(p_slots,1) > 3 then
    raise exception 'slots-out-of-range';
  end if;
  if exists (select 1 from unnest(p_slots) s where s < now() + interval '30 minutes') then
    raise exception 'slot-in-past';
  end if;

  update viewings set status = 'cancelled', cancelled_by = auth.uid(),
         cancel_reason = 'superseded'
   where conversation_id = p_conversation_id and status = 'proposed';

  insert into viewings (conversation_id, listing_id, proposer_id, invitee_id, slots, note)
  values (p_conversation_id, v_conv.listing_id, auth.uid(), v_invitee,
          p_slots, nullif(btrim(p_note), ''))
  returning id into v_id;

  v_body := 'Proposed viewing times: ' ||
            (select string_agg(to_char(s, 'Dy DD Mon · HH24:MI'), ' · ' order by s)
               from unnest(p_slots) s);

  insert into messages (conversation_id, sender_id, body, viewing_id)
  values (p_conversation_id, auth.uid(), v_body, v_id)
  returning id into v_msg_id;

  update viewings set message_id = v_msg_id where id = v_id;
  return v_id;
end $$;

create or replace function public.respond_viewing(
  p_viewing_id uuid,
  p_slot       timestamptz default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v viewings; v_body text;
begin
  select * into v from viewings where id = p_viewing_id for update;
  if v is null then raise exception 'viewing-not-found'; end if;
  if auth.uid() <> v.invitee_id then raise exception 'not-the-invitee'; end if;
  if v.status <> 'proposed' then raise exception 'already-resolved'; end if;

  if p_slot is null then
    update viewings set status = 'declined', responded_at = now() where id = v.id;
    v_body := 'None of those times work — could you suggest a few others?';
  else
    if not (p_slot = any(v.slots)) then raise exception 'slot-not-offered'; end if;
    if p_slot < now() then raise exception 'slot-in-past'; end if;
    update viewings set status = 'confirmed', chosen_slot = p_slot,
           responded_at = now() where id = v.id;
    v_body := 'Viewing confirmed: ' || to_char(p_slot, 'Dy DD Mon · HH24:MI');
  end if;

  insert into messages (conversation_id, sender_id, body, viewing_id)
  values (v.conversation_id, auth.uid(), v_body, v.id);
end $$;

create or replace function public.cancel_viewing(
  p_viewing_id uuid,
  p_reason     text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v viewings;
begin
  select * into v from viewings where id = p_viewing_id for update;
  if v is null then raise exception 'viewing-not-found'; end if;
  if auth.uid() not in (v.proposer_id, v.invitee_id) then
    raise exception 'not-a-participant';
  end if;
  if v.status not in ('proposed','confirmed') then raise exception 'not-cancellable'; end if;

  update viewings set status = 'cancelled', cancelled_by = auth.uid(),
         cancel_reason = nullif(btrim(p_reason), '') where id = v.id;

  insert into messages (conversation_id, sender_id, body, viewing_id)
  values (v.conversation_id, auth.uid(),
          'Viewing cancelled' || coalesce(' — ' || nullif(btrim(p_reason), ''), ''), v.id);
end $$;

grant execute on function public.propose_viewing(uuid, timestamptz[], text) to authenticated;
grant execute on function public.respond_viewing(uuid, timestamptz)         to authenticated;
grant execute on function public.cancel_viewing(uuid, text)                 to authenticated;
revoke execute on function public.propose_viewing(uuid, timestamptz[], text) from anon;
revoke execute on function public.respond_viewing(uuid, timestamptz)         from anon;
revoke execute on function public.cancel_viewing(uuid, text)                 from anon;

commit;
```

### Stap 6 — leesview en teller

```sql
begin;

create or replace view public.my_viewings
with (security_invoker = true) as
select v.id, v.conversation_id, v.listing_id, v.status, v.slots, v.chosen_slot,
       v.note, v.message_id, v.created_at, v.responded_at,
       v.reminded_24h_at, v.reminded_2h_at,
       (v.proposer_id = auth.uid()) as i_proposed,
       case when v.proposer_id = auth.uid() then v.invitee_id
            else v.proposer_id end   as other_id,
       l.title as listing_title, l.price as listing_price, l.kind as listing_kind
  from public.viewings v
  join public.listings l on l.id = v.listing_id
 where auth.uid() in (v.proposer_id, v.invitee_id);

grant select on public.my_viewings to authenticated;

create or replace function public.count_upcoming_viewings() returns integer
language sql security definer set search_path = public, pg_temp as $$
  select count(*)::int from viewings
   where auth.uid() in (proposer_id, invitee_id)
     and status = 'confirmed' and chosen_slot > now();
$$;
grant execute on function public.count_upcoming_viewings() to authenticated;

commit;
```

`security_invoker = true` is niet optioneel: zonder dat draait de view met de
rechten van de eigenaar en omzeilt hij RLS — dan ziet iedere ingelogde
gebruiker alle bezichtigingen. Verifieer:

```sql
select reloptions from pg_class where oid='public.my_viewings'::regclass;
-- moet {security_invoker=true} bevatten
```

### Stap 7 — realtime

```sql
alter publication supabase_realtime add table public.viewings;
```

Verificatie: `viewings` staat in de uitkomst van query 1f.

### Stap 8 — herinneringen via cron

**Besluit van de opdrachtgever:** een herinnering wordt **niet** als bericht in
`messages` ingevoegd. De bestaande trigger verhoogt `buyer_unread`/
`seller_unread` bij elke insert; een reminder zou dus een ongelezen-badge geven
zonder dat iemand iets geschreven heeft. Een reminder gaat per mail naar **beide**
partijen, en de website rendert hem uit `reminded_24h_at`/`reminded_2h_at`.

Vul `send_viewing_reminder_mail` in op basis van wat je in **1b** vond. Drie
gevallen:

- **queue-tabel** (de trigger schrijft een rij, iets anders verstuurt):
  schrijf hier dezelfde soort rij, met de ontvangers `proposer_id` en
  `invitee_id`, subject `Reminder: viewing tomorrow` / `Reminder: viewing in
  2 hours`.
- **`net.http_post` naar een Edge Function:** doe dezelfde post met een payload
  die die functie begrijpt. Verzin geen nieuw payload-formaat; volg het bestaande.
- **iets anders of onduidelijk:** maak de functie aan als lege huls die
  `raise notice` doet, laat de rest van de cron-taak wél werken, en rapporteer
  dat de mail nog aangesloten moet worden. **Verzin geen mailkanaal.**

```sql
begin;

-- vul de body in volgens de uitkomst van verkenning 1b
create or replace function public.send_viewing_reminder_mail(
  p_viewing_id uuid, p_phase text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- TODO: zelfde mailkanaal als de bestaande trigger op messages.
  -- Ontvangers: viewings.proposer_id én viewings.invitee_id.
  raise notice 'viewing reminder % phase %', p_viewing_id, p_phase;
end $$;

create or replace function public.run_viewing_reminders() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r record;
begin
  for r in select id from public.viewings
            where status='confirmed' and reminded_24h_at is null
              and chosen_slot between now() and now() + interval '24 hours'
  loop
    perform public.send_viewing_reminder_mail(r.id, '24h');
    update public.viewings set reminded_24h_at = now() where id = r.id;
  end loop;

  for r in select id from public.viewings
            where status='confirmed' and reminded_2h_at is null
              and chosen_slot between now() and now() + interval '2 hours'
  loop
    perform public.send_viewing_reminder_mail(r.id, '2h');
    update public.viewings set reminded_2h_at = now() where id = r.id;
  end loop;

  update public.viewings set status = 'completed'
   where status = 'confirmed' and chosen_slot < now() - interval '2 hours';
end $$;

revoke execute on function public.run_viewing_reminders() from anon, authenticated;
revoke execute on function public.send_viewing_reminder_mail(uuid, text) from anon, authenticated;

commit;

select cron.schedule('viewing-reminders', '*/15 * * * *',
                     $$select public.run_viewing_reminders()$$);
```

Let op: de reminder-functies zijn **niet** aanroepbaar door clients — alleen cron
(die draait als tabeleigenaar) mag ze uitvoeren.

Bestaat de cron-job al, dan geeft `cron.schedule` met dezelfde naam een update.
Controleer daarna:

```sql
select jobid, schedule, command, active from cron.job where jobname='viewing-reminders';
```

En ná een kwartier, want een falende cron-taak is stil:

```sql
select status, return_message, start_time
  from cron.job_run_details
 where jobid = (select jobid from cron.job where jobname='viewing-reminders')
 order by start_time desc limit 5;
```

---

## 3. Functionele test met twee accounts

Doe dit met twee **echte testgebruikers** (geen service-role, want dan is
`auth.uid()` null en zeggen de tests niets). Gebruik bestaande testaccounts of
maak er twee aan; verwijder ze niet als ze al bestonden.

Neem een bestaand gesprek, of maak er een via `start_conversation`. Noteer
`conversation_id`, de `buyer_id` en de `seller_id`.

Als **verhuurder (seller)**:

```sql
select public.propose_viewing(
  '<conversation_id>',
  array[ now() + interval '2 days', now() + interval '3 days' ]::timestamptz[],
  'Happy to show you around'
);
```

Verwacht: een uuid terug, één rij in `viewings` met status `proposed`, en één
nieuw bericht in `messages` met `viewing_id` gevuld en een leesbare Engelse body.

Als **huurder (buyer)**:

```sql
select public.respond_viewing('<viewing_id>', '<een van de twee slots>');
```

Verwacht: status `confirmed`, `chosen_slot` gevuld, `responded_at` gezet, en een
bericht "Viewing confirmed: …" in de thread.

Controleer daarna als beide gebruikers:

```sql
select * from public.my_viewings;                -- alleen eigen rijen
select public.count_upcoming_viewings();         -- 1
```

### Negatieve tests — deze moeten allemaal falen

Een geslaagde negatieve test is een **fout**melding. Slaagt zo'n aanroep wél,
stop en rapporteer.

1. Derde account (geen deelnemer) doet `select * from public.viewings` → 0 rijen.
2. Derde account doet `propose_viewing` op dat gesprek → `not-a-participant`.
3. De **voorsteller** doet `respond_viewing` op zijn eigen voorstel →
   `not-the-invitee`.
4. `respond_viewing` met een slot dat niet is aangeboden → `slot-not-offered`.
5. `respond_viewing` op een al bevestigde bezichtiging → `already-resolved`.
6. `propose_viewing` met een moment in het verleden → `slot-in-past`.
7. `propose_viewing` met vier momenten → `slots-out-of-range`.
8. Tweede `propose_viewing` op hetzelfde gesprek → slaagt, en het eerste
   voorstel staat op `cancelled` met `cancel_reason = 'superseded'`.
9. Een deelnemer doet rechtstreeks
   `update public.viewings set status='confirmed' where id='…'` →
   0 rijen geraakt of een rechtenfout (er is geen UPDATE-policy).
10. `insert into public.viewings …` als deelnemer → geweigerd.
11. `select * from public.my_viewings` als een derde account → 0 rijen.

Ruim je testrijen daarna op met de **service-role** (RLS omzeilt dat), en
alleen de rijen die je zelf hebt gemaakt:

```sql
delete from public.messages where viewing_id in ('<ids van je testviewings>');
delete from public.viewings where id in ('<ids van je testviewings>');
```

---

## 4. Wat de website hierna nodig heeft

Je voert dit **niet** uit — de sitebestanden lopen via een ander project. Neem
het wel op in je rapport zodat Edwin het kan doorgeven:

- `supabase.js` krijgt: `proposeViewing(conversationId, slotsIso, note)`,
  `respondToViewing(viewingId, slotIso|null)`, `cancelViewing(viewingId, reason)`,
  `fetchViewingsForConversation(conversationId)`, `fetchUpcomingViewings()`,
  `countUpcomingViewings()`, `subscribeToViewings(conversationId, onChange)`.
- `fetchMessages` moet ook `viewing_id` selecteren.
- `messages.html` rendert een bericht met `viewing_id` als bezichtigingskaart met
  de stand uit `viewings`; de berichttekst is alleen fallback. Het huidige
  `[[mk:v1|…]]`-formaat blijft één release alleen-lezen in de parser staan zodat
  bestaande afspraken niet uit de threads verdwijnen.
- `dashboard.html` krijgt een teller uit `count_upcoming_viewings()`.

---

## 5. Terugrollen

Alleen gebruiken als een stap mislukt. Van onder naar boven:

```sql
select cron.unschedule('viewing-reminders');
alter publication supabase_realtime drop table public.viewings;
drop function if exists public.run_viewing_reminders();
drop function if exists public.send_viewing_reminder_mail(uuid, text);
drop function if exists public.count_upcoming_viewings();
drop view if exists public.my_viewings;
drop function if exists public.cancel_viewing(uuid, text);
drop function if exists public.respond_viewing(uuid, timestamptz);
drop function if exists public.propose_viewing(uuid, timestamptz[], text);
drop trigger if exists viewings_touch on public.viewings;
delete from public.messages where viewing_id is not null;  -- alleen testberichten
alter table public.messages drop column if exists viewing_id;
drop table if exists public.viewings;
drop type if exists public.viewing_status;
```

`touch_updated_at` niet droppen als die al bestond vóór jouw werk.
Die `delete from messages` alleen uitvoeren als je zeker weet dat er nog geen
echte gebruikersbezichtigingen in zitten — in productie na een paar dagen niet
meer blind uitvoeren.

---

## 6. Rapporteer terug

Geef Edwin, kort en concreet:

1. Uitkomst van de verkenning: afwijkende kolomnamen, `lc_time`, welke
   extensies, en **de definitie van de bestaande mailtrigger**.
2. Welke stappen zijn uitgevoerd en welke verificaties groen waren.
3. Uitkomst van de elf negatieve tests — per stuk geslaagd (= geweigerd) of niet.
4. Of `send_viewing_reminder_mail` echt is aangesloten of nog een lege huls is,
   en wat er nodig is om hem af te maken.
5. De eerste `cron.job_run_details`-regels na een kwartier.
6. Alles wat je hebt afgeweken van deze instructie, met de reden.

Twijfel je over een stap die bestaande data raakt: niet doen, eerst vragen.
