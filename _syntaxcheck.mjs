/* Tijdelijke controle: haal elk inline <script> uit de opgegeven pagina's en
   kijk of het parseert. new Function() compileert zonder uit te voeren, dus dit
   vindt haakjes- en syntaxfouten zonder iets aan te raken.
   Draaien: node _syntaxcheck.mjs deploy/dashboard.html deploy/auth.html */
import { readFileSync } from 'node:fs';

let bad = 0;
for (const file of process.argv.slice(2)) {
  const html = readFileSync(file, 'utf8');
  const re = /<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/gi;
  let m, i = 0;
  while ((m = re.exec(html))) {
    i++;
    const attrs = m[1] || '';
    const code = m[2];
    if (!code.trim()) continue;
    /* JSON-LD is geen JavaScript; die blokken overslaan in plaats van ze als
       fout te rapporteren. */
    if (/type\s*=\s*["']?application\/(ld\+)?json/i.test(attrs)) {
      console.log(`json ${file} blok ${i} overgeslagen`);
      continue;
    }
    try {
      new Function(code);
      console.log(`ok   ${file} blok ${i} (${code.length} tekens)`);
    } catch (e) {
      bad++;
      console.log(`FOUT ${file} blok ${i}: ${e.message}`);
    }
  }
}
console.log(bad ? `\n${bad} blok(ken) met een syntaxfout.` : '\nAlle blokken parseren.');
process.exit(bad ? 1 : 0);
