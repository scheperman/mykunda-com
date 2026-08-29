/* Vergelijkt de live pagina regel voor regel met de gebouwde kopie in deploy/. */
import { readFile } from 'node:fs/promises';
const p = process.argv[2] || 'land-for-sale-in-the-gambia.html';
const live = await (await fetch('https://mykunda.com/' + p + '?mk=' + Date.now(),
  { headers: { 'cache-control': 'no-cache' } })).text();
const lokaal = await readFile('deploy/' + p, 'utf8');
const n = s => s.replace(/\r\n/g, '\n');
const A = n(live).split('\n'), B = n(lokaal).split('\n');
console.log('live bytes  :', Buffer.byteLength(live), ' regels:', A.length);
console.log('deploy bytes:', Buffer.byteLength(lokaal), ' regels:', B.length);
if (n(live) === n(lokaal)) { console.log('\nIDENTIEK'); process.exit(0); }
let getoond = 0;
for (let i = 0; i < Math.max(A.length, B.length) && getoond < 8; i++) {
  if (A[i] === B[i]) continue;
  getoond++;
  console.log(`\nregel ${i + 1}`);
  console.log('  live  :', (A[i] || '(ontbreekt)').slice(0, 220));
  console.log('  deploy:', (B[i] || '(ontbreekt)').slice(0, 220));
}
