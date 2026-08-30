-- Fase 1 — de rolkeuze van het aanmeldscherm overnemen.
-- Toegepast op jejaerpqltqryqzjvbjp op 30-08-2026.
--
-- auth-email zet de gekozen rol in de signup-metadata (options.data.role bij
-- admin.generateLink type 'signup'). Die metadata belandt in
-- auth.users.raw_user_meta_data en werd hier tot nu toe alleen gelezen voor
-- full_name, phone en de consent-velden; de rol viel daardoor altijd terug op
-- de kolomstandaard 'buyer'.
--
-- De witte lijst staat hier bewust nog een keer, naast die in de edge function:
-- dit is de laatste poort voor de kolom. Alles wat niet letterlijk 'seller' of
-- 'agent' is -- dus ook 'admin', een typefout of een lege waarde -- wordt
-- 'buyer'. Een rol toekennen kan hiermee nooit rechten opleveren die de
-- gebruiker niet hoort te hebben: is_admin() leest deze kolom, en 'admin'
-- komt er langs deze weg niet in.
--
-- De kolomrechten blijven ongemoeid: authenticated mag profiles.role nog
-- steeds niet updaten. De rol wordt alleen hier gezet (bij aanmaak) en door de
-- edge function set-role (bij wisselen, met de JWT van de gebruiker zelf).
--
-- Nagemeten met zes proefaanmeldingen in een transactie met rollback:
-- buyer/seller/agent komen door, 'admin' wordt buyer, rommel wordt buyer, en
-- een aanmelding zonder rol (Google) wordt buyer. Daarna live nagemeten met
-- twee echte proefaccounts, die daarna zijn verwijderd.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (
    id, email, full_name, phone, role,
    consent_contact, consent_marketing, consent_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone',
    case new.raw_user_meta_data->>'role'
      when 'seller' then 'seller'::user_role
      when 'agent'  then 'agent'::user_role
      else 'buyer'::user_role
    end,
    coalesce((new.raw_user_meta_data->>'consent_contact')::boolean, false),
    coalesce((new.raw_user_meta_data->>'consent_marketing')::boolean, false),
    case
      when coalesce((new.raw_user_meta_data->>'consent_contact')::boolean, false)
      then now()
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
