import { readFileSync, writeFileSync } from 'node:fs';
const P = 'CLAUDE.md';
let t = readFileSync(P, 'utf8');
if (t.includes('05-09-2026 staat `SESSIE`')) { console.log('stond er al'); process.exit(0); }
const E = (t.match(/\r\n/g) || []).length > 100 ? '\r\n' : '\n';
const anker = '### De sessie heet `mykunda-sftp`, en waarom niet `mykunda`';
if (!t.includes(anker)) { console.error('anker niet gevonden - NIETS gewijzigd'); process.exit(1); }
const blok = [
  anker,
  '',
  '**Sinds 05-09-2026 staat `SESSIE` in `upload.bat` op `gamgrowth-sftp`.** `mykunda-sftp`',
  'weigerde die dag opnieuw met `Password authentication failed` voor gebruiker',
  '`ycjoswsp` - hetzelfde als op 04-09. De server was gewoon bereikbaar en de hostsleutel',
  'klopte; alleen het opgeslagen wachtwoord in díé sessie is verouderd. `gamgrowth-sftp`',
  'komt op dezelfde server bij dezelfde gebruiker uit en werkt wel: nagemeten met een',
  '`stat` op `/var/www/vhosts/gamgrowth.com/mykunda.com/index.html`, en daarna gebruikt',
  'voor een geslaagde upload. `EXTERN` blijft de MyKunda-map, en het script controleert',
  'die map zelf voordat het iets verstuurt.',
  '',
  'Proefverbinding zonder iets te versturen: `node _werk/_sftp-test.mjs <sessienaam>`.',
  'Repareer je het wachtwoord van `mykunda-sftp`, dan kan die naam gerust terug; allebei',
  'werken ze. Innfold gebruikt een eigen sessie (`innfold-sftp`, gebruiker `iqrgznuv`,',
  'eigen vhost) en die deed het op 05-09 wel.',
  '',
  'De naamgeving hieronder blijft gelden voor welke sessienaam je ook kiest:'
].join(E);
t = t.replace(anker, blok);
writeFileSync(P, t);
console.log('CLAUDE.md: sessie-sectie bijgewerkt');
