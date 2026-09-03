// SEO-meting over deploy/ (de gebouwde site). Leest alleen, schrijft _werk/seo-audit.json
// Gebruik: node build.mjs && node _werk/seo-audit.mjs
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DEP = 'deploy';
const HOST = 'https://mykunda.com/';
const files = readdirSync(DEP).filter(f => f.endsWith('.html')).sort();
const exists = new Set(readdirSync(DEP));
for (const d of ['images','fonts','vendor','logo']) if (existsSync(join(DEP,d))) for (const f of walk(join(DEP,d))) exists.add(f.slice(DEP.length+1).replace(/\\/g,'/'));
function walk(d){ let out=[]; for (const e of readdirSync(d,{withFileTypes:true})){ const p=join(d,e.name); out = e.isDirectory()? out.concat(walk(p)) : out.concat([p]); } return out; }

const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')); return m ? (m[2] ?? m[3] ?? m[4]) : null; };
const dec = s => (s||'').replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const sitemap = readFileSync('sitemap-pages.xml','utf8');
const smUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
let ledger = {}; try { ledger = JSON.parse(readFileSync('sitemap-lastmod.json','utf8')); } catch {}
const smLastmod = Object.fromEntries([...sitemap.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(m => [m[1], m[2]]));

const pages = {}; const inbound = {};
for (const f of files) {
  const html = readFileSync(join(DEP,f),'utf8');
  const head = html.slice(0, html.indexOf('</head>') + 7);
  const body = html.slice(html.indexOf('<body'));
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]);
  const meta = n => { const t = metas.find(x => (attr(x,'name')||'').toLowerCase() === n); return t ? attr(t,'content') : null; };
  const prop = n => { const t = metas.find(x => (attr(x,'property')||'').toLowerCase() === n); return t ? attr(t,'content') : null; };
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(m => m[0]);
  const canon = links.filter(l => /rel\s*=\s*["']?canonical/i.test(l)).map(l => attr(l,'href'));
  const robots = (meta('robots') || '').toLowerCase();
  const title = dec((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]);
  const desc = dec(meta('description'));
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => dec(m[1].replace(/<[^>]+>/g,'')));
  const lang = attr(html.match(/<html\b[^>]*>/i)?.[0] || '', 'lang');
  const imgs = [...body.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]);
  const noalt = imgs.filter(i => attr(i,'alt') === null).length;
  const nodim = imgs.filter(i => !attr(i,'width') || !attr(i,'height')).length;
  const nolazy = imgs.filter(i => !attr(i,'loading') && !attr(i,'fetchpriority')).length;
  const jsonld = [...html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  const ldTypes = []; const ldErr = [];
  for (const j of jsonld) { try { const o = JSON.parse(j); const walkT = x => { if (Array.isArray(x)) x.forEach(walkT); else if (x && typeof x === 'object') { if (x['@type']) ldTypes.push(String(x['@type'])); Object.values(x).forEach(walkT); } }; walkT(o); } catch (e) { ldErr.push(e.message.slice(0,80)); } }
  const hrefs = [...html.matchAll(/<a\b[^>]*\shref\s*=\s*["']([^"'#?]+)[^"']*["']/gi)].map(m => m[1]);
  const internal = hrefs.filter(h => !/^(https?:|mailto:|tel:|javascript:|\/\/)/i.test(h) || h.startsWith(HOST)).map(h => h.replace(HOST,'').replace(/^\.?\//,''));
  const broken = [...new Set(internal.filter(h => h && !h.includes('${') && !exists.has(h) && !exists.has(h + 'index.html') && h !== '/' ))];
  for (const h of internal) { const t = h === '' ? 'index.html' : h; if (t.endsWith('.html')) { inbound[t] ??= new Set(); if (t !== f) inbound[t].add(f); } }
  const text = body.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ');
  const words = (text.match(/\S+/g)||[]).length;
  const url = HOST + (f === 'index.html' ? '' : f);
  pages[f] = { url, title, titleLen: title.length, desc, descLen: desc.length, canon, robots, noindex: /noindex/.test(robots), lang,
    h1: h1s, ogTitle: prop('og:title'), ogDesc: prop('og:description'), ogImage: prop('og:image'), ogUrl: prop('og:url'), twCard: meta('twitter:card'),
    viewport: !!meta('viewport'), imgs: imgs.length, noalt, nodim, nolazy, ldTypes: [...new Set(ldTypes)], ldErr, broken, words,
    inSitemap: smUrls.includes(url), lastmod: smLastmod[url] || null, mtime: statSync(join('.', f)).mtime.toISOString().slice(0,10),
    hreflang: links.filter(l => /hreflang/i.test(l)).length, hasMkMark: html.includes('mk-mark'),
    noindexLinks: 0 };
}
for (const f of files) pages[f].inboundCount = (inbound[f]||new Set()).size;
for (const f of files) { const p = pages[f]; p.noindexLinks = [...readFileSync(join(DEP,f),'utf8').matchAll(/<a\b[^>]*\shref\s*=\s*["']([a-z0-9-]+\.html)/gi)].map(m=>m[1]).filter(t => pages[t]?.noindex).length; }

// Site-brede bevindingen
const idx = files.filter(f => !pages[f].noindex);
const F = [];
const dup = (key) => { const m = {}; for (const f of idx) (m[pages[f][key]] ??= []).push(f); return Object.entries(m).filter(([k,v]) => v.length > 1 && k); };
for (const [k,v] of dup('title')) F.push(['dubbele title', v.join(', '), k]);
for (const [k,v] of dup('desc')) F.push(['dubbele description', v.join(', '), k.slice(0,60)]);
for (const f of idx) { const p = pages[f];
  if (!p.title) F.push(['geen title', f]); else if (p.titleLen > 65) F.push(['title >65', f, p.titleLen]); else if (p.titleLen < 25) F.push(['title <25', f, p.titleLen]);
  if (!p.desc) F.push(['geen description', f]); else if (p.descLen > 165) F.push(['description >165', f, p.descLen]); else if (p.descLen < 70) F.push(['description <70', f, p.descLen]);
  if (p.canon.length !== 1) F.push(['canonical aantal', f, p.canon.length]); else if (p.canon[0] !== p.url) F.push(['canonical wijkt af', f, p.canon[0]]);
  if (p.h1.length !== 1) F.push(['h1 aantal', f, p.h1.length]);
  if (!p.inSitemap) F.push(['indexeerbaar maar niet in sitemap', f]);
  if (!p.ogTitle || !p.ogImage || !p.ogDesc) F.push(['og onvolledig', f, [!p.ogTitle&&'title',!p.ogDesc&&'desc',!p.ogImage&&'image'].filter(Boolean).join('/')]);
  if (p.ogUrl && p.ogUrl !== p.url) F.push(['og:url wijkt af', f, p.ogUrl]);
  if (!p.twCard) F.push(['geen twitter:card', f]);
  if (p.ldErr.length) F.push(['JSON-LD parsefout', f, p.ldErr.join(' | ')]);
  if (!p.ldTypes.length) F.push(['geen JSON-LD', f]);
  if (p.noalt) F.push(['img zonder alt', f, p.noalt]);
  if (p.broken.length) F.push(['kapotte interne link', f, p.broken.join(', ')]);
  if (p.inboundCount === 0) F.push(['wees (0 inkomende links)', f]);
  if (p.lang !== 'en') F.push(['lang', f, p.lang]);
  if (!p.hasMkMark) F.push(['geen mk-mark', f]);
  if (p.words < 200) F.push(['dunne pagina <200 woorden', f, p.words]);
  if (p.lastmod && ledger[f] && ledger[f].lastmod !== p.lastmod) F.push(['lastmod wijkt af van sitemap-lastmod.json', f, `${p.lastmod} vs ${ledger[f].lastmod}`]);
}
for (const f of files.filter(f => pages[f].noindex)) { if (pages[f].inSitemap) F.push(['noindex maar in sitemap', f]); }
for (const u of smUrls) { const f = u === HOST ? 'index.html' : u.replace(HOST,''); if (!pages[f]) F.push(['sitemap-URL bestaat niet in deploy', u]); }
const linksToNoindex = files.filter(f => !pages[f].noindex && pages[f].noindexLinks).map(f => `${f}:${pages[f].noindexLinks}`);

const summary = { pages: files.length, indexable: idx.length, noindex: files.length - idx.length, sitemapUrls: smUrls.length, findings: F.length,
  byType: Object.fromEntries(Object.entries(F.reduce((a,[t]) => (a[t]=(a[t]||0)+1, a), {})).sort((a,b)=>b[1]-a[1])), linksToNoindex };
writeFileSync('_werk/seo-audit.json', JSON.stringify({ summary, findings: F, pages }, null, 1));
console.log(JSON.stringify(summary, null, 1));
for (const t of Object.keys(summary.byType)) { console.log(`\n## ${t}`); for (const r of F.filter(x => x[0] === t).slice(0, 60)) console.log('  ' + r.slice(1).join('  |  ')); }
