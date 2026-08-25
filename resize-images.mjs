// resize-images.mjs
// Zet dit bestand in dezelfde map als je 'images/' folder
// Run: node resize-images.mjs

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const sharp = require('sharp');

const images = [
  'river-gambia', 'brufut-street', 'bijilo',
  'capepoint', 'kololi', 'sanyang'
];

for (const name of images) {
  const info = await sharp(`images/${name}.webp`)
    .resize(400)
    .webp({ quality: 55 })
    .toFile(`images/${name}-sm.webp`);
  console.log(`OK ${name}-sm.webp — ${Math.round(info.size / 1024)} KiB (${info.width}x${info.height})`);
}

console.log('\nKlaar! Upload de -sm.webp bestanden naar je server.');
