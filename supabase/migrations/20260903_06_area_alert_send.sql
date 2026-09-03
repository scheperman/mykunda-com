-- ============================================================
--  MyKunda — area alerts versturen (03-09-2026)
--
--  Tot vandaag schreven 52 gebiedspagina's een lead met source
--  'area_alert' weg en zei de auto-reply "you will hear from us
--  first" — maar geen enkele functie of cron las die leads daarna nog.
--  De belofte stond op de site, de machine erachter niet.
--
--  Dit bestand geeft leads de drie dingen die saved_searches al had:
--    · last_alert_at      — waterlijn: wat is "nieuw" voor deze alert
--    · alert_active       — de afmeldschakelaar (één klik in de mail)
--    · unsubscribe_token  — het geheim in de afmeldlink, per lead
--
--  Verzenden gebeurt door notify-saved-search (stap 5, dezelfde run om
--  08:00 via run_saved_search_alerts()); afmelden door unsubscribe met
--  k=area. Geen nieuwe cron, geen nieuwe functie, geen GRANT: alle
--  lezers/schrijvers gebruiken de service-rol.
--
--  Dedupe op adres+gebied gebeurt bewust in de functie en niet met een
--  unieke index: een tweede inschrijving moet op de pagina "Subscribed"
--  blijven zeggen, niet "That didn't save".
-- ============================================================

alter table public.leads
  add column if not exists last_alert_at     timestamptz,
  add column if not exists alert_active      boolean not null default true,
  add column if not exists unsubscribe_token uuid    not null default gen_random_uuid();

comment on column public.leads.last_alert_at is
  'Area alerts: moment van de laatste alertmail over dit gebied aan dit adres. Leeg = nog nooit gemaild; dan geldt created_at als waterlijn.';
comment on column public.leads.alert_active is
  'Area alerts: false na afmelden via de link in de mail (unsubscribe?k=area). Geldt per adres: afmelden zet alle area_alert-leads van dat adres uit.';
comment on column public.leads.unsubscribe_token is
  'Geheim in de afmeldlink van de area-alertmail. Alleen te lezen door de service-rol; nooit in een publieke API zetten.';

create index if not exists leads_area_alert_active_idx
  on public.leads (lower(email), area)
  where source = 'area_alert' and alert_active;

create unique index if not exists leads_unsubscribe_token_key
  on public.leads (unsubscribe_token);
