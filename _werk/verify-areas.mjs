import { readFileSync } from 'node:fs';
const dir='C:/Users/User/MyKunda/project';
const db=JSON.parse(readFileSync(dir+'/area-prices.json','utf8'));
let bad=0;
for (const k of Object.keys(db.areas)) {
  const r=db.areas[k], f=r.slug+'.html';
  const s=readFileSync(dir+'/'+f,'utf8');
  const p=[];
  if (/chartWrap/.test(s)) p.push('chartWrap nog aanwezig');
  if (/(var|const|let) data=\[/.test(s)) p.push('oude reeks nog aanwezig');
  if (/since 2016/.test(s)) p.push('"since 2016" nog aanwezig');
  if (/YoY/.test(s)) p.push('YoY nog aanwezig');
  if (/collected from listings and partner agents/.test(s)) p.push('oude bronregel nog aanwezig');
  if (/<h2>Price trends<\/h2>/.test(s)) p.push('oud blok nog aanwezig');
  if (!s.includes('<h2>What property costs in '+r.label+'</h2>')) p.push('nieuw blok ontbreekt');
  if (!/id="pf0"/.test(s)) p.push('pf0 ontbreekt');
  if (!/<!--mk-hdr-->/.test(s)) p.push('header weg');
  if (!/<!--mk-ftr-->/.test(s)) p.push('footer weg');
  if ((s.match(/id="qs0"/g)||[]).length!==1) p.push('qs0 niet exact 1x');
  if ((s.match(/class="qstat"/g)||[]).length<4) p.push('te weinig tegels');
  const open=(s.match(/<div\b/g)||[]).length, close=(s.match(/<\/div>/g)||[]).length;
  if (open!==close) p.push(`div-balans ${open}/${close}`);
  for (const m of s.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    try { new Function(m[1]); } catch(e) { p.push('script parse: '+e.message.slice(0,60)); }
  }
  if (p.length){ bad++; console.log(f.padEnd(24), p.join(' | ')); }
}
console.log(bad? `\n${bad} pagina('s) met een melding` : "\nalle 41 pagina's in orde");
const g=readFileSync(dir+'/gambia-property-prices.html','utf8');
console.log('indexpagina: rijen met D-bedrag =', (g.match(/<td class="num">D[\d,]+<\/td>/g)||[]).length);
console.log('\nvoorbeeld tegels bijilo:');
console.log((readFileSync(dir+'/bijilo.html','utf8').match(/<div class="qstats">[\s\S]*?<\/div>\n<\/div>/)||[''])[0].slice(0,900));
