/* Controle 31-08-2026: vindt het waarderingsmodel de juiste bewijsklasse voor
   gebieden met een sleutel van twee woorden? LAND_PUBLISHED gebruikt streepjes
   ('kerr-serign'), de oude tabellen spaties ('brufut heights'). */
import { readFile } from 'node:fs/promises';
const src = await readFile('valuation.js', 'utf8');
const win = {};
new Function('window', 'globalThis', src + '\n;window.__C = (typeof MK_VAL_CONFIG!=="undefined")?MK_VAL_CONFIG:null;')(win, win);
const C = win.MK_VAL_CONFIG || win.__C;
if (!C) { console.error('MK_VAL_CONFIG niet gevonden'); process.exit(1); }
const P = C.LAND_PUBLISHED;
console.log('LAND_PUBLISHED sleutels met een spatie :', Object.keys(P).filter(k => k.includes(' ')).length);
console.log('LAND_PUBLISHED sleutels met een streepje:', Object.keys(P).filter(k => k.includes('-')).join(', '));
console.log('LAND_HALF sleutels                      :', Object.keys(C.LAND_HALF).join(', '));
console.log('MK_RATES-achtige zone-sleutels met streepje:', Object.keys(C.LAND_ZONE || {}).filter(k => k.includes('-')).join(', ') || '(geen)');
