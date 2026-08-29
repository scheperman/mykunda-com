/* Syntaxcontrole van de inline <script>-blokken in een HTML-bestand.
   Gebruik: node _werk/check-inline-js.mjs sell.html [meer.html ...]
   Compileert elk blok zonder src en zonder type=application/ld+json met
   vm.Script — draait niets uit, vangt alleen parsefouten. */
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

let fout=false;
for(const pad of process.argv.slice(2)){
  const html=readFileSync(pad,'utf8');
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m,n=0;
  while((m=re.exec(html))){
    const attrs=m[1]||'', body=m[2]||'';
    if(/\bsrc\s*=/i.test(attrs)) continue;
    if(/application\/(ld\+)?json/i.test(attrs)) continue;
    n++;
    const regel=html.slice(0,m.index).split('\n').length;
    try{ new vm.Script(body,{filename:pad+'#script'+n}); }
    catch(e){ fout=true; console.error(`FOUT ${pad} blok ${n} (vanaf regel ${regel}): ${e.message}`); }
  }
  if(!fout) console.log(`${pad}: ${n} inline scriptblokken, syntax ok`);
}
process.exit(fout?1:0);
