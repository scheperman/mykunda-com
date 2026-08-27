/* Controle na de herijking van 27-08-2026. Leest de gebouwde pagina's in
 * deploy/ en kijkt of wat er staat klopt met area-prices.json.
 *   node check-rents.mjs
 */
import { readFile } from 'node:fs/promises';

const DB = JSON.parse(await readFile('area-prices.json', 'utf8'));
const strip = s => s.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ');
const D = n => 'D' + Math.round(n).toLocaleString('en-US');

let bad = 0;
for (const [key, r] of Object.entries(DB.areas)) {
  const t = strip(await readFile(`deploy/${r.slug}.html`, 'utf8'));
  const i = t.indexOf('Rent, long let');
  const line = i < 0 ? '' : t.slice(i, i + 150);
  const problems = [];

  if (i < 0) problems.push('geen huurregel op de pagina');
  else if (r.rent_year) {
    if (!line.includes(D(r.rent_month))) problems.push('maandbedrag komt niet overeen');
    if (!line.includes(D(r.rent_lo)) || !line.includes(D(r.rent_hi))) problems.push('jaarband komt niet overeen');
  } else if (!line.includes('no rental listings')) problems.push('geen bedrag verwacht, maar er staat iets anders dan de uitleg');

  if (/2% gross yield|roughly 2%/.test(t)) problems.push('oude 2%-tekst staat er nog');
  if (r.yield && (r.yield < 1 || r.yield > 8)) problems.push(`rendement ${r.yield}% buiten 1-8%`);

  const flag = problems.length ? 'FOUT' : 'ok  ';
  if (problems.length) bad++;
  console.log(`${flag} ${r.slug.padEnd(16)} ${r.rent_year ? (D(r.rent_month) + '/mnd  ' + D(r.rent_lo) + '-' + D(r.rent_hi) + '/jr').padEnd(34) : 'geen huurcijfer'.padEnd(34)} ${r.rent_src.padEnd(9)}${problems.join(' | ')}`);
}
console.log(bad ? `\n${bad} pagina('s) met een probleem.` : '\nAlle 41 pagina’s komen overeen met area-prices.json.');
