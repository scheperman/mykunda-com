import { readFileSync } from 'node:fs';
const dir='C:/Users/User/MyKunda/project';
const PAT=[/\$688|\$1,?009|\$1,?100|\$1,?050|\$871|\$825|\$779|\$596|\$504\b/g,
 /collected from listings and partner agents/g,/rebuilt every month|weighted median/gi,
 /since 2016/g,/\bYoY\b|year-on-year change|year on year/gi,/Avg\.?\s*price\s*\/\s*m/gi,
 /MyKunda price index/g];
for (const f of ['areas-in-the-gambia.html','gambia-property-prices.html','how-we-measure-prices.html',
                 'index.html','land-for-sale-in-the-gambia.html','property.html']) {
  const s=readFileSync(dir+'/'+f,'utf8');
  console.log('\n=== '+f);
  for (const re of PAT) {
    for (const m of s.matchAll(re)) {
      const a=Math.max(0,m.index-110), b=Math.min(s.length,m.index+110);
      console.log('   …'+s.slice(a,b).replace(/\s+/g,' ')+'…');
    }
  }
}
