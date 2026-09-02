/* Toont de exacte script-src- en connect-src-fragmenten in elk bestand dat een
   CSP draagt, zodat een vervanging op de letter kan in plaats van op het oog. */
import { readFileSync } from 'node:fs';
for (const f of ['.htaccess', '_headers', 'vercel.json']) {
  const txt = readFileSync(f, 'utf8');
  const lines = txt.split(/\r?\n/);
  lines.forEach((ln, i) => {
    if (!/Content-Security-Policy/.test(ln)) return;
    console.log('== ' + f + '  regel ' + (i + 1) + (/^\s*#/.test(ln) ? '  (uitgecommentarieerd)' : ''));
    for (const d of ['script-src', 'connect-src']) {
      const m = ln.match(new RegExp(d + "[^;\"]*"));
      console.log('   ' + (m ? m[0] : d + ': NIET AANWEZIG'));
    }
  });
}
