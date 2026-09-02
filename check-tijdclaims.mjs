/* check-tijdclaims.mjs — vangrail: er hoort nergens op een gebiedspagina nog
 * een reistijd te staan.
 *
 *   node check-tijdclaims.mjs
 *
 * Sinds 01-09-2026 toont de site afstand in plaats van tijd, omdat reistijd in
 * Gambia niet te meten valt (verkeer, en de wachttijd bij de veerboot). Dit
 * script kijkt of er ergens weer een minuut of een uur is teruggeslopen — in
 * de kopstrook, in de chips onder de vibe, in het reisblok of in de lopende
 * tekst.
 */
import { readFile, readdir } from 'node:fs/promises';

const prijzen = JSON.parse(await readFile('area-prices.json', 'utf8'));
const slugs = new Set(Object.values(prijzen.areas).filter(a => a && a.slug).map(a => a.slug));
const files = (await readdir('.')).filter(f => f.endsWith('.html') && slugs.has(f.replace(/\.html$/, '')));
const TIJD = /\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+)?\s*(?:-)?\s*(?:minute|minutes|min|hour|hours|hr|hrs)\b/gi;

/* Wat wél een tijd mag bevatten: de uitleg waaróm er geen tijden staan, en de
   openingstijden van een voorziening als die ooit worden getoond. */
const TOEGESTAAN = [
  /road model drives the posted speed/i,
  /rather than the wait that actually decides/i,
];

let fout = 0, gecontroleerd = 0;
for (const f of files) {
  gecontroleerd++;
  const src = await readFile(f, 'utf8');
  const body = (src.match(/<main[\s\S]*?<\/main>/) || [src])[0];
  for (const m of body.matchAll(TIJD)) {
    const zin = body.slice(Math.max(0, m.index - 140), m.index + 80).replace(/\s+/g, ' ');
    if (TOEGESTAAN.some(re => re.test(zin))) continue;
    console.log(`  FOUT ${f}: reistijd "${m[0]}" — …${zin.slice(-120)}…`);
    fout++;
  }
}
console.log(`\ngecontroleerd: ${gecontroleerd} gebiedspagina's`);
console.log(fout ? `${fout} reistijd(en) gevonden die er niet horen te staan.` : 'Geen reistijden meer op de gebiedspagina\'s.');
process.exit(fout ? 1 : 0);
