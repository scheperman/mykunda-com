import { readdirSync, readFileSync } from 'node:fs';
const dir = 'C:/Users/User/MyKunda/project';
const files = readdirSync(dir).filter(f => f.endsWith('.html'));
for (const f of files) {
  const s = readFileSync(dir + '/' + f, 'utf8');
  if (!/function updateAreaPrices\(\)/.test(s)) continue;
  const blk = s.match(/function updateAreaPrices\(\)\{[\s\S]*?\n\}/)[0];
  const g = id => { const x = blk.match(new RegExp('getElementById\\("' + id + '"\\);[^;]*?fmtAreaPriceK?\\((\\d+)\\)')); return x ? +x[1] : null; };
  const qs0 = g('qs0'), b1 = g('bd1'), b2 = g('bd2'), b3 = g('bd3'), b4 = g('bd4');
  const villa = g('qs1'), rent = g('qs2');
  const html0 = (s.match(/id="qs0">\$?([0-9,]+)/) || [])[1];
  const hist = ((s.match(/var data=\[([0-9,.]+)\]/) || [])[1] || '').split(',').map(Number);
  const last = hist.length ? hist[hist.length - 1] : null;
  const first = hist.length ? hist[0] : null;
  const delta = (s.match(/class="delta">\+?(\d+)% since 2016/) || [])[1];
  const probs = [];
  if (html0 && +html0.replace(/,/g, '') !== qs0) probs.push('html qs0=' + html0 + ' vs js ' + qs0);
  if (last != null && last !== qs0) probs.push('chart ends ' + last + ' vs qs0 ' + qs0);
  const sum = [b1, b2, b3, b4].reduce((a, b) => a + (b || 0), 0);
  if (qs0 && Math.abs(sum - qs0) > 2) probs.push('breakdown sums ' + sum + ' vs ' + qs0);
  if (delta && first && last) { const real = Math.round((last / first - 1) * 100); if (Math.abs(real - +delta) > 3) probs.push('delta says +' + delta + '% but series is +' + real + '%'); }
  if (qs0 && villa) { const m2 = Math.round(villa / qs0); if (m2 < 90 || m2 > 320) probs.push('median villa implies ' + m2 + ' m2'); }
  if (qs0 && rent) probs.push('rent/ppsm=' + (rent / qs0).toFixed(3));
  console.log(f.replace('.html', '').padEnd(16), String(qs0).padStart(5), probs.filter(p => !p.startsWith('rent/')).join(' | '));
}
