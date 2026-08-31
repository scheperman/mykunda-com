/* Welke gebiedskaartjes staan in welke regiosectie van areas-in-the-gambia.html? */
import { readFile } from 'node:fs/promises';
const s = await readFile('areas-in-the-gambia.html', 'utf8');
const secties = [...s.matchAll(/<section class="ar-reg">\s*<h2>([^<]+)<\/h2>([\s\S]*?)<\/section>/g)];
for (const [, kop, body] of secties) {
  const namen = [...body.matchAll(/<a class="ar-card" href="([a-z-]+)\.html"/g)].map(m => m[1]);
  console.log(kop.padEnd(16) + '(' + namen.length + ')  ' + namen.join(', '));
}
