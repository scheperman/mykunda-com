-- ============================================================
--  MARKTINDEX — 12 MAANDEN HISTORIE
--  Draai NA backend/market-index.sql en backend/market-sources.sql.
--  Veilig om opnieuw te draaien (upsert).
--
--  Wat hier WEL in kan en wat NIET
--    WEL   de officiele reeksen (CPI, beleidsrente, wisselkoers) —
--          die zijn gepubliceerd, dus achteraf op te halen.
--    WEL   je eigen listings — die staan al in listing_price_events,
--          rebuild_market_index() rekent ze gewoon terug.
--    WEL   makelaarslijsten en notariscijfers — via de CSV onderaan.
--    NIET  historische listings van portals. Een scraper ziet alleen
--          wat er vandaag staat; GamRealty en Realigro hebben geen
--          archief. Die bronnen bouwen historie op vanaf de eerste run.
--
--  Regels met een echte bron staan hieronder ingevuld. Regels met
--  TODO zijn NIET geschat — vul ze uit de GBoS-publicatie en verwijder
--  het commentaarteken. Een ontbrekende maand is geen probleem: de
--  console interpoleert tussen de maanden die er wel zijn.
-- ============================================================

-- ---------- 1 · CPI, alle bestedingen (2020M1 = 100) ----------
-- Bron: GBoS maandpublicatie, https://www.gbos.gov.gm/cpi.php
insert into public.market_macro (month, series, value, unit, source, source_url) values
  ('2025-12-01', 'cpi_all', 178.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-01-01', 'cpi_all', 178.77, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-02-01', 'cpi_all', 179.52, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- TODO uit de GBoS-publicatie, zelfde vorm:
  -- ,('2025-09-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2025-10-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2025-11-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2026-03-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2026-04-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2026-05-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2026-06-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
  -- ,('2026-07-01', 'cpi_all', 000.00, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
on conflict (month, series) do update
  set value = excluded.value, source = excluded.source,
      source_url = excluded.source_url, fetched_at = now();

-- ---------- 2 · CPI huisvesting, water, elektriciteit, gas ----------
-- De reeks waar de stippellijn op de marktpagina op staat.
insert into public.market_macro (month, series, value, unit, source, source_url) values
  ('2025-12-01', 'cpi_housing', 183.71, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-01-01', 'cpi_housing', 184.37, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-02-01', 'cpi_housing', 184.67, 'index 2020M1=100', 'GBoS', 'https://www.gbos.gov.gm/cpi.php')
on conflict (month, series) do update
  set value = excluded.value, source = excluded.source,
      source_url = excluded.source_url, fetched_at = now();

-- ---------- 3 · inflatie, jaar op jaar ----------
insert into public.market_macro (month, series, value, unit, source, source_url) values
  ('2025-12-01', 'inflation_yoy', 6.60, '%', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-01-01', 'inflation_yoy', 6.42, '%', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-02-01', 'inflation_yoy', 6.28, '%', 'GBoS', 'https://www.gbos.gov.gm/cpi.php'),
  ('2026-04-01', 'inflation_yoy', 7.00, '%', 'CBG MPC mei 2026', 'https://www.cbg.gm/policy-rate-decisions')
on conflict (month, series) do update
  set value = excluded.value, source = excluded.source,
      source_url = excluded.source_url, fetched_at = now();

-- ---------- 4 · beleidsrente (MPR) ----------
-- Stapfunctie: de MPC vergadert per kwartaal, de rente staat vast tot
-- het volgende besluit. Besluiten: dec 2025 verlaagd naar 16%,
-- 26 feb 2026 verlaagd naar 14%, 21 mei 2026 gehandhaafd op 14%.
-- Daarvoor stond hij op 17%. Februari staat op 16 omdat het besluit
-- pas op de 26e viel.
insert into public.market_macro (month, series, value, unit, source, source_url) values
  ('2025-09-01', 'policy_rate', 17.00, '%', 'CBG MPC', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2025-10-01', 'policy_rate', 17.00, '%', 'CBG MPC', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2025-11-01', 'policy_rate', 17.00, '%', 'CBG MPC', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2025-12-01', 'policy_rate', 16.00, '%', 'CBG MPC dec 2025', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-01-01', 'policy_rate', 16.00, '%', 'CBG MPC dec 2025', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-02-01', 'policy_rate', 16.00, '%', 'CBG MPC dec 2025', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-03-01', 'policy_rate', 14.00, '%', 'CBG MPC feb 2026', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-04-01', 'policy_rate', 14.00, '%', 'CBG MPC feb 2026', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-05-01', 'policy_rate', 14.00, '%', 'CBG MPC mei 2026', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-06-01', 'policy_rate', 14.00, '%', 'CBG MPC mei 2026', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-07-01', 'policy_rate', 14.00, '%', 'CBG MPC mei 2026', 'https://www.cbg.gm/policy-rate-decisions'),
  ('2026-08-01', 'policy_rate', 14.00, '%', 'CBG MPC mei 2026', 'https://www.cbg.gm/policy-rate-decisions')
on conflict (month, series) do update
  set value = excluded.value, source = excluded.source,
      source_url = excluded.source_url, fetched_at = now();

-- ---------- 5 · wisselkoers ----------
-- Dagelijkse waarderingskoersen CBG, stand 4 augustus 2026.
-- De edge function houdt dit vanaf nu vanzelf bij; oudere maanden
-- staan in de maandelijkse CBG-bulletins.
insert into public.market_macro (month, series, value, unit, source, source_url) values
  ('2026-08-01', 'usd_gmd', 71.99, 'GMD per USD', 'CBG', 'https://www.cbg.gm/'),
  ('2026-08-01', 'eur_gmd', 85.42, 'GMD per EUR', 'CBG', 'https://www.cbg.gm/'),
  ('2026-08-01', 'gbp_gmd', 97.04, 'GMD per GBP', 'CBG', 'https://www.cbg.gm/')
on conflict (month, series) do update
  set value = excluded.value, source = excluded.source,
      source_url = excluded.source_url, fetched_at = now();

-- ---------- 6 · bouwkosten ----------
-- Geen publieke feed. Vul zelf per maand aan, prijs per zak van 50 kg
-- in dalasi. Eén regel per maand, zelfde vorm:
-- insert into public.market_macro (month, series, value, unit, source)
-- values ('2026-08-01', 'cement_50kg', 425, 'GMD per zak', 'Eigen navraag')
-- on conflict (month, series) do update set value = excluded.value;

-- ---------- 7 · herbouw de index over 12 maanden ----------
select public.market_dedup();
select public.rebuild_market_index(12);

-- Controle: hoeveel maanden hebben nu een reele index?
select count(*) filter (where index_real_100 is not null) as met_reele_index,
       count(*)                                           as totaal
from public.market_snapshots
where segment_type = 'market';

-- ============================================================
--  8 · TRANSACTIES VAN BUITEN HANDMATIG INLEZEN
--  Dit is waar de echte winst zit: makelaarslijsten en notaris-
--  cijfers van de afgelopen 12 maanden. Zij tellen met gewicht
--  0.85 respectievelijk 0.95 mee — zwaarder dan welk portal ook.
--
--  Stap 1  Vul market-observations-template.csv (zit in dit pakket)
--          Kolommen: month, area, category, kind, price_usd, sqm, source, note
--          - month     eerste dag van de maand, 2026-03-01
--          - area      "Kololi · Kombo South" — gebied, spatie-punt-spatie, regio
--          - category  land | house | villa | apartment | townhouse | compound | commercial
--          - kind      sale | rent
--          - price_usd in dollars. Dalasi? Deel door de koers van die maand.
--          - sqm       perceel-m2 bij land, vloer-m2 bij bebouwd
--
--  Stap 2  Supabase Dashboard -> Table Editor -> market_observations
--          -> Insert -> Import data from CSV -> bestand kiezen.
--          (Of via de CLI: \copy public.market_observations
--           (month,area,category,kind,price_usd,sqm,source,note)
--           from 'market-observations.csv' with (format csv, header true);)
--
--  Stap 3  Draai daarna opnieuw:
--            select public.rebuild_market_index(12);
--          Of druk op "Recalculate now" op market.html — dat doet hetzelfde.
-- ============================================================
