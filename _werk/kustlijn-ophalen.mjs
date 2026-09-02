/* kustlijn-ophalen.mjs — haalt de Atlantische kustlijn en het water van de
 * Gambia-rivier uit OpenStreetMap, zodat "Beach 5 min" en "River 5 min" op de
 * gebiedspagina's vervangen kunnen worden door een gemeten afstand.
 *   node _werk/kustlijn-ophalen.mjs   → _werk/kustlijn.json
 */
import { writeFile } from 'node:fs/promises';
const UA = 'MyKunda area audit/1.0 (admin@mykunda.com)';
const BBOX = '12.95,-17.20,13.95,-13.70';
const slaap = ms => new Promise(r => setTimeout(r, ms));

async function overpass(q) {
  for (let i = 0; i < 6; i++) {
    try {
      const r = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST', body: 'data=' + encodeURIComponent(`[out:json][timeout:180];${q}`),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA } });
      if (r.ok) return (await r.json()).elements;
      console.log('  HTTP ' + r.status);
    } catch (e) { console.log('  ' + e.message); }
    await slaap(25000);
  }
  return null;
}

const punten = (els, soort) => {
  const uit = [];
  for (const e of els || []) for (const p of e.geometry || []) uit.push([+p.lat.toFixed(5), +p.lon.toFixed(5)]);
  console.log(`${soort}: ${(els || []).length} lijnen, ${uit.length} punten`);
  return uit;
};

const kust = punten(await overpass(`way[natural=coastline](${BBOX});out geom;`), 'kustlijn');
await slaap(6000);
const rivier = punten(await overpass(`way[waterway=riverbank](${BBOX});out geom;`), 'rivieroever');

await writeFile('_werk/kustlijn.json', JSON.stringify({
  source: 'OpenStreetMap contributors (ODbL 1.0), Overpass API',
  fetched: new Date().toISOString(), bbox: BBOX,
  coast: kust, river: rivier,
}));
console.log('geschreven: _werk/kustlijn.json');
