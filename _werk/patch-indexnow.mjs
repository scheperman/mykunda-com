/* Eenmalige patch 05-09-2026: IndexNow. Sleutelbestand in de root, generatie van
   het aanmeldbericht in build.mjs, verzending in upload.bat. Idempotent. */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const KEY = '1a01e0ded2474955709f9b30fe339e29';

/* ---- 1. sleutelbestand ---- */
if (existsSync(KEY + '.txt')) console.log('sleutelbestand stond er al');
else { writeFileSync(KEY + '.txt', KEY); console.log('sleutelbestand ' + KEY + '.txt geschreven'); }

/* ---- 2. build.mjs ---- */
let bm = readFileSync('build.mjs', 'utf8');
const B = (bm.match(/\r\n/g) || []).length > 10 ? '\r\n' : '\n';
if (bm.includes('INDEXNOW_KEY')) console.log('build.mjs: IndexNow stond er al');
else {
  const a1 = "  'robots.txt', 'sitemap.xml', 'sitemap-pages.xml', '.htaccess'";
  const a2 = "  let newest = '0000-00-00', changed = 0;";
  const a3 = "    else if (prev.hash !== h) { date = today; ledger[file] = { hash: h, lastmod: today }; changed++; }";
  const a4 = "  console.log(`sitemap   ${inSitemap.size} URL's, ${changed} lastmod bijgewerkt, jongste ${newest}`);";
  for (const [n, a] of [[1, a1], [2, a2], [3, a3], [4, a4]]) {
    if (!bm.includes(a)) { console.error('build.mjs: anker ' + n + ' niet gevonden - NIETS gewijzigd'); process.exit(1); }
  }
  bm = bm.replace(a1, a1 + ',' + B + '  INDEXNOW_KEY + \'.txt\'');
  bm = bm.replace("const SITE_ASSETS = [",
    "/* IndexNow-sleutel. Geen geheim: hij staat als los bestand in de webroot en is" + B +
    "   juist bedoeld om daar opgehaald te worden. Wijzig hem niet zonder ook het" + B +
    "   bestand in de root te hernoemen - anders weigert IndexNow de aanmelding. */" + B +
    "const INDEXNOW_KEY = '" + KEY + "';" + B + B + "const SITE_ASSETS = [");
  bm = bm.replace(a2, a2 + ' const changedUrls = [];');
  bm = bm.replace(a3, a3.replace('changed++; }', "changed++; changedUrls.push(`https://mykunda.com/${path}`); }"));
  bm = bm.replace(a4, a4 + B + [
    "  /* IndexNow (05-09-2026): Bing en Yandex horen zo binnen enkele minuten van een",
    "     wijziging, in plaats van bij hun volgende crawl. build.mjs schrijft hier alleen",
    "     het bericht; upload.bat verstuurt het pas NA een geslaagde upload, want een URL",
    "     aanmelden die nog niet live staat levert een fout op. Niets gewijzigd = geen",
    "     bestand = upload.bat slaat de stap over. */",
    "  await mkdir('_werk', { recursive: true });",
    "  if (changedUrls.length) {",
    "    await writeFile('_werk/indexnow.json', JSON.stringify({",
    "      host: 'mykunda.com', key: INDEXNOW_KEY,",
    "      keyLocation: `https://mykunda.com/${INDEXNOW_KEY}.txt`,",
    "      urlList: changedUrls",
    "    }, null, 1) + '\\n');",
    "  } else { await rm('_werk/indexnow.json', { force: true }); }",
    "  console.log(`indexnow  ${changedUrls.length} URL('s) klaar voor aanmelding`);"
  ].join(B));
  writeFileSync('build.mjs', bm);
  console.log('build.mjs: IndexNow toegevoegd');
}
