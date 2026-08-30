/* check-areaprices.mjs — de prijscijfers op een gebiedspagina moeten onderling kloppen.
 *
 * Gebruik: node _werk/check-areaprices.mjs
 *
 * Toetst per gebiedspagina of getallen die op verschillende plekken over hetzelfde
 * gaan, hetzelfde zeggen: de kop van de tabel tegen de JS-waarde, het einde van de
 * grafiek tegen de grondprijs, de opsplitsing tegen het totaal, het percentage
 * "since 2016" tegen de reeks waar het uit zou komen, en de kavelprijs tegen de
 * m²-prijs — maar dat laatste alléén waar de pagina zelf zegt dat hij hem daaruit
 * afleidt.
 *
 * TWEE DINGEN DIE HIER FOUT GINGEN, ALS WAARSCHUWING (30-08-2026)
 *
 * 1. Het script las de waarden met een regex die uitging van een losse
 *    `getElementById("qs0"); … fmtAreaPrice(6460)` per veld. De pagina's gebruiken
 *    al langer één tabel plus een forEach, dus de regex vond niets meer en er
 *    stond voor elke pagina braaf "null … vs qs0 null". Een controle die altijd
 *    hetzelfde zegt, controleert niets — en ze had al die tijd groen gelijk.
 *
 * 2. Er zat een toets in die aannam dat `qs1` een mediane villaprijs was en dus
 *    door de m²-prijs gedeeld een woonoppervlak zou geven. `qs1` is de prijs van
 *    een kavel van 400 m². De toets meldde daarom op elke pagina "400 m²" als
 *    afwijking, terwijl 400 juist het goede antwoord was. Een toets die niet weet
 *    wat het getal betekent, is erger dan geen toets.
 *
 * De les voor wie hier iets aan verandert: toets wat de pagina zégt te doen. De
 * derde kolom naast de kavelprijs zegt óf "at the rate above" (afgeleid, dus
 * toetsbaar) óf "median asking price" (waargenomen, dus niet).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../', import.meta.url));

let pagina = 0, gemeld = 0;
for (const f of readdirSync(dir).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(f)) continue;
  const s = readFileSync(dir + f, 'utf8');
  if (!/function updateAreaPrices\(\)/.test(s) || !/Areas in The Gambia/.test(s)) continue;
  pagina++;

  /* De waardetabel: var v=[["qs0",6460],["pf0",6460],…] */
  const blk = (s.match(/function updateAreaPrices\(\)\{[\s\S]*?\n\}/) || [''])[0];
  const tabel = new Map([...blk.matchAll(/\["([a-z0-9]+)",\s*(\d+)\]/gi)].map(m => [m[1], +m[2]]));
  const g = id => (tabel.has(id) ? tabel.get(id) : null);

  const qs0 = g('qs0'), qs1 = g('qs1');
  const html0 = (s.match(/id="qs0"[^>]*>D?\$?([0-9,]+)/) || [])[1];
  const hist = ((s.match(/var data=\[([0-9,.]+)\]/) || [])[1] || '').split(',').filter(Boolean).map(Number);
  const last = hist.length ? hist[hist.length - 1] : null;
  const first = hist.length ? hist[0] : null;
  const delta = (s.match(/class="delta">\+?(\d+)% since 2016/) || [])[1];

  /* Zegt de kavelregel dat hij is afgeleid van de m²-prijs, of dat hij gemeten is? */
  const kavelrij = (s.match(/<div[^>]*>\s*<span[^>]*>Plot of[\s\S]*?<\/div>/) || [''])[0];
  const afgeleid = /at the rate above/i.test(kavelrij);

  const probs = [];
  if (qs0 == null) probs.push('geen qs0 in updateAreaPrices — is de opbouw veranderd?');
  if (html0 && qs0 != null && +html0.replace(/,/g, '') !== qs0) probs.push(`html qs0=${html0} vs js ${qs0}`);
  if (last != null && qs0 != null && last !== qs0) probs.push(`grafiek eindigt op ${last} vs qs0 ${qs0}`);

  const deel = ['bd1','bd2','bd3','bd4'].map(g).filter(v => v != null);
  if (deel.length && qs0 != null) {
    const som = deel.reduce((a, b) => a + b, 0);
    if (Math.abs(som - qs0) > 2) probs.push(`opsplitsing telt op tot ${som} vs ${qs0}`);
  }
  if (delta && first && last) {
    const echt = Math.round((last / first - 1) * 100);
    if (Math.abs(echt - +delta) > 3) probs.push(`delta zegt +${delta}% maar de reeks is +${echt}%`);
  }
  if (afgeleid && qs0 && qs1) {
    const verwacht = qs0 * 400;
    const afw = Math.round((qs1 / verwacht - 1) * 100);
    if (Math.abs(afw) > 3) probs.push(`kavelprijs zegt "at the rate above" maar ${qs1.toLocaleString('en-US')} is ${afw > 0 ? '+' : ''}${afw}% van ${verwacht.toLocaleString('en-US')}`);
  }

  if (probs.length) { gemeld++; console.log(f.replace('.html','').padEnd(16) + String(qs0).padStart(6) + '  ' + probs.join(' | ')); }
}
console.log(`\n${pagina} pagina's getoetst, ${gemeld} met een opmerking${gemeld ? '' : ' — alles in orde'}`);
