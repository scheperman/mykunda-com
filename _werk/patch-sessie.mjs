/* 05-09-2026: mykunda-sftp weigerde opnieuw (Password authentication failed, gebruiker
   ycjoswsp). gamgrowth-sftp komt op dezelfde server bij dezelfde gebruiker uit en werkt
   wel - nagemeten met een stat op de MyKunda-index.html. CLAUDE.md noemt dit al als de
   terugval. EXTERN blijft de MyKunda-map; upload.bat controleert die zelf. */
import { readFileSync, writeFileSync } from 'node:fs';
let t = readFileSync('upload.bat', 'utf8');
const oud = 'set "SESSIE=mykunda-sftp"';
if (t.includes('set "SESSIE=gamgrowth-sftp"')) { console.log('stond er al'); process.exit(0); }
if (!t.includes(oud)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const nieuw = [
  'rem          05-09-2026: mykunda-sftp weigerde weer (Password authentication',
  'rem          failed voor ycjoswsp), net als op 04-09. gamgrowth-sftp komt op',
  'rem          dezelfde server bij dezelfde gebruiker uit en werkt wel; nagemeten',
  'rem          met een stat op de MyKunda-index.html. Daarom staat die hier nu.',
  'rem          EXTERN blijft de MyKunda-map - het script controleert dat zelf.',
  'rem          Repareer je ooit het wachtwoord van mykunda-sftp, zet die naam dan',
  'rem          gerust terug; allebei werken ze.',
  'set "SESSIE=gamgrowth-sftp"'
].join('\r\n');
t = t.replace(oud, nieuw);
writeFileSync('upload.bat', t);
const crlf = (t.match(/\r\n/g) || []).length, lf = t.split('\n').length - 1;
console.log('upload.bat: SESSIE -> gamgrowth-sftp; crlf ' + crlf + ' lf ' + lf + (crlf === lf ? ' (gelijk, goed)' : ' (WIJKT AF!)'));
