/* Controle op de gegenereerde hoofdletter-redirects. Draait op bron of deploy:
      node _werk/check-case-redirects.mjs            (bron)
      node _werk/check-case-redirects.mjs deploy     (het uploadpakket)
   Controleert: markers aanwezig, elke geuploade pagina heeft een regel, elke regel
   wijst naar een bestaand bestand, geen enkele regel kan naar zichzelf lussen. */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || '.';
const ht = readFileSync(join(dir, '.htaccess'), 'utf8');
let fouten = 0, ok = 0;
const zeg = (goed, tekst) => { if (goed) ok++; else { fouten++; console.log('  FOUT ' + tekst); } };

const i = ht.indexOf('# BEGIN mk-case-redirects'), j = ht.indexOf('# END mk-case-redirects');
zeg(i >= 0 && j > i, 'markers mk-case-redirects ontbreken of staan verkeerd om');
if (i < 0 || j < i) { console.log('gestopt'); process.exit(1); }
const blok = ht.slice(i, j);

const regels = [...blok.matchAll(/RewriteCond %\{REQUEST_URI\} \[A-Z\]\nRewriteRule \^([a-z0-9.\\-]+)\$ \/([a-z0-9.-]+) \[R=301,L,NC\]/g)];
const doelen = new Map(regels.map(m => [m[1].replace(/\\\./g, '.'), m[2]]));
zeg(regels.length > 0, 'geen enkele regel herkend in het blok');

/* Elke regel: patroon en doel horen hetzelfde te zijn, en het doel moet bestaan. */
for (const [pat, doel] of doelen) {
  zeg(pat === doel, `patroon ^${pat}$ wijst naar /${doel} - dat hoort hetzelfde te zijn`);
  zeg(existsSync(join(dir, doel)), `/${doel} staat in .htaccess maar het bestand ontbreekt in ${dir}/`);
  zeg(doel === doel.toLowerCase(), `/${doel} bevat zelf een hoofdletter - dat zou een lus geven`);
}

/* Elke geuploade pagina hoort een regel te hebben. */
const paginas = readdirSync(dir).filter(f => f.endsWith('.html'));
if (dir === 'deploy') {
  for (const p of paginas) zeg(doelen.has(p), `${p} staat in deploy/ maar heeft geen hoofdletter-redirect`);
}

/* De cond staat er per regel: zonder die cond zou /bakau.html naar zichzelf lussen. */
const conds = (blok.match(/RewriteCond %\{REQUEST_URI\} \[A-Z\]/g) || []).length;
zeg(conds === doelen.size, `${conds} RewriteCond bij ${doelen.size} regels - dat hoort gelijk te zijn`);

console.log(`\n${dir}: ${doelen.size} redirects, ${ok} controles goed, ${fouten} fout`);
process.exit(fouten ? 1 : 0);
