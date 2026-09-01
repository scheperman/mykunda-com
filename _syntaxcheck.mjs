/* Haalt elk inline <script> uit de opgegeven pagina's en kijkt of het
   parseert. new Function() compileert zonder uit te voeren, dus dit vindt
   haakjes- en syntaxfouten zonder iets aan te raken.

     node _syntaxcheck.mjs                 alle .html in deze map
     node _syntaxcheck.mjs dashboard.html  alleen deze

   LET OP — dit ging op 01-09-2026 mis en het koste bijna een kapotte upload.
   Zonder argumenten controleerde dit script NIETS en meldde het toch
   "Alle blokken parseren". Een hele dag patchwerk is zo langs een groene vink
   geglipt terwijl er op 41 pagina's een string openstond. Daarom: geen
   argumenten betekent nu álles, en nul gecontroleerde blokken is een fout,
   geen geslaagde run. */
import { readFileSync, readdirSync } from 'node:fs';

const args = process.argv.slice(2);
const files = args.length ? args : readdirSync('.').filter(f => f.endsWith('.html'));
if (!files.length) { console.log('FOUT: geen enkel bestand om te controleren.'); process.exit(1); }

let bad = 0, blokken = 0, overgeslagenModules = 0, stil = !args.length;
for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    i++;
    const attrs = m[1] || '', code = m[2];
    if (!code.trim()) continue;
    /* JSON-LD is geen JavaScript; die blokken overslaan in plaats van ze als
       fout te rapporteren. */
    if (/type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs)) continue;
    blokken++;
    try {
      /* Een module mag import/export gebruiken en compileert dus niet met
         new Function(). Die blokken worden overgeslagen in plaats van als fout
         gemeld — ze staan alleen in de handleidingpagina's. */
      if (/type\s*=\s*["']?module/i.test(attrs) || /^\s*(import|export)\s/m.test(code)) {
        overgeslagenModules++;
        continue;
      }
      new Function(code);
      if (!stil) console.log(`ok   ${file} blok ${i} (${code.length} tekens)`);
    } catch (e) {
      bad++;
      console.log(`FOUT ${file} blok ${i}: ${e.message}`);
    }
  }
}

if (!blokken) { console.log('FOUT: er is geen enkel inline script gecontroleerd.'); process.exit(1); }
console.log(bad
  ? `\n${bad} blok(ken) met een syntaxfout, van ${blokken} in ${files.length} bestand(en).`
  : `\nAlle ${blokken - overgeslagenModules} blokken in ${files.length} bestand(en) parseren` +
    (overgeslagenModules ? ` (${overgeslagenModules} module-blok(ken) overgeslagen).` : '.'));
process.exit(bad ? 1 : 0);
