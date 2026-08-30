/* Kleine correctie: "Know one to be wrong? tell us." begint een zin, dus de
   linktekst hoort met een hoofdletter. In de oude alinea stond hij midden in
   een zin en was klein juist goed. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const OUD = 'Know one to be wrong? <a href="contact.html">tell us</a>.';
const NIEUW = 'Know one to be wrong? <a href="contact.html">Tell us</a>.';
let n = 0;
for (const naam of (await readdir(root)).filter(f => f.endsWith('.html'))) {
  if (/^(SEO-|Instructie-|_)/.test(naam)) continue;
  const pad = new URL(naam, root);
  const html = await readFile(pad, 'utf8');
  if (!html.includes(OUD)) continue;
  await writeFile(pad, html.replace(OUD, NIEUW));
  n++;
}
console.log(n + ' pagina\'s gecorrigeerd');
