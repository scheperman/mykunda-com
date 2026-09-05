/* Eenmalige patch 05-09-2026: hoofdletter-URL's 301 in plaats van 404.
   Zet markers in .htaccess en de generatiestap in build.mjs. Idempotent. */
import { readFileSync, writeFileSync } from 'node:fs';

const nl = s => (s.match(/\r\n/g) || []).length > (s.split('\n').length / 2) ? '\r\n' : '\n';

/* ---- 1. markers in .htaccess ---- */
let ht = readFileSync('.htaccess', 'utf8');
const E = nl(ht);
if (ht.includes('# BEGIN mk-case-redirects')) {
  console.log('.htaccess: markers stonden er al');
} else {
  const anchor = 'RewriteRule ^home\\.html$            /                        [R=301,L]';
  if (!ht.includes(anchor)) { console.error('.htaccess: ankerregel niet gevonden - NIETS gewijzigd'); process.exit(1); }
  const block = [
    '',
    '# Hoofdletter-URL\'s van een oudere build. Google kent er een flink aantal',
    '# (/Bijilo.html haalde 132 vertoningen, meer dan /bijilo.html) en die gaven tot',
    '# 05-09-2026 een 404: het vangnet hieronder is mod_speling, en LiteSpeed heeft',
    '# die module niet. build.mjs schrijft daarom zelf een regel per geuploade pagina.',
    '# De RewriteCond eist een hoofdletter in het pad, zodat de goede kleine-letter-URL',
    '# nooit naar zichzelf omleidt.',
    '# BEGIN mk-case-redirects',
    '# END mk-case-redirects',
    ''
  ].join(E);
  ht = ht.replace(anchor, anchor + E + block);
  writeFileSync('.htaccess', ht);
  console.log('.htaccess: markers geplaatst');
}

/* ---- 2. generatiestap in build.mjs ---- */
let bm = readFileSync('build.mjs', 'utf8');
const B = nl(bm);
if (bm.includes('mk-case-redirects')) {
  console.log('build.mjs: stap stond er al');
} else {
  const anchor2 = '/* Mirror into deploy/ */';
  if (!bm.includes(anchor2)) { console.error('build.mjs: ankerregel niet gevonden - NIETS gewijzigd'); process.exit(1); }
  const step = [
    '/* ---------------- hoofdletter-URL\'s: 301 in plaats van 404 (05-09-2026) ------',
    ' *',
    ' * Google kent van een oudere build URL\'s met een hoofdletter; /Bijilo.html haalde',
    ' * over 18-06 t/m 03-09-2026 132 vertoningen, meer dan /bijilo.html met 59, en gaf',
    ' * een 404. Het vangnet in .htaccess was mod_speling (CheckCaseOnly), maar de server',
    ' * draait LiteSpeed en heeft die module niet: alleen de met de hand opgesomde namen',
    ' * werkten, de 46 gebiedspagina\'s en 13 gidsen niet. Daarom schrijft de build zelf',
    ' * een regel per geuploade pagina, tussen twee markers in .htaccess. De RewriteCond',
    ' * eist een hoofdletter in het pad, zodat de al goede kleine-letter-URL nooit naar',
    ' * zichzelf omleidt - geen lus. Nieuwe pagina\'s liften vanzelf mee. */',
    '{',
    '  const CASE_START = \'# BEGIN mk-case-redirects\';',
    '  const CASE_END = \'# END mk-case-redirects\';',
    '  const ht = await readFile(\'.htaccess\', \'utf8\');',
    '  const i = ht.indexOf(CASE_START), j = ht.indexOf(CASE_END);',
    '  if (i < 0 || j < 0) {',
    '    console.log(\'LET OP: de markers mk-case-redirects ontbreken in .htaccess - hoofdletter-redirects niet bijgewerkt\');',
    '  } else {',
    '    const rules = [];',
    '    for (const f of pages.filter(p => !NOT_UPLOADED.has(p)).sort()) {',
    '      if (f !== f.toLowerCase()) { console.log(`LET OP: ${f} heeft zelf een hoofdletter - geen case-redirect gemaakt`); continue; }',
    '      rules.push(`RewriteCond %{REQUEST_URI} [A-Z]\\nRewriteRule ^${f.replace(/\\./g, \'\\\\.\')}$ /${f} [R=301,L,NC]`);',
    '    }',
    '    const block = `${CASE_START} (${rules.length} pagina\'s, gegenereerd door build.mjs - niet met de hand wijzigen)\\n`',
    '      + rules.join(\'\\n\') + \'\\n\' + CASE_END;',
    '    await writeIfChanged(\'.htaccess\', ht.slice(0, i) + block + ht.slice(j + CASE_END.length));',
    '    console.log(`case      ${rules.length} hoofdletter-redirects in .htaccess`);',
    '  }',
    '}',
    '',
    anchor2
  ].join(B);
  bm = bm.replace(anchor2, step);
  writeFileSync('build.mjs', bm);
  console.log('build.mjs: generatiestap toegevoegd');
}
