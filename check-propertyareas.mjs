/* check-propertyareas.mjs — vangrail voor het gebiedsblok op property.html.
 *
 *   node check-propertyareas.mjs
 *
 * De pagina is niet in de browser te testen zonder advertentie: LISTINGS is
 * leeg en zonder database toont hij "This listing is no longer available".
 * Daarom wordt hier getoetst wat wél toetsbaar is — de data, de zoeklogica en
 * of alle haakjes waar het script naar grijpt echt in de markup staan.
 */
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile('property-areas.json', 'utf8'));
const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const scores = JSON.parse(await readFile('area-scores.json', 'utf8'));
const t = await readFile('property.html', 'utf8');
let fout = 0;
const meld = m => { console.log('  FOUT ' + m); fout++; };

/* 1 — de haakjes in de markup */
for (const id of ['hoodBlock', 'hoodIntro', 'hoodStats', 'scorebars', 'hoodLink', 'hoodLinkTxt', 'hoodArr']) {
  if (!t.includes(`id="${id}"`)) meld(`de markup mist id="${id}", waar het script wel naar grijpt`);
}
/* Alleen de link ín het blok; kololi.html staat verder gewoon in het menu. */
if (/class="link-arrow" href="kololi\.html"/.test(t))
  meld('de link in het blok staat nog vast op kololi.html — die wees op elke advertentie naar Kololi');
if (/18\.95/.test(t)) meld('de terugval met 18,95 per m² staat er nog');
for (const weg of ['Beach access', 'Investment demand', 'Dining & nightlife', "\\['Safety'"]) {
  if (new RegExp(weg).test(t)) meld(`de verwijderde score "${weg}" staat nog in property.html`);
}
if (!t.includes('<p class="src">Land rate and the evidence')) meld('geen bronregel onder het blok');

/* 2 — de data zelf */
const mData = t.match(/const HOOD_DATA = (\{.*?\});/s);
if (!mData) { meld('HOOD_DATA niet gevonden'); }
else {
  let hood;
  try { hood = JSON.parse(mData[1]); } catch (e) { meld('HOOD_DATA is geen geldige JSON: ' + e.message); }
  if (hood) {
    const namen = Object.keys(hood);
    if (namen.length !== Object.keys(data.areas).length)
      meld(`${namen.length} gebieden in de pagina, ${Object.keys(data.areas).length} in property-areas.json`);
    const prijsPerLabel = new Map(Object.values(prijzen.areas).filter(a => a && a.label).map(a => [a.label, a]));
    const scorePerSlug = new Map(Object.values(scores.areas).map(g => [g.slug, g]));
    for (const [naam, g] of Object.entries(hood)) {
      const p = prijsPerLabel.get(naam);
      if (!p) { meld(`"${naam}" staat niet in area-prices.json`); continue; }
      if (p.gmd_m2 !== g.p) meld(`"${naam}" toont D${g.p}/m² maar area-prices.json zegt D${p.gmd_m2}`);
      if (p.slug !== g.slug) meld(`"${naam}" linkt naar ${g.slug}.html maar hoort ${p.slug}.html te zijn`);
      const s = scorePerSlug.get(g.slug);
      if (!s) { meld(`"${naam}" heeft geen scores in area-scores.json`); continue; }
      const verwacht = s.measures.map(m => [m.label, m.score]);
      if (JSON.stringify(verwacht) !== JSON.stringify(g.s))
        meld(`"${naam}" heeft scores ${JSON.stringify(g.s)} maar area-scores.json zegt ${JSON.stringify(verwacht)}`);
      if (!g.e) meld(`"${naam}" heeft geen bewijsregel bij het tarief`);
    }

    /* 3 — de zoeklogica, met dezelfde regels als in de pagina */
    const zoek = town => {
      let k = Object.keys(hood).find(x => x.toLowerCase() === town.toLowerCase());
      if (!k) {
        const lc = town.toLowerCase();
        k = Object.keys(hood).sort((a, b) => b.length - a.length)
          .find(x => lc.indexOf(x.toLowerCase() + ' ') === 0);
      }
      return k || null;
    };
    const gevallen = [['Kololi', 'Kololi'], ['Nema Kunku', 'Nema Kunku'], ['Brufut Heights', 'Brufut'],
      ['kololi', 'Kololi'], ['Somewhere Else', null], ['Bak', null]];
    for (const [invoer, verwacht] of gevallen) {
      const uit = zoek(invoer);
      if (uit !== verwacht) meld(`zoeken op "${invoer}" geeft ${uit === null ? 'niets' : `"${uit}"`}, verwacht ${verwacht === null ? 'niets' : `"${verwacht}"`}`);
    }
    console.log(`  ${Object.keys(hood).length} gebieden in het blok; zoeklogica getoetst op ${gevallen.length} namen`);

    /* 4 — het renderblok zelf een keer laten draaien.
       De pagina is niet in de browser te openen zonder advertentie, dus wordt
       de code hier letterlijk uit het bestand gehaald en met neppe elementen
       uitgevoerd. Dat vangt een typefout in de opgebouwde HTML die geen enkele
       syntaxcontrole ziet. */
    const mRender = t.match(/\/\/ zoek het gebied van deze advertentie[\s\S]*?area guide';\n  \}/);
    if (!mRender) meld('het renderblok is niet terug te vinden om te testen');
    else {
      const el = () => ({ innerHTML: '', textContent: '', hidden: false, href: '' });
      for (const [town, verwachtGebied] of [['Kololi', 'Kololi'], ['Brufut Heights', 'Brufut'], ['Onbekend Dorp', null]]) {
        const hoodBlock = el(), hoodIntro = el(), hoodStats = el(), scorebars = el(),
              hoodLink = el(), hoodLinkTxt = el();
        const fmtAreaPrice = n => 'D' + n.toLocaleString('en-GB');
        try {
          Function('HOOD_DATA', 'town', 'hoodBlock', 'hoodIntro', 'hoodStats', 'scorebars',
            'hoodLink', 'hoodLinkTxt', 'fmtAreaPrice', mRender[0])(
            hood, town, hoodBlock, hoodIntro, hoodStats, scorebars, hoodLink, hoodLinkTxt, fmtAreaPrice);
        } catch (e) { meld(`het renderblok valt om bij "${town}": ${e.message}`); continue; }

        if (verwachtGebied === null) {
          if (hoodBlock.hidden !== true) meld(`bij een onbekend gebied ("${town}") blijft het blok staan`);
          if (hoodStats.innerHTML) meld(`bij een onbekend gebied ("${town}") worden er toch kaarten getekend`);
          continue;
        }
        const g = hood[verwachtGebied];
        if (!hoodStats.innerHTML.includes(fmtAreaPrice(g.p))) meld(`"${town}": het tarief ${fmtAreaPrice(g.p)} staat niet in de kaarten`);
        if (!hoodStats.innerHTML.includes(g.e)) meld(`"${town}": de bewijsregel staat niet in de kaarten`);
        if (g.n > 0 && !hoodStats.innerHTML.includes('>' + g.n + '<')) meld(`"${town}": het aantal eetgelegenheden staat niet in de kaarten`);
        if (g.n === 0 && /Places to eat/.test(hoodStats.innerHTML)) meld(`"${town}": er staat een kaart "Places to eat" terwijl er niets gekarteerd is`);
        const bars = (hoodStats.innerHTML, scorebars.innerHTML.match(/scorebar/g) || []).length;
        if (bars !== g.s.length) meld(`"${town}": ${bars} balken getekend, ${g.s.length} verwacht`);
        if (hoodLink.href !== g.slug + '.html') meld(`"${town}": de link wijst naar "${hoodLink.href}" in plaats van ${g.slug}.html`);
        if (!hoodLinkTxt.textContent.includes(verwachtGebied)) meld(`"${town}": de linktekst noemt het gebied niet`);
        if (!hoodIntro.textContent.includes(verwachtGebied)) meld(`"${town}": de introregel noemt het gebied niet`);
      }
      console.log('  renderblok uitgevoerd voor Kololi, Brufut Heights en een onbekend gebied');
    }
  }
}

console.log(fout ? `\n${fout} fout(en) gevonden.` : '\nGeen fouten.');
process.exit(fout ? 1 : 0);
