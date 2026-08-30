-- ============================================================================
--  MyKunda — viewings_legacy_v0 buiten gebruik stellen        (30-08-2026)
--
--  Er liepen twee bezichtigingssystemen naast elkaar. Het formulier op
--  property.html schreef naar `viewings_legacy_v0`; de chat, de bevestiging,
--  de afwijzing, de annulering en de twee herinneringen werken allemaal op
--  `viewings`. Het dashboard werkte de oude rij bij en riep daarna
--  notify-viewing aan met een id dat in `viewings` niet bestaat: het scherm
--  zei "the buyer has been emailed" en er ging niets weg.
--
--  Wat er nu gebeurt:
--   · ingelogde bezoeker  -> requestViewingAsUser() maakt een conversatie en
--                            een voorstel in `viewings` (propose_viewing)
--   · anonieme bezoeker   -> een lead met source 'viewing'; de eigenaar ziet
--                            hem sinds de policy "leads owner read"
--
--  De tabel zelf blijft staan (leeg, en een drop is niet terug te draaien);
--  alleen de schrijfrechten gaan eraf, zodat er niets nieuws in kan landen.
-- ============================================================================

drop policy if exists "viewings insert anyone" on public.viewings_legacy_v0;
drop policy if exists "viewings party update" on public.viewings_legacy_v0;

comment on table public.viewings_legacy_v0 is
  'AFGEDANKT op 30-08-2026 en leeg. De bezichtigingen lopen volledig via public.viewings. Deze tabel heeft geen schrijfregels meer en wordt door geen enkele pagina of function nog gelezen; hij staat er alleen nog om niets onomkeerbaar weg te gooien. Mag verwijderd worden zodra duidelijk is dat er niets naar terugvalt.';

comment on table public.viewings is
  'Bezichtigingen. Hangt aan een gesprek (conversations) en dus aan twee accounts. Schrijven gaat uitsluitend via propose_viewing(), respond_viewing() en cancel_viewing(); die zijn SECURITY DEFINER en controleren zelf of de aanroeper deelnemer is, daarom heeft de tabel bewust alleen een SELECT-policy. Een bezichtigingsverzoek van een bezoeker zonder account wordt geen rij hier maar een lead met source ''viewing''.';
