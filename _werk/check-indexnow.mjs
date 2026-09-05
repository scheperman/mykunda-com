/* Controle op de IndexNow-inrichting. Draai dit NA een upload, vanaf Edwins pc
   (de cloudomgeving krijgt van Cloudflare een 403 op mykunda.com).

      node _werk/check-indexnow.mjs              alleen kijken
      node _werk/check-indexnow.mjs --verstuur   ook echt aanmelden

   Zonder --verstuur wordt er niets naar IndexNow gestuurd. */
import { readFileSync, existsSync } from 'node:fs';

const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36' };
const KEY = (readFileSync('build.mjs', 'utf8').match(/const INDEXNOW_KEY = '([0-9a-f]+)'/) || [])[1];
let fout = 0;
const zeg = (goed, tekst) => { console.log((goed ? '  ok   ' : '  FOUT ') + tekst); if (!goed) fout++; };

zeg(!!KEY, 'sleutel uit build.mjs: ' + (KEY || 'NIET GEVONDEN'));
if (!KEY) process.exit(1);
zeg(existsSync(KEY + '.txt'), KEY + '.txt staat in de root');
zeg(existsSync('deploy/' + KEY + '.txt'), KEY + '.txt staat in deploy/');

const url = `https://mykunda.com/${KEY}.txt`;
try {
  const r = await fetch(url, { headers: UA });
  const t = (await r.text()).trim();
  zeg(r.status === 200, `${url} geeft ${r.status}`);
  zeg(t === KEY, 'de inhoud van het sleutelbestand is de sleutel zelf');
} catch (e) { zeg(false, 'sleutelbestand niet op te halen: ' + e.message); }

if (!existsSync('_werk/indexnow.json')) {
  console.log('\n  Geen _werk/indexnow.json: sinds de laatste upload is geen enkele pagina inhoudelijk gewijzigd.');
  if (process.argv.includes('--verstuur')) {
    /* Eenmalige proef op de homepage. Die staat sowieso live, dus er wordt niets
       aangemeld dat niet bestaat - het antwoord van IndexNow bewijst alleen dat de
       sleutel klopt en dat de route werkt. */
    const body = { host: 'mykunda.com', key: KEY, keyLocation: url, urlList: [ 'https://mykunda.com/' ] };
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body)
    });
    zeg(r.status === 200 || r.status === 202, `proefaanmelding van de homepage: IndexNow antwoordde ${r.status} ${(await r.text()).slice(0, 120)}`);
  }
} else {
  const body = JSON.parse(readFileSync('_werk/indexnow.json', 'utf8'));
  console.log(`\n  Klaar om aan te melden: ${body.urlList.length} URL('s)`);
  for (const u of body.urlList) console.log('    ' + u);
  if (process.argv.includes('--verstuur')) {
    const r = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' }, body: JSON.stringify(body)
    });
    const txt = await r.text();
    zeg(r.status === 200 || r.status === 202, `IndexNow antwoordde ${r.status} ${txt.slice(0, 120)}`);
  } else {
    console.log('  (niets verstuurd - draai met --verstuur om dat wel te doen)');
  }
}
console.log(fout ? `\n${fout} controle(s) fout` : '\nAlles goed');
process.exit(fout ? 1 : 0);
