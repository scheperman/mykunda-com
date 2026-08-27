import { readdirSync, readFileSync } from 'node:fs';
const dir='C:/Users/User/MyKunda/project';
const skip=/^(_|upload-|deploy|MyKunda-oud|design-export|sync-naar)/;
const files=readdirSync(dir).filter(f=>f.endsWith('.html')&&!skip.test(f));
const PAT=[
 [/\$688|\$1,?009|\$1,?100|\$1,?050|\$871|\$825|\$779|\$596|\$504\b/,'oud USD-bedrag uit de area-tabel'],
 [/collected from listings and partner agents/,'oude bronregel'],
 [/rebuilt every month|weighted median/i,'oude methodebewering'],
 [/since 2016/,'verzonnen tienjaarsreeks'],
 [/\bYoY\b|year-on-year change|year on year/i,'YoY-claim'],
 [/Avg\.?\s*price\s*\/\s*m/i,'oude tegeltitel'],
 [/MyKunda price index/,'"price index" als naam'],
];
let hits=0;
for(const f of files){
  const s=readFileSync(dir+'/'+f,'utf8');
  const found=PAT.filter(([re])=>re.test(s)).map(([,l])=>l);
  if(found.length){ hits++; console.log(f.padEnd(46), found.join(' | ')); }
}
console.log(hits? `\n${hits} bestand(en) met een restant` : '\ngeen restanten gevonden');
