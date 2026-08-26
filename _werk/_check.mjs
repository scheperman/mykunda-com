import { readFileSync } from 'node:fs';
for (const f of ['list.html', 'sell.html']) {
  const a = readFileSync(f, 'utf8');
  const b = readFileSync('deploy/' + f, 'utf8');
  console.log(f,
    '| bron mkPriceGuide:', a.includes('mkPriceGuide'),
    '| deploy mkPriceGuide:', b.includes('mkPriceGuide'),
    '| deploy mkv1:', b.includes('mkv1'),
    '| deploy MK_RATES:', b.includes('MK_RATES'));
}
