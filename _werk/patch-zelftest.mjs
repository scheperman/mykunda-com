import { readFileSync, writeFileSync } from 'node:fs';
let t = readFileSync('upload.bat', 'utf8');
const a = '  set "ST_CACHE=ok"\r\n  set "ST_GIT=ok - vastgelegd en gepusht"';
const b = '  if /i "%~2"=="fout" set "ST_CACHE=MOET MET DE HAND - zie hierboven"';
if (t.includes('  set "ST_INDEX=ok - aangemeld bij IndexNow"\r\n  set "ST_GIT=')) { console.log('zelftest stond er al'); process.exit(0); }
if (!t.includes(a) || !t.includes(b)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
t = t.replace(a, '  set "ST_CACHE=ok"\r\n  set "ST_INDEX=ok - aangemeld bij IndexNow"\r\n  set "ST_GIT=ok - vastgelegd en gepusht"');
t = t.replace(b, b + '\r\n  if /i "%~2"=="fout" set "ST_INDEX=MISLUKT - antwoordcode 403"');
writeFileSync('upload.bat', t);
const crlf = (t.match(/\r\n/g) || []).length, lf = t.split('\n').length - 1;
console.log('zelftest bijgewerkt; crlf ' + crlf + ' lf ' + lf + (crlf === lf ? ' (gelijk, goed)' : ' (WIJKT AF!)'));
