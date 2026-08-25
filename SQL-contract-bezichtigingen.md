# SQL-contract — bezichtigingen (viewings)

Status: voorstel, nog niet uitgevoerd op de database.
Datum: 20-08-2026 · Sluit aan op het berichten-contract van 19-08-2026
(`public.conversations`, `public.messages`, RPC's `start_conversation`,
`mark_conversation_read`, view `public.conversation_people`).

Vastgestelde keuzes (20-08-2026):

- berichtteksten in **Engels**, gelijk aan de site;
- herinneringen gaan **niet** door `messages` — zie sectie 5;
- `pg_cron` is beschikbaar, dus reminders en automatisch afsluiten horen bij de
  eerste oplevering.

## Waarom

Een bezichtiging staat nu in de berichtenrij, verpakt in een tekst-staart
(`[[mk:v1|…]]`). Dat werkt om af te spreken en terug te lezen, maar levert niets
op wat je kunt tellen, sorteren of herinneren: geen agenda-overzicht, geen
dashboardteller, geen reminder, geen "wat staat er deze week gepland".
Daarvoor moet een bezichtiging een eigen rij zijn.

Uitgangspunten, gelijk aan het berichten-contract:

- de client schrijft **nooit** rechtstreeks in de tabel — alles via RPC's;
- tellers, previews en e-mails worden door de database onderhouden;
- RLS laat alleen de twee betrokkenen bij een rij.

---

## 1. Type en tabel

```sql
create type public.viewing_status as enum
  ('proposed','confirmed','declined','cancelled','completed');

create table public.viewings (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listing_id      uuid not null references public.listings(id)      on delete cascade,
  proposer_id     uuid not null references auth.users(id)           on delete cascade,
  invitee_id      uuid not null references auth.users(id)           on delete cascade,
  status          public.viewing_status not null default 'proposed',

  slots           timestamptz[] not null,          -- 1 t/m 3 voorgestelde momenten
  chosen_slot     timestamptz,                     -- gevuld zodra status = confirmed
  note            text,                            -- vrije toelichting van de voorsteller

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
```

`slots` als array (niet een aparte `viewing_slots`-tabel): een voorstel is
maximaal drie momenten en wordt altijd als geheel gelezen en als geheel
vervangen. Een kindtabel voegt joins toe zonder iets op te lossen.

Tijden zijn `timestamptz`. Gambia is het hele jaar UTC+0, maar sla nooit lokale
tijd zonder zone op — verhuurders in het buitenland zijn er ook.

### Indexen

```sql
create index viewings_conversation_idx on public.viewings (conversation_id, created_at desc);
create index viewings_listing_idx      on public.viewings (listing_id);
create index viewings_invitee_idx      on public.viewings (invitee_id, status);
create index viewings_proposer_idx     on public.viewings (proposer_id, status);
create index viewings_upcoming_idx     on public.viewings (chosen_slot)
  where status = 'confirmed';

-- hoogstens één open voorstel per gesprek: een nieuw voorstel vervangt het oude
create unique index viewings_one_open_per_conversation
  on public.viewings (conversation_id)
  where status = 'proposed';
```

### Koppeling met messages

```sql
alter table public.messages
  add column viewing_id uuid references public.viewings(id) on delete set null;

create index messages_viewing_idx on public.messages (viewing_id)
  where viewing_id is not null;
```

Elke RPC schrijft óók een gewoon bericht in de thread, met leesbare tekst en
`viewing_id` gevuld. Zo blijven de bestaande preview-, teller- en
e-mailtriggers werken zonder aanpassing, en blijft het gesprek chronologisch
leesbaar. De client rendert een bericht met `viewing_id` als kaart en haalt de
actuele stand uit `viewings` — niet uit de berichttekst.

### updated_at

```sql
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger viewings_touch before update on public.viewings
  for each row execute function public.touch_updated_at();
```

---

## 2. RLS

```sql
alter table public.viewings enable row level security;

create policy viewings_select_participants on public.viewings
  for select to authenticated
  using (auth.uid() in (proposer_id, invitee_id));

-- geen insert-, update- of delete-policy: schrijven kan uitsluitend via de RPC's
revoke all on public.viewings from anon, authenticated;
grant select on public.viewings to authenticated;
```

Dezelfde keuze als bij `mark_conversation_read`: zonder UPDATE-policy kan een
client de status niet zelf omzetten, ook niet met een gemanipuleerd verzoek.

---

## 3. RPC's

Alle functies `security definer`, `set search_path = public, pg_temp`,
`grant execute ... to authenticated`.

### 3.1 propose_viewing

```sql
create or replace function public.propose_viewing(
  p_conversation_id uuid,
  p_slots           timestamptz[],
  p_note            text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_conv        conversations;
  v_invitee     uuid;
  v_id          uuid;
  v_msg_id      uuid;
  v_body        text;
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

  -- een nieuw voorstel vervangt het openstaande voorstel in dit gesprek
  update viewings set status = 'cancelled', cancelled_by = auth.uid(),
         cancel_reason = 'superseded'
   where conversation_id = p_conversation_id and status = 'proposed';

  insert into viewings (conversation_id, listing_id, proposer_id, invitee_id,
                        slots, note)
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
```

Let op: berichtteksten zijn Engels — de site is Engels en dezelfde tekst gaat
de meldingsmail in. `to_char(..., 'Dy DD Mon')` levert Engelse afkortingen zolang
`lc_time` op `C`/`en_US` staat; controleer dat op de database.

### 3.2 respond_viewing

`p_slot = null` betekent afwijzen ("geen van deze tijden past").

```sql
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
```

### 3.3 cancel_viewing

```sql
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
          'Viewing cancelled' ||
          coalesce(' — ' || nullif(btrim(p_reason), ''), ''), v.id);
end $$;
```

Opnieuw plannen is geen aparte RPC: `propose_viewing` op hetzelfde gesprek
vervangt het openstaande voorstel.

### 3.4 Grants

```sql
grant execute on function public.propose_viewing(uuid, timestamptz[], text) to authenticated;
grant execute on function public.respond_viewing(uuid, timestamptz)         to authenticated;
grant execute on function public.cancel_viewing(uuid, text)                 to authenticated;
revoke execute on all functions in schema public from anon;
```

---

## 4. Lezen — view voor thread en dashboard

```sql
create view public.my_viewings
with (security_invoker = true) as
select v.id, v.conversation_id, v.listing_id, v.status, v.slots, v.chosen_slot,
       v.note, v.message_id, v.created_at, v.responded_at,
       (v.proposer_id = auth.uid())              as i_proposed,
       case when v.proposer_id = auth.uid() then v.invitee_id
            else v.proposer_id end               as other_id,
       l.title  as listing_title,
       l.price  as listing_price,
       l.kind   as listing_kind
  from public.viewings v
  join public.listings l on l.id = v.listing_id
 where auth.uid() in (v.proposer_id, v.invitee_id);

grant select on public.my_viewings to authenticated;
```

`security_invoker = true` is essentieel: zonder dat draait de view met de
rechten van de eigenaar en omzeilt hij RLS.

Dashboardteller (één call, geen rijen over de lijn):

```sql
create or replace function public.count_upcoming_viewings() returns integer
language sql security definer set search_path = public, pg_temp as $$
  select count(*)::int from viewings
   where auth.uid() in (proposer_id, invitee_id)
     and status = 'confirmed' and chosen_slot > now();
$$;
grant execute on function public.count_upcoming_viewings() to authenticated;
```

---

## 5. E-mail en herinneringen

De meldingsmail per bericht bestaat al (trigger op `messages`). Omdat elke RPC
een bericht schrijft, krijgt de tegenpartij automatisch mail bij voorstellen,
bevestigen, afwijzen en annuleren. **Geen nieuwe mailtrigger nodig** — mits de
bestaande trigger de body meestuurt. Controleer dat de mailtekst leesbaar is
voor de nieuwe berichten.

### Herinneringen: geen berichtrij

Besluit 20-08-2026: een reminder wordt **niet** in `messages` ingevoegd.

De bestaande trigger verhoogt `buyer_unread`/`seller_unread` bij elke insert.
Een reminder zou dus een ongelezen-badge opleveren zonder dat er iemand iets
geschreven heeft — de badge gaat liegen, en dat weegt zwaarder dan het gemak
van een regel in de thread. Een reminder heeft bovendien geen afzender en geen
tegenpartij; precies daarom past `sender_id` er niet op. Een nep-serviceaccount
in `conversation_people` of een nullable `sender_id` zijn beide afgeraden.

In plaats daarvan:

- cron stuurt de mail **direct aan beide partijen**, buiten `messages` om;
- thread en dashboard renderen de herinnering client-side uit de
  bezichtigingsrij (`chosen_slot`, `reminded_24h_at`, `reminded_2h_at`) als een
  rustige systeemregel zonder ongelezen-status;
- `messages` blijft precies wat het is: door mensen getypte tekst plus de vier
  statusregels die een mens veroorzaakte (voorstel, bevestiging, afwijzing,
  annulering).

```sql
create or replace function public.run_viewing_reminders() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- T-24u
  perform public.send_viewing_reminder_mail(v.id, '24h')
     from public.viewings v
    where v.status = 'confirmed' and v.reminded_24h_at is null
      and v.chosen_slot between now() and now() + interval '24 hours';

  update public.viewings set reminded_24h_at = now()
   where status = 'confirmed' and reminded_24h_at is null
     and chosen_slot between now() and now() + interval '24 hours';

  -- T-2u
  perform public.send_viewing_reminder_mail(v.id, '2h')
     from public.viewings v
    where v.status = 'confirmed' and v.reminded_2h_at is null
      and v.chosen_slot between now() and now() + interval '2 hours';

  update public.viewings set reminded_2h_at = now()
   where status = 'confirmed' and reminded_2h_at is null
     and chosen_slot between now() and now() + interval '2 hours';

  -- afgelopen bezichtigingen afsluiten
  update public.viewings set status = 'completed'
   where status = 'confirmed' and chosen_slot < now() - interval '2 hours';
end $$;

select cron.schedule('viewing-reminders', '*/15 * * * *',
                     $$select public.run_viewing_reminders()$$);
```

`send_viewing_reminder_mail(viewing_id, phase)` moet hetzelfde mailkanaal
gebruiken als de bestaande berichtentrigger — vul die functie in nadat je hebt
vastgesteld hoe die trigger mail verstuurt (queue-tabel, `net.http_post`, of een
Edge Function). Beide partijen zijn ontvanger: `proposer_id` én `invitee_id`.

Als je later tóch één chronologische bron wilt en de herinnering als echte rij in
de thread hoort, is de juiste vorm `messages.kind text not null default 'user'`
met `check (kind in ('user','system'))`, en de unread-trigger die `system`
overslaat. Eén kolom, één `if` — dat lost het tellerprobleem structureel op in
plaats van het te verplaatsen.

### Voorwaarde

`pg_cron` draait op de database (bevestigd 20-08-2026), dus dit deel kan zonder
voorbehoud uitgevoerd worden. Controleer na het inschedulen éénmalig
`select * from cron.job` en na een kwartier `cron.job_run_details` op fouten —
een falende cron-taak is stil.

---

## 6. Realtime

```sql
alter publication supabase_realtime add table public.viewings;
```

De client abonneert per gesprek, net als bij messages:
`filter: 'conversation_id=eq.<id>'` op `event: '*'`. Zo verschijnt een
bevestiging bij de tegenpartij zonder herladen, en filtert de server in plaats
van de browser.

---

## 7. Wat de client nodig heeft (`supabase.js`)

Nieuwe functies, zelfde stijl als de bestaande messaging-laag:

```js
proposeViewing(conversationId, slotsIso, note)   // -> viewingId   (RPC propose_viewing)
respondToViewing(viewingId, slotIso /* of null */) //              (RPC respond_viewing)
cancelViewing(viewingId, reason)                 //                (RPC cancel_viewing)
fetchViewingsForConversation(conversationId)     // my_viewings, op conversation_id
fetchUpcomingViewings()                          // my_viewings, confirmed + toekomst
countUpcomingViewings()                          // RPC count_upcoming_viewings
subscribeToViewings(conversationId, onChange)    // realtime, gefilterd
```

Wijzigingen in bestaande code:

1. `fetchMessages` selecteert ook `viewing_id`.
2. `messages.html` rendert een bericht met `viewing_id` als kaart met de stand
   uit `viewings`; de tekstinhoud is alleen fallback.
3. Het huidige `[[mk:v1|…]]`-formaat blijft één release **alleen-lezen** in de
   parser staan, zodat bestaande afspraken niet uit de threads verdwijnen.
   Nieuwe voorstellen gaan uitsluitend via de RPC. Daarna mag `vwParse`/`vwTag` weg.
4. `dashboard.html` krijgt een teller "bezichtigingen deze week" uit
   `count_upcoming_viewings()` en eventueel een lijst uit `fetchUpcomingViewings()`.

5. `fetchViewingsForConversation` levert ook `reminded_24h_at`/`reminded_2h_at`;
   de client rendert daaruit de herinneringsregel — er is geen berichtrij voor.

## 8. Migratie van bestaande afspraken

Optioneel, alleen als er al tag-berichten in productie staan:

```sql
-- eenmalige backfill: bevestigde afspraken uit de berichttekst halen
-- (handmatig controleren; de tag bevat labels, geen timestamps met zone)
select id, conversation_id, sender_id, body
  from public.messages
 where body like '%[[mk:v1|%'
 order by created_at;
```

De labels in oude tags zijn weergavetekst (`Sat 23 Aug · 10:00`) zonder jaar en
zonder zone — automatisch omzetten naar `timestamptz` is niet betrouwbaar. Advies:
niet backfillen, oude threads blijven leesbaar via de fallback-parser.

---

## Checklist bij uitvoeren

- [ ] type, tabel, indexen, `messages.viewing_id`
- [ ] RLS aan, alleen select-policy, grants ingetrokken
- [ ] drie RPC's + grants, getest met twee accounts (huurder en verhuurder)
- [ ] negatieve tests: derde account kan niets zien of wijzigen; slot in het
      verleden geweigerd; tweede voorstel vervangt het eerste; invitee kan
      niet zijn eigen voorstel bevestigen
- [ ] `my_viewings` met `security_invoker`, teller-RPC
- [ ] realtime-publicatie
- [ ] cron-taak + `send_viewing_reminder_mail` op het bestaande mailkanaal
- [ ] `cron.job_run_details` nagekeken na de eerste kwartierslag
- [ ] client: `supabase.js`, `messages.html`, `dashboard.html`
