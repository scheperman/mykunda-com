/* Controle op de verwijzingen vanaf de zustersites naar mykunda.com.
   Draait vanuit deze map en kijkt in de deploy-mappen van beide projecten,
   en (met --live) op de live sites. */
import { readFileSync, existsSync } from 'node:fs';
const paden = [
  ['innfold', 'C:/Users/User/Innfold/project/deploy/index.html', 'https://innfold.com/'],
  ['gamgrowth', 'C:/Users/User/GamGrowth/project/deploy/index.html', 'https://gamgrowth.com/']
];
let fout = 0;
for (const [naam, pad, url] of paden) {
  const ok = existsSync(pad) && /href="https:\/\/mykunda\.com/.test(readFileSync(pad, 'utf8'));
  console.log((ok ? '  ok   ' : '  FOUT ') + naam + ': link naar mykunda.com in deploy/index.html');
  if (!ok) fout++;
  if (process.argv.includes('--live')) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0' } });
      const t = await r.text();
      const live = /href="https:\/\/mykunda\.com/.test(t);
      console.log((live ? '  ok   ' : '  FOUT ') + naam + ': link staat live op ' + url);
      if (!live) fout++;
    } catch (e) { console.log('  FOUT ' + naam + ' live niet te lezen: ' + e.message); fout++; }
  }
}
console.log(fout ? `\n${fout} controle(s) fout` : '\nAlles goed');
process.exit(fout ? 1 : 0);
