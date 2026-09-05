import { readFileSync, writeFileSync } from 'node:fs';
let t = readFileSync('upload.bat', 'utf8');
if (t.includes('del "_werk\\indexnow.json"')) { console.log('upload.bat: stond er al'); process.exit(0); }
const a = 'if not "!INCODE!"=="200" if not "!INCODE!"=="202" set "PROBLEEM=1"';
if (!t.includes(a)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const nieuw = a + '\r\n'
  + 'rem  Aangenomen? Dan is de wachtrij leeg. Zo niet, dan blijft het bericht staan en\r\n'
  + 'rem  gaat het bij de volgende upload gewoon opnieuw mee - niets gaat verloren.\r\n'
  + 'if "!INCODE!"=="200" del "_werk\\indexnow.json" >nul 2>&1\r\n'
  + 'if "!INCODE!"=="202" del "_werk\\indexnow.json" >nul 2>&1';
t = t.replace(a, nieuw);
writeFileSync('upload.bat', t);
const crlf = (t.match(/\r\n/g) || []).length, lf = t.split('\n').length - 1;
console.log('upload.bat: wachtrij wordt geleegd na aanname; crlf ' + crlf + ' lf ' + lf + (crlf === lf ? ' (gelijk, goed)' : ' (WIJKT AF!)'));
