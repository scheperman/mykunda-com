-- 03-09-2026: supplier_by_phone() herkent ook een lokaal opgegeven nummer
-- (7 cijfers, zonder 220) tegenover het internationale nummer dat Meta stuurt,
-- en weigert een lege invoer. Zelfde functie als in 20260903_04, één regel meer.
create or replace function public.supplier_by_phone(p_digits text)
returns uuid
language sql
stable
as $$
  with d as (
    select regexp_replace(coalesce(p_digits, ''), '\D', '', 'g') as full,
           regexp_replace(regexp_replace(coalesce(p_digits, ''), '\D', '', 'g'), '^220', '') as local
  ),
  nums as (
    select p.id as user_id, regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') as n
      from public.profiles p
     where p.role in ('seller', 'agent', 'admin') and p.phone is not null
    union all
    select l.owner_id, regexp_replace(coalesce(l.contact_phone, ''), '\D', '', 'g')
      from public.listings l
     where l.contact_phone is not null
  )
  select nums.user_id
    from nums, d
   where nums.n <> '' and d.local <> ''
     and (nums.n = d.full or nums.n = d.local or nums.n = ('220' || d.local) or ('220' || nums.n) = d.full)
   limit 1;
$$;
revoke execute on function public.supplier_by_phone(text) from public, anon, authenticated;
