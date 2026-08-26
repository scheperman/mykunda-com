import { readdir, readFile } from 'node:fs/promises';

const root = (await readdir('.')).filter(n => n.startsWith('_'));
const dep = await readdir('deploy');

console.log('Werkbestanden in de root:');
root.forEach(n => console.log('   ' + n + (dep.includes(n) ? '   <-- STAAT OOK IN DEPLOY' : '')));

const lekt = root.filter(n => dep.includes(n));
console.log('\nLekt er iets naar deploy?', lekt.length ? lekt.join(', ') : 'nee');

/* Is de oude globale naam echt overal weg? */
const va = await readFile('deploy/valuation-areas.js', 'utf8');
console.log('deploy/valuation-areas.js gebruikt MK_AREAS:', va.includes('MK_AREAS'));
console.log('deploy/valuation-areas.js gebruikt MK_RATES:', va.includes('MK_RATES'));

/* Verwijst er nog een pagina naar de oude tool? */
const pages = (await readdir('deploy')).filter(n => n.endsWith('.html'));
const oud = [];
for (const p of pages) {
  const s = await readFile('deploy/' + p, 'utf8');
  if (/valueToggle|panelProperty|initPropertyValuation|initLandValuation/.test(s)) oud.push(p);
}
console.log('Pagina\'s met resten van de oude tool:', oud.length ? oud.join(', ') : 'geen');
console.log('Aantal HTML-pagina\'s in deploy:', pages.length);
