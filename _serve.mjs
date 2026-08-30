/* Minimale statische server voor deploy/, alleen om een gebouwde pagina in de
   browser te kunnen bekijken tijdens het testen. Hoort niet op de site thuis en
   wordt door build.mjs niet meegenomen. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = join(process.cwd(), 'deploy');
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png',
  '.jpg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' };

createServer((q, s) => {
  let u = q.url.split('?')[0];
  if (u === '/') u = '/dashboard.html';
  const fp = join(ROOT, u);
  readFile(fp, (e, d) => {
    if (e) { s.writeHead(404); return s.end('not found'); }
    s.writeHead(200, { 'Content-Type': TYPES[extname(fp)] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(8791, () => console.log('http://127.0.0.1:8791'));
