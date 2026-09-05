/* Eenmalige patch 05-09-2026: IndexNow-stap in upload.bat. Houdt CRLF. Idempotent. */
import { readFileSync, writeFileSync } from 'node:fs';
const P = 'upload.bat';
let t = readFileSync(P, 'utf8');
const before = (t.match(/\r\n/g) || []).length;
if (t.includes(':indexnow')) { console.log('upload.bat: stap stond er al'); process.exit(0); }

const E = '\r\n';
const A = [
  ['set "ST_GIT=niet gedraaid"', 'ST_GIT-init'],
  ['echo   Cache geleegd. Binnen enkele seconden is de nieuwe versie live.', 'klaar-blok'],
  [':handmatig' + E + 'set "ST_CACHE=MOET MET DE HAND - zie hierboven"', 'handmatig-blok'],
  ['set "ST_CACHE=niet nodig"', 'nietstedoen-blok'],
  ['rem  Feitelijk, niet verzonnen: de datum en wat er daadwerkelijk klaarstaat.', 'subroutine-anker'],
  ['echo    4     Cloudflare-cache   !ST_CACHE!', 'uitslag-blok']
];
for (const [s, naam] of A) if (!t.includes(s)) { console.error('anker ontbreekt: ' + naam + ' - NIETS gewijzigd'); process.exit(1); }

/* 1. statusvariabele */
t = t.replace(A[0][0], 'set "ST_INDEX=niet gedraaid"' + E + A[0][0]);

/* 2. aanroepen na een geslaagde upload - ook als de cache met de hand moet */
t = t.replace(A[1][0], 'call :indexnow' + E + A[1][0]);
t = t.replace(A[2][0], ':handmatig' + E + 'call :indexnow' + E + 'set "ST_CACHE=MOET MET DE HAND - zie hierboven"');

/* 3. niets geupload = niets aan te melden */
t = t.replace(A[3][0], A[3][0] + E + 'set "ST_INDEX=niet nodig"');

/* 4. de subroutine zelf */
const sub = [
  'rem  IndexNow: Bing en Yandex meteen op de hoogte stellen van de pagina\'s die',
  'rem  echt zijn gewijzigd. build.mjs heeft het bericht al klaargezet in',
  'rem  _werk\\indexnow.json - met precies de URL\'s waarvan de lastmod vandaag is',
  'rem  bijgewerkt. Hier gaat het pas weg, NA een geslaagde upload: een URL aanmelden',
  'rem  die nog niet live staat levert een fout op. Geen bestand = niets gewijzigd =',
  'rem  niets te doen. De sleutel is geen geheim; hij hoort juist openbaar in de',
  'rem  webroot te staan, anders weigert IndexNow de aanmelding.',
  ':indexnow',
  'set "ST_INDEX=niets aan te melden"',
  'if not exist "_werk\\indexnow.json" goto :eof',
  'where curl.exe >nul 2>&1',
  'if errorlevel 1 (',
  '  set "ST_INDEX=overgeslagen - curl niet gevonden"',
  '  goto :eof',
  ')',
  'set "INCODE="',
  'for /f %%C in (\'curl -s -o "%TEMP%\\indexnow-mykunda.txt" -w "%%{http_code}" -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" --data-binary "@_werk\\indexnow.json"\') do set "INCODE=%%C"',
  'set "ST_INDEX=MISLUKT - antwoordcode !INCODE!"',
  'if "!INCODE!"=="200" set "ST_INDEX=ok - aangemeld bij IndexNow"',
  'if "!INCODE!"=="202" set "ST_INDEX=ok - in behandeling bij IndexNow"',
  'if not defined INCODE set "ST_INDEX=MISLUKT - curl gaf geen antwoord"',
  'if not "!INCODE!"=="200" if not "!INCODE!"=="202" set "PROBLEEM=1"',
  'if not "!INCODE!"=="200" if not "!INCODE!"=="202" (',
  '  echo.',
  '  echo   IndexNow weigerde de aanmelding. Antwoord:',
  '  if exist "%TEMP%\\indexnow-mykunda.txt" type "%TEMP%\\indexnow-mykunda.txt"',
  '  echo.',
  '  echo   Meestal staat het sleutelbestand nog niet op de server:',
  '  echo     https://mykunda.com/1a01e0ded2474955709f9b30fe339e29.txt',
  ')',
  'del "%TEMP%\\indexnow-mykunda.txt" >nul 2>&1',
  'goto :eof',
  '',
  ''
].join(E);
t = t.replace(A[4][0], sub + A[4][0]);

/* 5. regel in het uitslagblok */
t = t.replace(A[5][0], A[5][0] + E + 'echo    4b    IndexNow           !ST_INDEX!');

writeFileSync(P, t);
const after = (t.match(/\r\n/g) || []).length;
const lf = (t.split('\n').length - 1);
console.log('upload.bat: IndexNow-stap toegevoegd; crlf ' + before + ' -> ' + after + ', lf ' + lf + (after === lf ? ' (gelijk, goed)' : ' (WIJKT AF!)'));
