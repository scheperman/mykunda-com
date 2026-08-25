/* MyKunda build script — run before every upload:
 *
 *     node build.mjs
 *
 * It does three things that were previously done by hand and drifted apart:
 *
 *  1. Minifies app.js  -> app.min.js  and styles.css -> styles.min.css.
 *  2. Puts ONE version stamp everywhere: in every ?v= in every .html, and in
 *     the STAMP constant in sw.js. That mismatch is what silently killed the
 *     service worker's precache before.
 *  3. Mirrors the changed site files into deploy/, which is what gets uploaded.
 *
 * It never touches internal documents (handleidingen, bouwplannen, prompts) and
 * never writes to deploy/ anything that is not a site file.
 *
 * Node 18+. No dependencies.
 */
import { readFile, writeFile, readdir, mkdir, copyFile, stat, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';

const STAMP = String(Date.now());

/* LET OP: build.mjs raakt `const V` in sw.js NIET aan. STAMP verandert alleen de
   PRECACHE-urls; het gooit geen bestaande cache weg. Is er nieuwe INHOUD achter
   app.min.js of in een pagina, hoog dan met de hand V op in sw.js (mk-v18 -> mk-v19).
   Zonder die ophoging krijgt elke terugkerende bezoeker eerst nog de oude pagina. */

/* Files that belong on the server. Everything else in the root is internal. */
const SITE_ASSETS = [
  'app.min.js', 'styles.min.css', 'areas.css',
  'supabase.js', 'sw.js', 'manifest.json', 'admin-guard.js',
  'admin-nav.js', 'image-slot.js', 'gambia-places.js',
  'market-index.js', 'market-sources.js',
  'title-verification-app.js', 'title-verification-components.js',
  'robots.txt', 'sitemap.xml', 'sitemap-pages.xml', '.htaccess'
];

/* Bestanden die in de root MOETEN blijven maar NIET op de server horen. Ze stonden
   eerder wel in SITE_ASSETS, waardoor de opschoning van 17-08-2026 bij de volgende
   build stil werd teruggedraaid:
     app.js, styles.css   bronbestanden van app.min.js / styles.min.css
     doc-page.js          alleen interne documenten gebruiken het
     email-preview.js     idem
     guide-bodies-2.js    alleen de ingetrokken guide.html
     _headers/_redirects  Netlify/Vercel-config, inert op Apache — .htaccess doet dit
     vercel.json          idem
     verified-badge.svg   nergens naar verwezen
   Pagina's die 301'en of concept zijn, staan hieronder in NOT_UPLOADED. */
const NOT_UPLOADED = new Set([
  'home.html',          /* .htaccess 301 naar /            */
  'neighborhood.html',  /* .htaccess 301 naar /kololi.html */
  'guide.html',         /* .htaccess 301 naar /guides.html */
  'checkout v2.html', 'checkout v3.html'
]);

/* Internal documents: never uploaded, never stamped. */
const INTERNAL = /^(.*-handleiding|.*-controle|.*-analyse|.*-optimalisatie|.*-herstelplan|.*-verbeteringen|Performance-audit|MyKunda Prospectus|backend-architecture|phase-\d|prompt-|werkplan|photo-brief|logo-|email-preview|email-previews|email-valuation|email-eindcontrole|google-workspace|whatsapp-setup|contact-en-email|Technische-controle|Aanmelden-analyse|SEO-|Supabase-|4G-|deploy-|harvest-|inloggen-)/;

/* ---------------- minifiers ---------------- */

/* Squeezes whitespace in a run of real code. Newlines survive, so
   automatic-semicolon-insertion behaviour cannot change; only spaces and tabs go. */
function squeeze(code) {
  return code
    .replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]*([{}()\[\];,:<>=*\/%&|!?~^])[ \t]*/g, '$1')
    .replace(/([^\s+\-])[ \t]+([+\-])/g, '$1$2').replace(/([+\-])[ \t]+([^\s+\-])/g, '$1$2');
}

/* Minifies JavaScript with a single stateful scan.
 *
 * The scan has to be stateful across LINE BOUNDARIES, not per line. app.js
 * contains multi-line template literals full of HTML, and inside a template
 * every space is output the visitor actually reads: squeezing `${ICON.pin}
 * ${p.street}` down to `${ICON.pin}${p.street}` glues an icon onto an address.
 * A per-line scanner loses track of the template on the second line and does
 * exactly that — while still producing syntactically valid JS, so a parse check
 * never catches it. Hence: template literals are emitted verbatim, and only the
 * ${...} expressions inside them are treated as code again.
 */
function minifyJS(src) {
  let out = '';          // finished output
  let code = '';         // current run of code, squeezed on flush
  let i = 0, prev = '';  // prev = last significant code char (regex detection)
  const isId = c => /[A-Za-z0-9_$]/.test(c);
  const flush = () => { out += squeeze(code); code = ''; };

  /* Emits a template literal completely verbatim, from the opening backtick to the
     matching closing one. Nothing inside a template is touched — not even the
     ${...} expressions. Squeezing those would save a kilobyte and risks getting
     the nesting wrong, and the whole point of this function is that the bytes a
     visitor reads come out unchanged. */
  function template(j) {
    out += '`'; j++;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { out += c + src[j + 1]; j += 2; continue; }
      if (c === '`') { out += c; return j + 1; }
      if (c === '$' && src[j + 1] === '{') { out += '${'; j = interp(j + 2); continue; }
      out += c; j++;
    }
    return j;
  }

  /* Copies a ${...} expression verbatim up to its matching brace. Braces inside
     strings and inside nested templates do not count towards the depth. */
  function interp(j) {
    let depth = 1;
    while (j < src.length) {
      const c = src[j];
      if (c === '\\') { out += c + src[j + 1]; j += 2; continue; }
      if (c === '`') { j = template(j); continue; }
      if (c === '"' || c === "'") {
        const q = c; out += c; j++;
        while (j < src.length) { const d = src[j]; out += d; if (d === '\\') { out += src[j + 1]; j += 2; continue; } j++; if (d === q) break; }
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') { depth--; out += c; j++; if (depth === 0) return j; continue; }
      out += c; j++;
    }
    return j;
  }

  while (i < src.length) {
    const c = src[i], c2 = src[i + 1];
    if (c === '/' && c2 === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && c2 === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '`') { flush(); i = template(i); prev = '`'; continue; }
    if (c === '"' || c === "'") {
      /* Quoted strings go out verbatim too. "· " and friends live in here and a
         squeeze would eat the space just as surely as inside a template. */
      flush();
      const q = c; out += c; i++;
      while (i < src.length) { const d = src[i]; out += d; if (d === '\\') { out += src[i + 1]; i += 2; continue; } i++; if (d === q) break; }
      prev = q; continue;
    }
    if (c === '/' && !(prev && (isId(prev) || prev === ')' || prev === ']'))) {
      code += c; i++; let cls = false;
      while (i < src.length) {
        const d = src[i]; code += d; i++;
        if (d === '\\') { code += src[i]; i++; continue; }
        if (d === '[') cls = true; else if (d === ']') cls = false;
        else if (d === '/' && !cls) break; else if (d === '\n') break;
      }
      while (i < src.length && /[a-z]/.test(src[i])) { code += src[i]; i++; }
      prev = '/'; continue;
    }
    code += c; if (!/\s/.test(c)) prev = c; i++;
  }
  flush();
  return out.replace(/^\n+/, '') + '\n';
}

/* The check a parse test cannot do.
 *
 * Every string, template and quoted literal in the output must be byte-identical
 * to the source: those bytes ARE the rendered page. Comments legitimately vanish,
 * so counting raw substrings over the whole file proves nothing — the invariant is
 * literal-for-literal equality, in order.
 */
function literals(s) {
  const out = []; let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '/' && s[i + 1] === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; let t = c; i++;
      while (i < s.length) { const d = s[i]; t += d; if (d === '\\') { t += s[i + 1]; i += 2; continue; } i++; if (d === q) break; }
      out.push(t); continue;
    }
    i++;
  }
  return out;
}

function assertTextIntact(src, min) {
  const a = literals(src), b = literals(min);
  if (a.length !== b.length) throw new Error(`minify changed literal count: ${a.length} -> ${b.length}`);
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) throw new Error(`minify altered literal #${i}:\n  was ${JSON.stringify(a[i].slice(0, 120))}\n  now ${JSON.stringify(b[i].slice(0, 120))}`);
  }
}

function minifyCSS(src) {
  let o = '', i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    if (c === '"' || c === "'") { const q = c; o += c; i++; while (i < src.length) { const d = src[i]; o += d; if (d === '\\') { o += src[i + 1]; i += 2; continue; } i++; if (d === q) break; } continue; }
    o += c; i++;
  }
  /* Strings AND calc() expressions are parked as placeholders before the
     whitespace squeeze. calc() needs the spaces around + and - to stay: CSS
     requires them, and `calc(var(--header-h)+62px)` is an INVALID value that the
     browser silently drops — which is how the hero padding on buy/rent
     disappeared and the page slid under the header. */
  const store = []; let s = '', j = 0;
  const park = t => { store.push(t); return '\u0001' + (store.length - 1) + '\u0002'; };
  while (j < o.length) {
    const c = o[j];
    if (c === '"' || c === "'") { let t = c; j++; while (j < o.length) { const d = o[j]; t += d; if (d === '\\') { t += o[j + 1]; j += 2; continue; } j++; if (d === c) break; } s += park(t); continue; }
    if (o.slice(j, j + 5).toLowerCase() === 'calc(' && !/[a-z0-9_-]/i.test(o[j - 1] || '')) {
      let t = 'calc(', depth = 1; j += 5;
      while (j < o.length && depth > 0) { const d = o[j]; if (d === '(') depth++; if (d === ')') depth--; t += d; j++; }
      s += park(t.replace(/\s+/g, ' ')); continue;
    }
    s += c; j++;
  }
  return s.replace(/\s+/g, ' ').replace(/\s*([{}:;,>~+])\s*/g, '$1').replace(/;}/g, '}')
    .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').trim()
    .replace(/\u0001(\d+)\u0002/g, (m, k) => store[+k]) + '\n';
}

/* ---------------- run ---------------- */

const banner = n => `/* MyKunda ${n} — generated by build.mjs. Do not edit this file. */\n`;

const appSrc = await readFile('app.js', 'utf8');
const appMin = minifyJS(appSrc);
new Function(appMin);                              // throws if the output is broken
assertTextIntact(appSrc, appMin);                  // throws if rendered text changed
await writeFile('app.min.js', banner('app.min.js') + appMin);

const cssSrc = await readFile('styles.css', 'utf8');
await writeFile('styles.min.css', minifyCSS(cssSrc));

console.log(`minified  app.js ${(appSrc.length / 1024) | 0}kb -> ${(appMin.length / 1024) | 0}kb`);

/* Copyright-blok + vingerafdruk.
 *
 * De vingerafdruk is een korte code die uniek is voor deze pagina en deze
 * build. Duikt de site ergens anders op, dan staat die code in de kopie —
 * dat is het bewijs dat het geen toevallige gelijkenis is maar een kopie.
 * Kost 90 bytes per pagina, gecomprimeerd bijna niets.
 */
function fingerprint(name) {
  let h = 0x811c9dc5;
  for (const c of name + '|' + STAMP) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36).padStart(7, '0');
}
const MARK_START = '<!--mk-mark-->', MARK_END = '<!--/mk-mark-->';

/* De robots-tag hoort bij de PAGINA, niet bij de build.
 *
 * Het blok hieronder is de enige robots-tag op een pagina, dus de directive moet
 * hier per pagina worden bepaald. Stond hier een vaste `noai, noimageai`, dan
 * verloren de afgeschermde pagina's hun `noindex` en de publieke pagina's hun
 * `index, follow, max-image-preview:large` — precies de regressie van 17-08-2026.
 * robots.txt blokkeert de app-pagina's bewust niet; deze metatag doet dat werk. */
const NOINDEX_PAGES = new Set(['admin.html', 'dashboard.html', 'messages.html', 'list.html',
  'auth.html', 'checkout.html', 'checkout v2.html', 'checkout v3.html', 'sources.html',
  'rates.html', 'title-verification.html', 'market.html']);
const AI = 'noai, noimageai';
function robotsFor(name) {
  if (NOINDEX_PAGES.has(name)) return 'noindex, nofollow, ' + AI;
  if (name === '404.html') return 'noindex, follow, ' + AI;   /* wel volgen, niet indexeren */
  return 'index, follow, max-image-preview:large, ' + AI;
}
/* property.html is de kale objecttemplate: zonder ?id= is het een lege pagina en die
   hoort niet in de index. De tag start daarom op noindex EN houdt id="mkRobots"; het
   canonical-script in de pagina zet hem op index zodra er een geldige listing staat.
   Zonder deze uitzondering zet markPage() hem bij elke build terug op index. */
const JS_ROBOTS = new Set(['property.html']);
function markPage(src, name) {
  const stripped = src
    .replace(new RegExp(MARK_START + '[\\s\\S]*?' + MARK_END + '\\n?'), '')
    /* eigen robots-tags elders in de head weg: het blok is de enige bron,
       twee tags op één pagina geven tegenstrijdige signalen. */
    .replace(/[ \t]*<meta name="robots"[^>]*>\n?/gi, '');
  const block = MARK_START +
    '<meta name="copyright" content="\u00a9 MyKunda \u2014 mykunda.com. All rights reserved.">' +
    (JS_ROBOTS.has(name)
      ? '<meta name="robots" id="mkRobots" content="noindex, follow, ' + AI + '">'
      : '<meta name="robots" content="' + robotsFor(name) + '">') +
    '<!--mk:' + fingerprint(name) + '-->' + MARK_END + '\n';
  return stripped.replace(/<head[^>]*>\n?/i, m => m + block);
}

/* ---------------- header, footer en landmarks statisch in de pagina ----------------
 *
 * headerHTML() en footerHTML() uit app.js worden hier uitgevoerd; het resultaat gaat
 * letterlijk in <div id="header"> en <div id="footer">, en de twee innerHTML-regels
 * verdwijnen uit het inline script van de pagina. Zo staat de hele navigatie — de 30+
 * plaatslinks, de gidsen, alle footerlinks — in de HTML zelf, waar zoekmachines,
 * link-checkers en schermlezers hem zonder JavaScript zien.
 *
 * app.js verwacht geen browser voor deze twee functies (ze bouwen alleen een string),
 * maar de rest van het bestand doet dat wel. Daarom draait het hier met een minimale
 * stub-omgeving die niets doet: geen fetch, geen localStorage, geen service worker.
 * getUser() en getCurrency() worden vastgezet op "uitgelogd" en "GMD" — dat is de
 * variant die in de HTML komt; app.js tekent de header opnieuw voor wie is ingelogd
 * of een andere munt koos (zie hydrateStaticHeader).
 *
 * Lukt het uitvoeren niet, dan blijft de pagina zoals hij was: de header wordt dan
 * nog steeds at runtime gevuld. De build waarschuwt en gaat door. */
function loadShell(src) {
  const noop = () => {};
  const el = () => ({ style: {}, dataset: {}, cssText: '',
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, hasAttribute: () => false,
    appendChild: noop, removeChild: noop, insertBefore: noop, remove: noop,
    addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] });
  const doc = { readyState: 'loading', addEventListener: noop, removeEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [], getElementById: () => null,
    getElementsByTagName: () => [], createElement: el, head: el(), body: el(),
    documentElement: { style: { setProperty: noop } }, cookie: '' };
  const store = { getItem: () => null, setItem: noop, removeItem: noop };
  const win = { addEventListener: noop, innerWidth: 1280, matchMedia: () => ({ matches: false, addEventListener: noop }) };
  const loc = { protocol: 'https:', href: 'https://mykunda.com/', pathname: '/', search: '', origin: 'https://mykunda.com' };
  return new Function('window', 'document', 'localStorage', 'sessionStorage', 'navigator',
    'location', 'fetch', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'IntersectionObserver', 'self',
    src + '\n;getUser=function(){return null};getCurrency=function(){return "GMD"};' +
    '\nreturn {headerHTML:headerHTML, footerHTML:footerHTML};')(
    win, doc, store, store, { userAgent: 'build', language: 'en' }, loc,
    () => new Promise(() => {}), noop, noop, noop,
    function () { this.observe = noop; this.disconnect = noop; }, win);
}

let shell = null;
try { shell = loadShell(appSrc); shell.headerHTML('', false); shell.footerHTML(); }
catch (e) { shell = null; console.warn('LET OP: header/footer niet vooraf gerenderd (' + e.message + '). De pagina\u2019s vullen hem at runtime, zoals voorheen.'); }

/* Pagina's achter een login of met een eigen shell blijven ongemoeid. */
const HANDS_OFF = new Set(['admin.html', 'dashboard.html', 'messages.html', 'list.html',
  'auth.html', 'checkout.html', 'checkout v2.html', 'checkout v3.html', 'sources.html',
  'rates.html', 'title-verification.html']);

const HDR_CALL = /[ \t]*document\.getElementById\((['"])header\1\)\.innerHTML\s*=\s*headerHTML\(\s*(['"])([^'"]*)\2\s*,\s*(true|false)\s*\)\s*;?[ \t]*\n?/;
const FTR_CALL = /[ \t]*document\.getElementById\((['"])footer\1\)\.innerHTML\s*=\s*footerHTML\(\)\s*;?[ \t]*\n?/;
const HDR_DIV = /<div id="header"[^>]*>(?:<!--mk-hdr-->[\s\S]*?<!--\/mk-hdr-->)?<\/div>/;
const FTR_DIV = /<div id="footer"[^>]*>(?:<!--mk-ftr-->[\s\S]*?<!--\/mk-ftr-->)?<\/div>/;

function prerenderShell(src, name) {
  if (!shell || HANDS_OFF.has(name)) return src;
  if (!HDR_DIV.test(src)) return src;
  const hasFooter = FTR_DIV.test(src);   /* search.html heeft geen footer */

  /* Welke header hoort bij deze pagina? Eerst de aanroep in het inline script; is die
     er al uit (tweede build), dan staan de argumenten op de div zelf. */
  let active = null, hero = false;
  const call = src.match(HDR_CALL);
  if (call) { active = call[3]; hero = call[4] === 'true'; }
  else {
    const div = src.match(/<div id="header"([^>]*)>/);
    if (div && /data-static/.test(div[1])) {
      active = (div[1].match(/data-active="([^"]*)"/) || [, ''])[1];
      hero = /data-hero="1"/.test(div[1]);
    }
  }
  if (active === null) { console.warn('  ' + name + ': header-aanroep niet herkend, overgeslagen'); return src; }

  let out = src
    .replace(HDR_DIV, () => '<div id="header" data-static data-active="' + active + '" data-hero="' +
      (hero ? '1' : '0') + '"><!--mk-hdr-->' + shell.headerHTML(active, hero) + '<!--/mk-hdr--></div>')
    .replace(HDR_CALL, '');
  if (hasFooter) {
    out = out
      .replace(FTR_DIV, () => '<div id="footer" data-static><!--mk-ftr-->' + shell.footerHTML() + '<!--/mk-ftr--></div>')
      .replace(FTR_CALL, '');
  }

  /* Landmarks: overslaan-link en <main> om de paginainhoud. Eén keer per pagina. */
  if (!/class="skip-link"/.test(out)) {
    out = out.replace(/<body[^>]*>\n?/i, m => m + '<a class="skip-link" href="#main">Skip to content</a>\n');
  }
  if (!/id="main"/.test(out)) {
    out = out.replace(/(<div id="header"[^>]*><!--mk-hdr-->[\s\S]*?<!--\/mk-hdr--><\/div>\n?)/, m => m + '<main id="main">\n');
    out = hasFooter
      ? out.replace(/<div id="footer"[^>]*><!--mk-ftr-->/, m => '</main>\n' + m)
      : out.replace(/<\/body>/i, m => '</main>\n' + m);
  }
  return out;
}

/* One stamp in every page and in sw.js */
const files = await readdir('.');
const pages = files.filter(f => extname(f) === '.html' && !INTERNAL.test(f));
let stamped = 0, prerendered = 0;
for (const f of pages) {
  const src = await readFile(f, 'utf8');
  const shelled = prerenderShell(src, f);
  if (/<div id="header"[^>]*data-static/.test(shelled)) prerendered++;
  const out = markPage(shelled.replace(/\?v=\d+/g, '?v=' + STAMP), f);
  if (out !== src) { await writeFile(f, out); stamped++; }
}
if (shell) console.log('shell     header + footer statisch in ' + prerendered + ' pagina(\'s)');
const sw = await readFile('sw.js', 'utf8');
await writeFile('sw.js', sw.replace(/const STAMP = '\d+'/, `const STAMP = '${STAMP}'`));
console.log(`stamped   ${stamped} pages + sw.js at v=${STAMP}`);

/* Mirror into deploy/ */
await mkdir('deploy', { recursive: true });
let copied = 0;
const uploaded = [...pages.filter(p => !NOT_UPLOADED.has(p)), ...SITE_ASSETS];
for (const f of uploaded) {
  try { await stat(f); } catch { continue; }
  await copyFile(f, join('deploy', f)); copied++;
}
for (const dir of ['images', 'images/og', 'fonts', 'vendor', 'logo']) {
  try {
    const names = await readdir(dir);
    await mkdir(join('deploy', dir), { recursive: true });
    for (const n of names) {
      try { if ((await stat(join(dir, n))).isFile()) { await copyFile(join(dir, n), join('deploy', dir, n)); copied++; } } catch {}
    }
  } catch {}
}
/* Alles wat intern is en ooit in deploy/ terechtkwam, gaat er weer uit:
   een handleiding op de server vertelt een buitenstaander precies hoe de
   site in elkaar zit. */
/* Alles wat intern of uitgesloten is en ooit in deploy/ terechtkwam, gaat er weer uit.
   Niet alleen .html: ook een achtergebleven app.js of doc-page.js hoort weg. deploy/
   is precies de lijst hierboven, niets meer — anders sluipt oude rommel de webroot in. */
const allowed = new Set(uploaded);
let purged = 0;
for (const n of await readdir('deploy')) {
  if (n === 'images' || n === 'fonts' || n === 'vendor' || n === 'logo') continue;
  if (!allowed.has(n)) { await rm(join('deploy', n), { force: true }); purged++; }
}
console.log(`mirrored  ${copied} files into deploy/${purged ? `, ${purged} bestand(en) opgeruimd` : ''}`);
console.log('\nUpload the contents of deploy/ to the webroot, overwrite on.');
