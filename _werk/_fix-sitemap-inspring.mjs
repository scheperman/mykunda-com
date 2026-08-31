import { readFile, writeFile } from 'node:fs/promises';
const f = 'sitemap-pages.xml';
let s = await readFile(f, 'utf8');
const voor = s;
s = s.replace(/^<url>/gm, '  <url>');
if (s !== voor) { await writeFile(f, s); console.log('inspringing hersteld'); }
else console.log('niets te doen');
