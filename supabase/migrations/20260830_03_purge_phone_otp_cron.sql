-- ============================================================
--  MyKunda — telefoonverificaties opruimen (30-08-2026)
--  Toegepast via de Supabase-MCP als migratie 'purge_phone_otp_cron'.
--
--  public.purge_phone_otp() bestond al en verwijdert rijen ouder dan een dag,
--  maar hij stond in geen enkele cron-job — gecontroleerd in cron.job: daar
--  draaiden alleen fx-rates, de market-taken, de bezichtigingsherinneringen en
--  het verlopen van bankoverschrijvingen. De bedoelde bewaartermijn van
--  phone_verifications was dus in de praktijk oneindig, en in die tabel staan
--  telefoonnummers.
-- ============================================================
select cron.schedule(
  'purge-phone-otp',
  '20 3 * * *',
  $$select public.purge_phone_otp()$$
);
