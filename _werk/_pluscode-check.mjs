/* Losse controle bij de reparatie van 29-08-2026: een Plus Code moet een
   bedrag met een band opleveren, en de band moet met de afstand meegroeien.
   node _werk/_pluscode-check.mjs   (vanuit de projectmap)
   Dit bestand hoort NIET bij de zelftest; het is een werkstuk. */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const require = createRequire(import.meta.url);
require(join(dirname(fileURLToPath(import.meta.url)), '..', 'valuation.js'));
const V = globalThis.MK_VAL;

/* Dezelfde decoder als app.js, hier los nagebouwd zodat dit bestand
   zonder browser draait. */
const A = '23456789CFGHJMPQRVWX';
function decode(code) {
  const c = code.replace('+', '').toUpperCase();
  let lat = -90, lng = -180, res = 20;
  for (let i = 0; i < 8; i += 2) { lat += A.indexOf(c[i]) * res; lng += A.indexOf(c[i + 1]) * res; res /= 20; }
  if (c.length >= 10) { lat += A.indexOf(c[8]) * res; lng += A.indexOf(c[9]) * res; }
  return { lat, lng };
}
function km(a, b) {
  const dy = (a.lat - b.lat) * 110.57;
  const dx = (a.lng - b.lng) * Math.cos(a.lat * Math.PI / 180) * 111.32;
  return Math.sqrt(dy * dy + dx * dx);
}
const AREA = { Tujereng: { lat: 13.31889, lng: -16.78548 }, Sanyang: { lat: 13.2674, lng: -16.7644 } };

const p = decode('7C558652+9GG');
const d = km(p, AREA.Tujereng);
console.log('Plus Code 7C558652+9GG  ->  ' + p.lat.toFixed(5) + ', ' + p.lng.toFixed(5));
console.log('afstand tot Tujereng: ' + d.toFixed(2) + ' km\n');

const BASE = { tujereng: 1110, sanyang: 1540 };
function run(label, input) {
  const r = V.value(input, { LAND_BASE: BASE });
  if (!r.ok) { console.log(label + ': GEEN TARIEF (' + r.reason + ')'); return; }
  const D = v => 'D' + Math.round(v).toLocaleString('en-US');
  console.log(label);
  console.log('  midden ' + D(r.mid) + '   band ' + D(r.low) + ' – ' + D(r.high) +
    '   (' + Math.round((r.high / r.low) * 10) / 10 + 'x)');
  console.log('  vertrouwen ' + r.confidence.score + ' ' + r.confidence.label +
    '   bandbreedte ' + r.confidence.band);
  r.confidence.reasons.forEach(x => console.log('   · ' + x));
  console.log('');
}

/* 50 x 150 m = 7.500 m2, het perceel waar de vraag over ging. */
const basis = { type: 'land', plotSqm: 7500 };
run('1. "7C558652+9GG" ONOPGELOST (zoals de tool het tot nu deed)',
  Object.assign({ area: '7C558652+9GG' }, basis));
run('2. opgelost naar Tujereng, ' + d.toFixed(1) + ' km',
  Object.assign({ area: 'Tujereng', areaKm: d }, basis));
run('3. dezelfde kavel maar met "Tujereng" ingetypt (geen punt)',
  Object.assign({ area: 'Tujereng' }, basis));
run('4. een punt op 4 km van Tujereng',
  Object.assign({ area: 'Tujereng', areaKm: 4 }, basis));
run('5. een punt op 9 km van Sanyang',
  Object.assign({ area: 'Sanyang', areaKm: 9 }, basis));
