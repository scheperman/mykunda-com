-- ============================================================
--  MyKunda — geef jezelf volledige backoffice-toegang
--  Plak dit in Supabase → SQL Editor → Run.
--
--  Vervang HIERONDER het e-mailadres door het adres waarmee je
--  op mykunda.com bent ingelogd. Dat is het enige wat je hoeft
--  aan te passen.
-- ============================================================

-- ---------- 0 · wie bestaat er eigenlijk? ----------
-- Draai dit eerst apart als je niet zeker weet welk adres je gebruikte.
-- Het toont elke geregistreerde gebruiker en zijn huidige rol.
select u.email,
       u.created_at,
       u.email_confirmed_at,
       coalesce(p.role::text, '— GEEN PROFIELRIJ —') as rol
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;


-- ---------- 1 · maak jezelf admin ----------
do $$
declare
  target_email text := 'info@mykunda.com';   -- <<< PAS DIT AAN
  uid uuid;
begin
  select id into uid from auth.users
   where lower(email) = lower(target_email)
   limit 1;

  if uid is null then
    raise exception 'Geen gebruiker met e-mail %. Registreer eerst op mykunda.com/auth.html, bevestig de mail, en draai dit daarna opnieuw.', target_email;
  end if;

  -- Profielrij aanmaken als die ontbreekt (accounts van vóór de trigger
  -- hebben er geen — dan lijkt alles leeg, ook al ben je ingelogd).
  insert into public.profiles (id, email, role)
  values (uid, target_email, 'admin')
  on conflict (id) do update
    set role  = 'admin',
        email = coalesce(public.profiles.email, excluded.email);

  raise notice 'OK — % is nu admin (id %)', target_email, uid;
end $$;


-- ---------- 2 · controleer het resultaat ----------
-- Moet één rij geven met role = admin.
select p.id, p.email, p.role, p.full_name
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'admin';


-- ---------- 3 · controleer dat de admin-helper werkt ----------
-- Alle RLS-policies van de backoffice hangen aan deze functie.
-- Dit moet 'true' teruggeven als je zelf ingelogd bent via de app;
-- in de SQL Editor draai je als service-role, dus daar is 'false'
-- normaal — deze query controleert alleen dát de functie bestaat.
select exists (
  select 1 from pg_proc pr
  join pg_namespace n on n.oid = pr.pronamespace
  where n.nspname = 'public' and pr.proname = 'is_admin'
) as is_admin_functie_bestaat;


-- ============================================================
--  NA HET DRAAIEN
--  1. Log uit op de site (belangrijk — de adminvlag wordt in de
--     browser gecachet en verdwijnt pas bij uitloggen).
--  2. Log weer in.
--  3. De Admin-knop verschijnt in de header en de vier secties
--     van de console tonen data.
-- ============================================================
