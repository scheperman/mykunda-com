/* Live controle op de teruggezette Landpagina. Vanaf Edwins pc draaien. */
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const H = 'https://mykunda.com/';
let fout = 0;
const zeg = (goed, t) => { console.log((goed ? '  ok   ' : '  FOUT ') + t); if (!goed) fout++; };

const r = await fetch(H + 'land-for-sale-in-the-gambia.html', { headers: UA, redirect: 'manual' });
zeg(r.status === 200, `de Landpagina geeft ${r.status}` + (r.headers.get('location') ? ' -> ' + r.headers.get('location') : ''));
if (r.status === 200) {
  const h = await r.text();
  zeg(/<link rel="canonical" href="https:\/\/mykunda\.com\/land-for-sale-in-the-gambia\.html">/.test(h), 'canonical wijst naar zichzelf');
  zeg(/name="robots" content="index, follow/.test(h), 'robots staat op index, follow');
  zeg(/<h1[^>]*>Land for sale in The Gambia/.test(h), 'H1 aanwezig');
  zeg((h.match(/<tr><td><a href="[a-z-]+\.html"/g) || []).length === 19, 'prijstabel heeft 19 rijen');
  zeg(/"@type":"FAQPage"/.test(h), 'FAQPage-JSON-LD aanwezig');
}
const sm = await (await fetch(H + 'sitemap-pages.xml', { headers: UA })).text();
zeg(sm.includes('land-for-sale-in-the-gambia.html'), 'staat in sitemap-pages.xml');
zeg((sm.match(/<loc>/g) || []).length === 88, `sitemap telt ${(sm.match(/<loc>/g) || []).length} URL's (verwacht 88)`);

/* de contextuele link vanaf een paar gebiedspagina's */
for (const p of ['bijilo.html', 'brikama.html', 'tujereng.html', 'fajara.html']) {
  const t = await (await fetch(H + p, { headers: UA })).text();
  const ftr = t.indexOf('<!--mk-ftr-->');
  zeg((ftr > 0 ? t.slice(0, ftr) : t).includes('land-for-sale-in-the-gambia.html'), `${p} linkt er buiten de voettekst naar`);
}
console.log(fout ? `\n${fout} fout` : '\nAlles goed');
process.exit(fout ? 1 : 0);
