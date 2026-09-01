/* amen-iconen.mjs — één icoon per categorie voor het blok "What's nearby".
 * Zelfde vorm als de bestaande iconen op de pagina's: 24x24, alleen lijn,
 * stroke-width 1.8, ronde uiteinden. Vóór 1 september 2026 werden de zes
 * iconen op volgorde uitgedeeld (amenIc[i % 6]), waardoor "3 Mosques" een
 * mes en vork kreeg. Een icoon dat het opschrift tegenspreekt is dezelfde
 * fout als een getal zonder bron, alleen kleiner.
 */
const svg = d => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>';

export const ICONEN = {
  health:      svg('<path d="M3 9h3l2-4 4 8 2-4h7"/>'),
  pharmacy:    svg('<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>'),
  market:      svg('<path d="M4 9h16l-1.5 11h-13zM8 9V6a4 4 0 0 1 8 0v3"/>'),
  supermarket: svg('<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 13h11l2-9H6"/>'),
  shop:        svg('<path d="M4 8h16l-1 12H5zM4 8l2-4h12l2 4M9 12v4M15 12v4"/>'),
  bank:        svg('<path d="M2 6h20v12H2z"/><circle cx="12" cy="12" r="3"/>'),
  atm:         svg('<path d="M2 7h20v11H2zM2 11h20M6 15h4"/>'),
  money:       svg('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  fuel:        svg('<path d="M4 21V4h10v17M3 21h13M7 8h4M17 21V10l-3-3"/>'),
  ferry:       svg('<path d="M3 18c2 1 3 1 5 0s3-1 5 0 3 1 5 0M5 18l-1-5h16l-1 5M8 13V8h8v5M12 8V5"/>'),
  transport:   svg('<path d="M4 5h16v10H4zM4 9h16M6 19v-2M18 19v-2"/><path d="M7 15h.01M17 15h.01"/>'),
  mosque:      svg('<path d="M18 4a8 8 0 1 0 0 16 7 7 0 0 1 0-16z"/>'),
  church:      svg('<path d="M12 3v18M8 8h8"/>'),
  worship:     svg('<path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6"/>'),
  eat:         svg('<path d="M6 3v7a2 2 0 0 0 4 0V3M8 11v10M17 3c-1.5 0-3 1.5-3 5s1.5 4 3 4v9"/>'),
  bar:         svg('<path d="M5 4h14l-7 8zM12 12v8M8 20h8"/>'),
  stay:        svg('<path d="M2 18v-9M2 13h14a4 4 0 0 1 4 4v1M2 18h20M6 9h3"/>'),
  police:      svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  post:        svg('<path d="M3 6h18v12H3zM3 7l9 6 9-6"/>'),
  gov:         svg('<path d="M4 21h16M6 21V10M10 21V10M14 21V10M18 21V10M3 10h18L12 4z"/>'),
  library:     svg('<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2zM4 18h15"/>'),
  reserve:     svg('<path d="M12 22v-7M12 15a5 5 0 0 0 5-5 5 5 0 0 0-1-3 4 4 0 0 0-8 0 5 5 0 0 0-1 3 5 5 0 0 0 5 5Z"/>'),
};
