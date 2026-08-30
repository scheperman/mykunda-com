/* patch-standaardtekst.mjs — de twee standaardalinea's onder de prijstabel korter.
 *
 * Gebruik: node _werk/patch-standaardtekst.mjs [--droog] [--terug]
 *
 * WAAROM
 *   Gemeten op 30-08-2026 met _werk/audit-areatekst.mjs: van de 30.130 woorden
 *   lopende tekst op de 46 gebiedspagina's was de helft standaardtekst die op
 *   tien of meer pagina's letterlijk terugkomt. Twee alinea's onder de prijstabel
 *   waren samen goed voor circa 8.100 woorden site-breed, en ze zeiden twee keer
 *   hetzelfde: dit zijn vraagprijzen, onze data is jong, corrigeer ons.
 *
 * WAT ER NIET VERDWIJNT
 *   Geen enkel feit. Vraagprijs is geen verkoopprijs, er is geen openbaar
 *   register, verkoopprijzen liggen lager, en de reden dat er geen rendement
 *   staat — alle vier blijven. De volledige uitleg stond al op
 *   how-we-measure-prices.html, waar elke gebiedspagina onderaan naar linkt.
 *
 * HOE
 *   Alinea 1 heeft zes varianten die verschillen in hun staart (wel of geen
 *   rendement, en met welke percentages). Die staarten blijven ongemoeid: er
 *   wordt alleen de openingszin vervangen, die op alle 46 pagina's identiek is.
 *   Alinea 2 is overal letterlijk gelijk en wordt in zijn geheel vervangen.
 *
 *   Beide vervangingen zijn omkeerbaar met --terug, zolang de nieuwe tekst nog
 *   niet met de hand is aangepast.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const droog = process.argv.includes('--droog');
const terug = process.argv.includes('--terug');

/* De opening van alinea 1 — 58 woorden, identiek op alle 46 pagina's. */
const OPENING_OUD =
  'Every figure on this page is an <em>asking</em> price. No one in The Gambia publishes what property ' +
  'actually sells for — there is no public register of sale prices — so what a seller asks is the only ' +
  'thing that can be measured consistently. Sale prices are generally lower, by an amount that depends ' +
  'entirely on the seller.';
const OPENING_NIEUW =
  'Every figure here is an <em>asking</em> price. The Gambia has no public register of sale prices, so ' +
  'what sellers ask is the only thing that can be measured consistently; actual sale prices are ' +
  'generally lower.';

/* Alinea 2 — 100 woorden, in zijn geheel. */
const MISSIE_OUD =
  '<p style="margin-top:14px">These figures are as honest as we can make them — and still young. Reliable ' +
  'Gambian market data barely exists yet, for anyone; building it is one of the reasons MyKunda exists at ' +
  'all. So we publish what we can measure, print the evidence count next to every figure, and leave a blank ' +
  'rather than defend a number we cannot. A market where buyers and sellers can trust what they read has to ' +
  'start somewhere. Every listing and every verified sale sharpens these figures — and if you know a figure ' +
  'on this page to be wrong, <a href="contact.html">tell us</a>.</p>';
const MISSIE_NIEUW =
  '<p style="margin-top:14px">Reliable Gambian market data barely exists yet — building it is part of why ' +
  'MyKunda exists. We print the evidence behind every figure and leave a blank rather than defend a number ' +
  'we cannot. Know one to be wrong? <a href="contact.html">tell us</a>.</p>';

const paren = terug
  ? [[OPENING_NIEUW, OPENING_OUD], [MISSIE_NIEUW, MISSIE_OUD]]
  : [[OPENING_OUD, OPENING_NIEUW], [MISSIE_OUD, MISSIE_NIEUW]];

const woorden = s => s.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().split(' ').length;
const bespaard = (woorden(OPENING_OUD) - woorden(OPENING_NIEUW)) + (woorden(MISSIE_OUD) - woorden(MISSIE_NIEUW));

let geraakt = 0, gemist = [], totaal = 0;
for (const naam of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(naam) || /areas-in-the-gambia/.test(naam)) continue;
  const pad = new URL(naam, root);
  const html = await readFile(pad, 'utf8');
  if (!/Areas in The Gambia/.test(html)) continue;
  totaal++;

  let nieuw = html, raak = 0;
  for (const [oud, vervang] of paren) {
    if (!nieuw.includes(oud)) continue;
    if (nieuw.split(oud).length - 1 !== 1) { console.log(`LET OP ${naam}: fragment komt vaker dan één keer voor`); continue; }
    nieuw = nieuw.replace(oud, vervang);
    raak++;
  }

  if (raak !== 2) { gemist.push(`${naam} (${raak}/2)`); }
  if (raak === 0) continue;
  if (!droog) await writeFile(pad, nieuw);
  geraakt++;
}

console.log(`${geraakt} van ${totaal} gebiedspagina's ${droog ? 'zouden worden aangepast' : 'aangepast'}${terug ? ' (teruggedraaid)' : ''}`);
if (gemist.length) console.log('niet volledig geraakt: ' + gemist.join(', '));
else console.log(`beide alinea's op elke pagina geraakt — ${bespaard} woorden per pagina, ${bespaard * geraakt} in totaal`);
