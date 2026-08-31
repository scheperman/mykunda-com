/* Leest de prijsalinea's van de zes nieuwe pagina's terug, als platte tekst. */
import { readFile } from 'node:fs/promises';
for (const f of ['madiana.html', 'jambur.html', 'ghana-town.html', 'tintinto.html', 'tranquil.html', 'old-yundum.html']) {
  const s = await readFile(f, 'utf8');
  console.log('\n================ ' + f);
  const q = s.match(/<div class="qstats">[\s\S]*?<\/div>\s*<\/div>/);
  if (q) console.log('TEGELS: ' + q[0].replace(/<[^>]+>/g, ' | ').replace(/\s+/g, ' ').trim());
  const i = s.indexOf('Evidence behind the land rate');
  console.log('BEWIJS: ' + s.slice(i, i + 200).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  const j = s.indexOf('</div>', s.indexOf('Gambian tenants think'));
  console.log('UITLEG: ' + s.slice(j, j + 1400).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 900));
  const c = s.match(/var comp=\[.*?\];/);
  console.log('VERGELIJK: ' + (c ? c[0] : '-'));
}
