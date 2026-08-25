-- ============================================================
--  MyKunda — WhatsApp as a lead source
--  wa-inbound writes inbound WhatsApp messages into `leads` with
--  source 'whatsapp_inbound'. Without this value in the enum the
--  insert fails and the message is only kept in the function log.
--  (The function falls back to 'contact' until this has run.)
--
--  Run once in the Supabase SQL editor.
-- ============================================================
alter type lead_source add value if not exists 'whatsapp_inbound';

-- Verify — expect eight labels, including whatsapp_inbound.
select enumlabel from pg_enum
 where enumtypid = 'lead_source'::regtype
 order by enumsortorder;
