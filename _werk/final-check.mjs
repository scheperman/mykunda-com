import { readdirSync, readFileSync } from 'node:fs';
const dir='C:/Users/User/MyKunda/project';
const skip=/^(_|upload-|deploy|MyKunda-oud|design-export|sync-naar)/;
const files=readdirSync(dir).filter(f=>f.endsWith('.html')&&!skip.test(f));
let bad=0;
for(const f of files){
  const s=readFileSync(dir+'/'+f,'utf8'); const p=[];
  const open=(s.match(/<div\b/g)||[]).length, close=(s.match(/<\/div>/g)||[]).length;
  if(open!==close) p.push(`div-balans ${open}/${close}`);
  for(const m of s.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application)[^>]*>([\s\S]*?)<\/script>/g)){
    try{ new Function(m[1]); }catch(e){ p.push('script: '+e.message.slice(0,50)); }
  }
  for(const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)){
    try{ JSON.parse(m[1]); }catch(e){ p.push('ld+json: '+e.message.slice(0,50)); }
  }
  if(p.length){bad++;console.log(f.padEnd(48),p.join(' | '));}
}
console.log(bad?`\n${bad} bestand(en) met een probleem`:`\n${files.length} pagina's: HTML-balans, inline JS en structured data allemaal in orde`);
