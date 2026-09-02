/* patch-tijdclaims.mjs — haalt de laatste 56 reistijden van de site.
 *
 *   node _werk/patch-tijdclaims.mjs            toont wat er zou veranderen
 *   node _werk/patch-tijdclaims.mjs --write    past de pagina's aan
 *   node _werk/patch-tijdclaims.mjs --terug    zet alles terug
 *
 * Het blok "Getting around" toont sinds vandaag afstand omdat reistijd in
 * Gambia niet te meten valt. Daarbuiten stonden nog 56 tijdclaims: 47 tegels
 * in de kopstrook ("Beach 5 min on foot"), 5 chips onder de vibe en 4 zinnen
 * in de lopende tekst. Een pagina die bovenaan "Banjul 35 min" belooft en
 * driehonderd pixels lager zegt dat we geen tijden publiceren omdat we ze niet
 * kunnen verdedigen, spreekt zichzelf tegen.
 *
 * Dezelfde regel als in het reisblok: meten wat te meten valt, en weglaten wat
 * niet te meten valt.
 *   - bestemming staat in area-travel.json  → afstand over de weg
 *   - "Beach", "To the beach"               → hemelsbrede afstand tot de
 *                                             Atlantische kust (area-features)
 *   - "River", "Creek", "Bolong"            → hemelsbrede afstand tot de rivier
 *   - al het overige                        → de tegel vervalt
 *
 * Wat vervalt en waarom: "Bijilo Forest", "Crocodile Pool", "Highway",
 * "University", "Senegal border", "Wassu circles" en "To the ferry" zijn geen
 * punt dat we hebben, en "To Brufut beach" vraagt om de afstand tot het strand
 * ván een andere plaats — de kustlijn geeft het dichtstbijzijnde punt, niet dat
 * strand.
 */
import { readFile, writeFile, readdir, mkdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TERUG = process.argv.includes('--terug');
const BACKUP = '_werk/backup-tijdclaims';

if (TERUG) {
  if (!existsSync(BACKUP)) { console.log('Geen backup gevonden.'); process.exit(0); }
  let n = 0;
  for (const f of await readdir(BACKUP)) { await copyFile(`${BACKUP}/${f}`, f); n++; }
  console.log(`teruggezet: ${n} pagina(s)`); process.exit(0);
}

const travel = JSON.parse(await readFile('area-travel.json', 'utf8'));
const feats = JSON.parse(await readFile('area-features.json', 'utf8'));
const reisPerSlug = new Map(Object.values(travel.areas).map(g => [g.slug, g]));
const featPerSlug = new Map(Object.values(feats.areas).map(g => [g.slug, g]));

const TIJD = /\b\d+(?:[.,]\d+)?(?:\s*[–-]\s*\d+)?\s*(?:-)?\s*(?:minute|minutes|min|hour|hours|hr|hrs)\b/i;
const afstand = km => km < 10 ? km.toFixed(1) + ' km' : Math.round(km) + ' km';

/* Vier zinnen in de lopende tekst, met de hand en met een gemeten getal. */
const ZINNEN = [
  ['bijilo.html', 'the beach is a 10-minute stroll through the trees',
                  'the beach is a stroll through the trees'],
  ['brikama.html', "and still be 20 minutes from the beach",
                   "and still be 15 km from the beach"],
  ['brusubi.html', 'Kololi and its beaches are a 10-minute drive; the airport highway is minutes away',
                   'Kololi and its beaches are a 5 km drive, and the airport highway is close'],
  ['cape-point.html', 'all just 10 minutes from the bustle of Kololi and the airport road',
                      'all just ten kilometres from the bustle of Kololi and the airport road'],
];

function kies(slug, label) {
  const l = label.toLowerCase().replace(/^to (the )?/, '').trim();
  const reis = reisPerSlug.get(slug), feat = featPerSlug.get(slug);

  /* een strand van een ándere plaats kunnen we niet meten */
  if (/\bbeach\b/.test(l) && l !== 'beach') return null;
  if (l === 'beach' && feat) return { waarde: afstand(feat.coast_km), t: 'as the crow flies' };
  if (/^(river|creek|bolong|river port)$/.test(l) && feat) return { waarde: afstand(feat.river_km), t: 'as the crow flies' };

  /* Op woorden vergelijken, niet op het hele opschrift: "Airport" hoort bij
     "Banjul Int. Airport", "Hospital" bij "Bansang Hospital" en "Wassu circles"
     bij "Wassu stone circles". Alle woorden van het opschrift moeten in de
     bestemming voorkomen, en minstens één daarvan moet iets voorstellen. */
  if (reis) {
    const woorden = l.split(/[^a-z]+/).filter(Boolean);
    if (woorden.some(w => w.length >= 4)) {
      const rij = reis.rows.find(r => {
        const a = r.to.toLowerCase();
        return woorden.every(w => a.includes(w));
      });
      if (rij) return { waarde: afstand(rij.km), t: modusTekst(rij.mode) };
    }
  }
  return null;
}

/* Dezelfde woorden als in het reisblok, zodat de kopstrook en het blok
   eronder hetzelfde zeggen over dezelfde route. */
const modusTekst = m => m === 'Walk' ? 'on foot'
  : m === 'Ferry' ? 'by ferry'
  : m === 'Car + ferry' ? 'by car and ferry'
  : 'by road';

const files = (await readdir('.')).filter(f => f.endsWith('.html'));
let geraakt = 0, tegelsAangepast = 0, tegelsWeg = 0, chips = 0, zinnen = 0;
const rapport = [];

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  const src = await readFile(f, 'utf8');
  let out = src;

  /* 1 — de tegels in de kopstrook */
  const QSTAT = /<div class="qstat"><div class="k">([^<]*)<\/div><div class="v"([^>]*)>([^<]*)<\/div><div class="t([^"]*)"([^>]*)>([^<]*)<\/div><\/div>/g;
  out = out.replace(QSTAT, (heel, k, vAttr, v, tCls, tAttr, t) => {
    if (!TIJD.test(v)) return heel;
    const nieuw = kies(slug, k);
    if (!nieuw) { tegelsWeg++; rapport.push(`  ${slug.padEnd(15)} tegel weg:     ${k} — ${v} ${t}`); return ''; }
    tegelsAangepast++;
    rapport.push(`  ${slug.padEnd(15)} tegel gemeten: ${k} — ${v} → ${nieuw.waarde}`);
    const tekst = nieuw.t || t;
    return `<div class="qstat"><div class="k">${k}</div><div class="v"${vAttr}>${nieuw.waarde}</div>` +
           `<div class="t${tCls}"${tAttr}>${tekst}</div></div>`;
  });

  /* 2 — de chips onder de vibe: alleen het getal eruit */
  const mt = out.match(/var tags=(\[[^\]]*\]);/);
  if (mt) {
    let lijst; try { lijst = JSON.parse(mt[1].replace(/'/g, '"')); } catch { lijst = null; }
    if (lijst && lijst.some(x => TIJD.test(x))) {
      const nieuw = lijst.map(x => TIJD.test(x) ? x.replace(TIJD, '').replace(/\s+/g, ' ').trim() : x);
      out = out.replace(mt[1], () => JSON.stringify(nieuw));
      chips += lijst.filter(x => TIJD.test(x)).length;
      rapport.push(`  ${slug.padEnd(15)} chip:          ${lijst.filter(x => TIJD.test(x)).join(', ')}`);
    }
  }

  /* 3 — de vier zinnen */
  for (const [bestand, oud, nieuw] of ZINNEN) {
    if (bestand === f && out.includes(oud)) {
      out = out.replace(oud, nieuw); zinnen++;
      rapport.push(`  ${slug.padEnd(15)} zin:           "${oud}" → "${nieuw}"`);
    }
  }

  if (out === src) continue;

  /* meteen compileren: één stukgeknipte string kost anders 41 pagina's */
  for (const m of out.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type\s*=\s*["']?application\//i.test(m[1] || '')) continue;
    try { new Function(m[2]); }
    catch (e) { console.log(`  ${f}: blok compileert niet meer (${e.message}) — OVERGESLAGEN`); out = src; break; }
  }
  if (out === src) continue;

  geraakt++;
  if (WRITE) {
    await mkdir(BACKUP, { recursive: true });
    if (!existsSync(`${BACKUP}/${f}`)) await copyFile(f, `${BACKUP}/${f}`);
    await writeFile(f, out);
  }
}

console.log(rapport.join('\n'));
console.log(`\n${WRITE ? 'aangepast' : 'zou aanpassen'}: ${geraakt} pagina(s) — ` +
  `${tegelsAangepast} tegels gemeten, ${tegelsWeg} tegels weg, ${chips} chips, ${zinnen} zinnen`);
if (zinnen !== ZINNEN.length) console.log(`LET OP: ${ZINNEN.length - zinnen} van de vier zinnen niet gevonden.`);
if (!WRITE) console.log('Draai opnieuw met --write om het echt weg te schrijven (--terug draait het terug).');
