/* Verbindingsproef, alleen lezen: stat op index.html in de MyKunda-map.
   Er wordt niets verstuurd en niets gewijzigd. Sessienaam als argument. */
import { existsSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const sessie = process.argv[2] || 'mykunda-sftp';
const paden = [
  process.env.SystemDrive + '\\Program Files (x86)\\WinSCP\\WinSCP.com',
  process.env.SystemDrive + '\\Program Files\\WinSCP\\WinSCP.com',
  process.env.LOCALAPPDATA + '\\Programs\\WinSCP\\WinSCP.com'
];
const exe = paden.find(existsSync);
if (!exe) { console.error('WinSCP.com niet gevonden'); process.exit(1); }

const scriptPad = '_werk/_sftp-test.txt';
writeFileSync(scriptPad, [
  'option batch abort',
  'option confirm off',
  `open "${sessie}"`,
  'stat "/var/www/vhosts/gamgrowth.com/mykunda.com/index.html"',
  'close',
  'exit', ''
].join('\r\n'));

console.log('WinSCP: ' + exe + '\nsessie: ' + sessie + '\n');
try {
  console.log(execFileSync(exe, ['/loglevel=0', '/script=' + scriptPad], { encoding: 'utf8', timeout: 90000 }));
  console.log('VERBINDING GELUKT met sessie "' + sessie + '"');
} catch (e) {
  console.log((e.stdout || '') + (e.stderr || ''));
  console.log('MISLUKT met sessie "' + sessie + '" (code ' + e.status + ')');
  process.exit(1);
}
