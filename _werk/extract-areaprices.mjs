import { readdirSync, readFileSync } from 'node:fs';
const dir = 'C:/Users/User/MyKunda/project';
const files = readdirSync(dir).filter(f => f.endsWith('.html'));
const rows = [];
for (const f of files) {
  const s = readFileSync(dir + '/' + f, 'utf8');
  const m = s.match(/function updateAreaPrices\(\)\{[\s\S]*?\n\}/);
  if (!m) continue;
  const blk = m[0];
  const g = id => {
    const r = new RegExp('getElementById\\("' + id + '"\\);[^;]*?fmtAreaPriceK?\\((\\d+)\\)');
    const x = blk.match(r);
    return x ? +x[1] : null;
  };
  const hist = (s.match(/var data=\[([0-9,.]+)\]/) || [])[1] || '';
  const delta = (s.match(/class="delta">([^<]*)</) || [])[1] || '';
  const yoy = (s.match(/<div class="t up">([^<]*)</) || [])[1] || '';
  rows.push({ area: f.replace('.html', ''), ppsm: g('qs0'), villa: g('qs1'), rent: g('qs2'),
    bd1: g('bd1'), bd2: g('bd2'), bd3: g('bd3'), bd4: g('bd4'), delta, yoy, hist });
}
console.log(JSON.stringify(rows, null, 0));
console.log('COUNT', rows.length);
