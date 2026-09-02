/* Toont een regelbereik uit een bestand, ongewijzigd, met regelnummers.
   Gebruik: node _werk/toon-blok.mjs <bestand> <van> <tot> */
import { readFileSync } from 'node:fs';
const [f, van, tot] = process.argv.slice(2);
const lines = readFileSync(f, 'utf8').split(/\r?\n/);
for (let i = Number(van) - 1; i < Math.min(Number(tot), lines.length); i++) {
  console.log((i + 1) + ': ' + lines[i]);
}
