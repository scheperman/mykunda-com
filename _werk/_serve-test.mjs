/* Wegwerpservertje om _werk/slot-encode-test.html in de browser te draaien. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs';
import { join, extname } from 'node:path';
const ROOT = join(process.cwd());
const T = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };
createServer((q, s) => {
  const u = q.url.split('?')[0];
  const f = join(ROOT, u);
  readFile(f, (e, d) => {
    if (e) { s.writeHead(404); return s.end('not found'); }
    s.writeHead(200, { 'Content-Type': T[extname(f)] || 'application/octet-stream' });
    s.end(d);
  });
}).listen(8793, () => console.log('http://127.0.0.1:8793'));
