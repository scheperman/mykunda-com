-- 03-09-2026: de WhatsApp-knop op property.html leidt naar de aanbieder.
-- De aanbieder kiest per advertentie of zijn nummer daarvoor gebruikt mag
-- worden; standaard aan, want dat is waarvoor hij het opgeeft. Uit = de knop
-- verdwijnt en er blijft alleen het gesprek in My MyKunda over.
alter table public.listings
  add column if not exists show_whatsapp boolean not null default true;
comment on column public.listings.show_whatsapp is
  'Aanbieder staat toe dat kopers hem via WhatsApp (contact_phone, of agencies.whatsapp/phone bij een kantoor) rechtstreeks benaderen vanaf de objectpagina. Standaard true.';
