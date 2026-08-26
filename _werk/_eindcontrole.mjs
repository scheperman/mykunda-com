/* Laatste controle vóór de upload. Draaien vanuit de projectmap:
   node _werk/_eindcontrole.mjs   */
import { readdir, readFile } from 'node:fs/promises';

const dep = await readdir('deploy');
const pages = dep.filter(n => n.endsWith('.html'));
const fout = [];

/* 1 - geen werkbestanden meer in deploy */
const lek = dep.filter(n => n.startsWith('_') && !['_headers', '_redirects'].includes(n));
if (lek.length) fout.push('werkbestanden in deploy: ' + lek.join(', '));

/* 2 - de nieuwe bestanden staan er wel */
for (const n of ['valuation.js', 'valuation-areas.js', 'valuation-selftest.html', 'sell.html', 'list.html']) {
  if (!dep.includes(n)) fout.push('ontbreekt in deploy: ' + n);
}

/* 3 - sell.html en list.html laden de module met dezelfde stempel als app.min.js */
for (const p of ['sell.html', 'list.html']) {
  const s = await readFile('deploy/' + p, 'utf8');
  const app = (s.match(/app\.min\.js\?v=(\d+)/) || [])[1];
  const val = (s.match(/valuation\.js\?v=(\d+)/) || [])[1];
  const are = (s.match(/valuation-areas\.js\?v=(\d+)/) || [])[1];
  if (!(app && val && are && app === val && val === are)) fout.push(p + ': stempels lopen niet gelijk (' + app + '/' + val + '/' + are + ')');
}

/* 4 - de oude tool is echt weg, de nieuwe echt aanwezig */
const sell = await readFile('deploy/sell.html', 'utf8');
if (/initPropertyValuation|initLandValuation|valueToggle/.test(sell)) fout.push('sell.html bevat nog resten van de oude tool');
if (!sell.includes('mkvTypes')) fout.push('sell.html mist de nieuwe flow');
if (!/id="ldMapBox"[\s\S]*data-ldmode="draw"/.test(sell)) fout.push('sell.html mist de kaart of het intekenen');

/* 5 - de zelftestpagina staat op noindex */
const st = await readFile('deploy/valuation-selftest.html', 'utf8');
if (!/noindex/.test(st)) fout.push('valuation-selftest.html staat niet op noindex');

/* 6 - niemand gebruikt de oude globale naam meer */
const va = await readFile('deploy/valuation-areas.js', 'utf8');
if (va.includes('MK_AREAS')) fout.push('valuation-areas.js botst nog met MK_AREAS uit app.js');

console.log('deploy/: ' + dep.length + ' bestanden, ' + pages.length + ' pagina\'s');
console.log(fout.length ? '\nNIET IN ORDE:\n' + fout.map(f => '   - ' + f).join('\n')
                        : '\nAlles in orde. deploy/ is klaar om te uploaden.');
