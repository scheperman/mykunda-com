/* Live controle op de hoofdletter-redirects. Draait vanaf Edwins pc: de
   cloudomgeving krijgt van Cloudflare een 403 op mykunda.com. */
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const proeven = [
  ['/Bijilo.html', 301, '/bijilo.html'],
  ['/Bakau.html', 301, '/bakau.html'],
  ['/Guide-cost-of-buying-property-in-the-gambia.html', 301, '/guide-cost-of-buying-property-in-the-gambia.html'],
  ['/BUY.HTML', 301, '/buy.html'],
  ['/bijilo.html', 200, null],
  ['/buy.html', 200, null],
  ['/guides.html', 200, null],
  ['/onzin-bestaat-niet.html', 404, null]
];
let fout = 0;
for (const [p, verwacht, doel] of proeven) {
  const r = await fetch('https://mykunda.com' + p, { headers: UA, redirect: 'manual' });
  const loc = (r.headers.get('location') || '').replace('https://mykunda.com', '');
  const goed = r.status === verwacht && (!doel || loc === doel);
  if (!goed) fout++;
  console.log((goed ? '  ok   ' : '  FOUT ') + p.padEnd(52) + r.status + (loc ? ' -> ' + loc : '') + (goed ? '' : `   (verwacht ${verwacht}${doel ? ' -> ' + doel : ''})`));
}
console.log(fout ? `\n${fout} van de ${proeven.length} fout` : `\nAlle ${proeven.length} goed`);
process.exit(fout ? 1 : 0);
