-- MyKunda — handmatige koers-override, sitebreed
-- ---------------------------------------------------------------------
-- Tot 27-08-2026 stond de override in localStorage onder de sleutel
-- `mykunda_gmd_eur`. Die gold alleen in de browser waar hij was ingetypt,
-- terwijl rates.html hem aankondigde als de koers waarmee elke prijs op de
-- site wordt omgerekend. Een bezoeker in Serekunda zag hem nooit.
--
-- Deze tabel maakt de override wat hij hoorde te zijn: één rij, sitebreed,
-- zichtbaar in de database, met een reden erbij en een spoor van wie hem
-- zette. De fx-rates edge function leest hem bij elke GET.
--
-- De override zet de EUROkoers. De verhouding tot dollar en pond blijft
-- die van CBG; de function schaalt alle drie met dezelfde factor mee, zodat
-- één ingetypt getal niet stilletjes ook de USD/GMD-koers verzet.
--
-- Draaien: samen met de deploy van fx-rates. Vóór die deploy is de tabel
-- ongebruikt; ná de deploy zonder tabel werkt de Override-knop niet.

create table if not exists public.fx_override (
  id          uuid primary key default gen_random_uuid(),
  eur_gmd     numeric not null check (eur_gmd > 0),
  note        text,
  active      boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

comment on table public.fx_override is
  'Handmatige koers-override voor de hele site. Hoogste created_at met active=true wint; fx-rates leest hem bij elke GET. Zet active op false om terug te vallen op de CBG-koers.';
comment on column public.fx_override.eur_gmd is
  'Dalasi per 1 euro. USD en GBP schuiven met dezelfde factor mee, zodat de onderlinge verhoudingen van CBG blijven staan.';

-- Er kan er maar één tegelijk gelden. Een partiële unieke index maakt dat
-- hard, in plaats van erop te vertrouwen dat de admin het netjes doet.
create unique index if not exists fx_override_one_active
  on public.fx_override ((active)) where active;

create index if not exists fx_override_created_at_idx
  on public.fx_override (created_at desc);

alter table public.fx_override enable row level security;

-- Lezen mag iedereen: de koers staat toch al publiek in fx_rates en op het
-- scherm. Schrijven is uitsluitend admin — dit is de knop die elke prijs op
-- de site verzet.
drop policy if exists "fx override readable" on public.fx_override;
create policy "fx override readable"
  on public.fx_override for select
  using (true);

drop policy if exists "fx override admin write" on public.fx_override;
create policy "fx override admin write"
  on public.fx_override for all
  using (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'::user_role
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'::user_role
  ));
