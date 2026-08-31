/* De zes nieuwe gebieden bijzetten in de twee overzichten — 31-08-2026.
   - areas-in-the-gambia.html: een kaartje in de juiste regiosectie
   - gambia-property-prices.html: een rij in de tabel
   Bedragen zijn hier placeholders; build-area-prices.mjs vult en sorteert ze.
   Eenmalig, en het slaat over wat er al staat. */
import { readFile, writeFile } from 'node:fs/promises';

const WRITE = process.argv.includes('--write');

const NIEUW = [
  { slug: 'ghana-town', label: 'Ghana Town', na: 'brufut',
    reg: 'West Coast · Kombo North · Atlantic coast',
    ln: 'A Ghanaian fishing settlement with nowhere left to expand',
    tabelReg: 'Kombo Coast' },
  { slug: 'tintinto', label: 'Tintinto', na: 'tujereng',
    reg: 'West Coast · Kombo South',
    ln: 'A hamlet of 218 on the coast road, and a sand-mining case nobody reported the end of',
    tabelReg: 'Kombo Coast' },
  { slug: 'tranquil', label: 'Tranquil', na: 'brusubi',
    reg: 'Kombo North · Beside Brusubi',
    ln: 'Walled compounds next to Brusubi — expensive ground, thin evidence',
    tabelReg: 'Kombo Inland' },
  { slug: 'old-yundum', label: 'Old Yundum', na: 'yundum',
    reg: 'West Coast · Kombo North',
    ln: 'A town of 10,035 by the airport, with two estates already sold out',
    tabelReg: 'Kombo Inland' },
  { slug: 'jambur', label: 'Jambur', na: 'brikama',
    reg: 'West Coast · Kombo South',
    ln: 'Kabilo land on the tarred road, beside the country’s largest solar plant',
    tabelReg: 'Kombo Inland' },
  { slug: 'madiana', label: 'Madiana', na: 'mamuda',
    reg: 'West Coast · Kombo North',
    ln: 'A village of 5,057 that got its tarred road in May 2026',
    tabelReg: 'Kombo Inland' },
];

/* ---- 1. de kaartjes ---- */
{
  const f = 'areas-in-the-gambia.html';
  let src = await readFile(f, 'utf8');
  const voor = src;
  for (const a of NIEUW) {
    if (src.includes(`href="${a.slug}.html"`)) { console.log(a.slug + ': staat er al in het overzicht'); continue; }
    const start = src.indexOf(`<a class="ar-card" href="${a.na}.html"`);
    if (start < 0) { console.error(a.slug + ': anker ' + a.na + ' niet gevonden'); process.exit(1); }
    const eind = src.indexOf('</a>', start) + 4;
    const kaart = `\n      <a class="ar-card" href="${a.slug}.html"><span class="top"><span class="nm">${a.label}</span>` +
      `<span class="pr">D0<small class="">land / m²</small></span></span>` +
      `<span class="rg">${a.reg}</span><span class="ln">${a.ln}</span></a>`;
    src = src.slice(0, eind) + kaart + src.slice(eind);
    console.log(a.slug + ': kaartje na ' + a.na);
  }
  if (src !== voor && WRITE) await writeFile(f, src);
}

/* ---- 2. de tabelrijen ---- */
{
  const f = 'gambia-property-prices.html';
  let src = await readFile(f, 'utf8');
  const voor = src;
  for (const a of NIEUW) {
    if (src.includes(`<a href="${a.slug}.html">`)) { console.log(a.slug + ': staat er al in de tabel'); continue; }
    const i = src.indexOf('<tbody>');
    if (i < 0) { console.error('tbody niet gevonden'); process.exit(1); }
    const eind = i + '<tbody>\n'.length;
    const rij = `<tr><td><a href="${a.slug}.html">${a.label}</a></td><td class="reg">${a.tabelReg}</td>` +
      `<td class="num">D0</td><td class="num">-</td>` +
      `<td class="med">D0<span>plot, 400 m²</span></td>` +
      `<td class="med">D0<span>house, asking</span></td></tr>\n`;
    src = src.slice(0, eind) + rij + src.slice(eind);
    console.log(a.slug + ': tabelrij toegevoegd');
  }
  if (src !== voor && WRITE) await writeFile(f, src);
}

console.log(WRITE ? '\ngeschreven' : '\nproefdraai — voeg --write toe');
