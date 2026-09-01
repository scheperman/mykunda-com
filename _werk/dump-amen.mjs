import { readFile, readdir, writeFile } from 'node:fs/promises';
const files = (await readdir('.')).filter(f => f.endsWith('.html'));
const out = [];
for (const f of files) {
  const src = await readFile(f, 'utf8');
  const an = src.match(/"@type":"Place","name":"([^",]+), The Gambia"/)
          || src.match(/var areaName\s*=\s*["']([^"']+)["']/);
  if (!an) continue;
  const m = src.match(/var amenData=(\[.*?\]);/s) || src.match(/const amen=(\[.*?\]);/s);
  let data = null;
  if (m) {
    const paren = m[1].replace(/&amp;/g, '&')
      .replace(/,\s*[A-Za-z_$][\w$]*\s*\]/g, ']')      // icoonvariabele in kololi.html
      .replace(/'/g, '"');
    try { data = JSON.parse(paren); } catch { data = m[1]; }
  }
  const geo = src.match(/"latitude":([-\d.]+),"longitude":([-\d.]+)/);
  const lead = src.match(/<h2>What's nearby<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  const sc = src.match(/var schools=(\[.*?\]);/s);
  let schools = null;
  if (sc) { try { schools = JSON.parse(sc[1].replace(/&amp;/g, '&')); } catch { schools = sc[1]; } }
  const sh2 = src.match(/<h2>(Schools[^<]*|International schools)<\/h2>\s*<p class="lead">([^<]*)<\/p>/);
  out.push({ file: f, area: an[1], lat: geo ? +geo[1] : null, lng: geo ? +geo[2] : null,
    lead: lead ? lead[1] : null, amen: data, schoolHead: sh2 ? sh2[1] : null,
    schoolLead: sh2 ? sh2[2] : null, schools });
}
await writeFile('_werk/amen-dump.json', JSON.stringify(out, null, 1));
console.log('gebiedspaginas:', out.length, '— met amenData:', out.filter(o => o.amen).length);
