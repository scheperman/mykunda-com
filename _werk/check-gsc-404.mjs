/* De elf URL's die Search Console op 05-09-2026 onder "Niet gevonden (404)" had staan,
   met validatiestatus Mislukt (gestart 08-08, mislukt 11-08). Allemaal hoofdletter-
   varianten uit een oudere build. Draai dit vóór je in Search Console op
   "Herstel valideren" klikt: elke URL hoort nu een 301 te geven die op een 200 uitkomt. */
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const urls = [
  'https://mykunda.com/Bijilo.html',
  'https://mykunda.com/Legal.html?doc=terms',
  'https://mykunda.com/Search.html',
  'https://mykunda.com/Legal.html',
  'https://mykunda.com/Search.html?q={search_term_string}',
  'https://mykunda.com/About.html',
  'https://mykunda.com/Search.html?q=Brufut',
  'https://mykunda.com/Guide.html?slug=cost-of-buying-property-in-the-gambia',
  'https://mykunda.com/Legal.html?doc=cookies',
  'https://mykunda.com/Guide.html?slug=buying-property-in-the-gambia-as-a-foreigner',
  'https://mykunda.com/Search.html?q=Cape%20Point'
];
let fout = 0;
for (const u of urls) {
  const stappen = [];
  let huidig = u, status = 0;
  for (let i = 0; i < 5; i++) {
    const r = await fetch(huidig, { headers: UA, redirect: 'manual' });
    status = r.status;
    const loc = r.headers.get('location');
    if (status >= 300 && status < 400 && loc) { stappen.push(status); huidig = new URL(loc, huidig).href; continue; }
    break;
  }
  const goed = status === 200;
  if (!goed) fout++;
  console.log((goed ? '  ok   ' : '  FOUT ') + u.replace('https://mykunda.com', '').padEnd(66)
    + (stappen.length ? stappen.join('>') + '>' : '') + status + '  ' + huidig.replace('https://mykunda.com', ''));
}
console.log(fout ? `\n${fout} van de ${urls.length} komt niet op een 200 uit` : `\nAlle ${urls.length} komen op een 200 uit`);
process.exit(fout ? 1 : 0);
