// ============================================================
//  MyKunda — de bankrekening, op één plek
//
//  WAAROM DIT BESTAND BESTAAT (30-08-2026)
//  Dezelfde rekening stond hardgecodeerd in twee edge functions:
//  create-payment (het scherm van de klant) en send-payment-instructions
//  (de mail met het rekeningnummer), met in beide een commentaarregel
//  "wijzigt de rekening, pas ze op BEIDE plekken aan". Dat is precies het
//  soort afspraak dat een keer misgaat — en er is geschiedenis: tussen
//  23-08-2026 en 25-08-2026 stond hier Ecobank, teruggedraaid op 25-08.
//  Een klant die naar het verkeerde nummer overmaakt is geld kwijt en
//  vertrouwen, en dat is niet met een deploy terug te draaien.
//
//  Wijzigt de rekening, dan wijzig je ALLEEN dit bestand en rol je
//  create-payment en send-payment-instructions opnieuw uit. De
//  provider-waarde die bij een bankoverschrijving in `payments` wordt
//  weggeschreven staat daar los van; zie CLAUDE.md.
//
//  De tenaamstelling staat twee keer in de brief "RE: BANKING RELATIONSHIP"
//  van Guaranty Trust en niet identiek: het dalasi-blok zegt "EDWIN
//  SCHEPERMAN T/A MY KUNDA.COM" (met spatie), het USD-correspondentblok
//  "EDWIN SCHEPERMAN T/A MYKUNDA.COM" (zonder). Hier staat de versie
//  ZONDER spatie — dat is de begunstigde die meegaat bij internationale
//  overboekingen, waar een afwijkende naam tot handmatige controle of
//  afwijzing leidt.
//
//  GTBGGMGMXXX is de elfcijferige vorm van GTBGGMGM (hoofdkantoor).
//  Sommige buitenlandse banken eisen elf tekens, dus beide staan erin.
//  Gambia kent geen IBAN — een klant die daarom gevraagd wordt, heeft
//  genoeg aan SWIFT plus rekeningnummer.
// ============================================================

export const BANK = {
  bank: "Guaranty Trust Bank (Gambia) Ltd",
  account_name: "EDWIN SCHEPERMAN T/A MYKUNDA.COM",
  account_number: "005201300100074795",
  currency: "GMD (Dalasi)",
  swift: "GTBGGMGM",
  swift_11: "GTBGGMGMXXX",
  branch: "Kairaba (branch code 201)",
  address: "56 Kairaba Avenue, Fajara, KSMD",
} as const;

// USD-correspondentgegevens uit dezelfde brief. Alleen nodig voor een
// overboeking in dollars vanuit het buitenland; bij een dalasi-betaling
// hoort de klant hier niets mee te doen.
export const USD = {
  intermediary_bank: "Guaranty Trust Bank (UK) Limited",
  intermediary_swift: "GTBIGB2L",
  beneficiary_bank: "Guaranty Trust Bank (Gambia) Limited",
  beneficiary_swift: "GTBGGMGM",
  beneficiary_bank_account: "901 10015 002 5033 000",
} as const;

/* create-payment gebruikte één plat object met usd_-velden ervoor. Deze
   vorm houdt die aanroep werkend zonder dat er een tweede waarheid ontstaat. */
export const BANK_DETAILS = {
  bank: BANK.bank,
  account_name: BANK.account_name,
  account_number: BANK.account_number,
  currency: "GMD",
  swift: BANK.swift,
  swift_11: BANK.swift_11,
  branch: BANK.branch,
  address: BANK.address,
  usd_intermediary_bank: USD.intermediary_bank,
  usd_intermediary_swift: USD.intermediary_swift,
  usd_beneficiary_bank: USD.beneficiary_bank,
  usd_beneficiary_swift: USD.beneficiary_swift,
  usd_beneficiary_bank_account: USD.beneficiary_bank_account,
} as const;
