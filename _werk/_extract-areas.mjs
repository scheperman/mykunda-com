/* Eenmalig: haalt HOUSE, APT, LAND en AREA_LABELS uit sell.html en zet ze
   ongewijzigd in valuation-areas.js. Daarna mag dit bestand weg. */
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync('sell.html', 'utf8');
function grab(name) {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*(\\{[\\s\\S]*?\\});'));
  if (!m) throw new Error('niet gevonden: ' + name);
  return m[1];
}
const HOUSE = grab('HOUSE'), APT = grab('APT'), LAND = grab('LAND'), LAB = grab('AREA_LABELS');
const count = s => (s.match(/[,{]\s*'?[a-z][a-z0-9 ()']*'?\s*:/gi) || []).length;
const out = `/* ============================================================
   MyKunda - gebiedstarieven voor het waarderingsmodel
   ------------------------------------------------------------
   Alleen data. Het rekenwerk staat in valuation.js; deze tabel
   staat los zodat een tarief bijwerken nooit het model raakt.

   Overgenomen uit sell.html op 2026-08-26, byte voor byte.
   Dit zijn de OUDE tarieven, op portaalniveau. valuation.js legt
   daar per gebied de herijkte cijfers overheen (LAND_OBSERVED) en
   past voor de rest een zonefactor toe (LAND_ZONE). Deze tabel is
   dus de terugval, niet de waarheid.

   Bronnen zoals ze in sell.html stonden: Gamrealty 2026, Blue
   Ocean 2025, Realting, Songhai Properties, lokale listing-analyse
   juni 2026; herijkt augustus 2026 tegen plot-listings.
   ============================================================ */
(function (root) {
  'use strict';
  root.MK_RATES = {
    HOUSE: ${HOUSE},
    APT: ${APT},
    LAND: ${LAND},
    LABELS: ${LAB}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
writeFileSync('valuation-areas.js', out);
console.log('valuation-areas.js:', out.length, 'bytes');
console.log('gebieden - HOUSE:', count(HOUSE), 'APT:', count(APT), 'LAND:', count(LAND), 'LABELS:', count(LAB));
